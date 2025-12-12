import { GoogleGenerativeAI } from '@google/generative-ai';

type ReqBody = {
  prompt: string;
  correct: string;
  user: string;
  lang?: 'en' | 'tr';
};

const modelName = 'gemma-3-27b-it';

const levenshtein = (a: string, b: string) => {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const { prompt, correct, user, lang = 'en' } = req.body as ReqBody;

  if (!prompt || !correct || !user) {
    return res.status(400).json({ error: 'prompt, correct ve user alanlari zorunlu' });
  }

  const normalize = (s: string) => s.trim().toLowerCase();
  const normUser = normalize(user);
  const normCorrect = normalize(correct);

  const dist = levenshtein(normUser, normCorrect);
  const maxLen = Math.max(normUser.length, normCorrect.length, 1);
  const typoScore = Math.max(0, 100 - Math.floor((dist / maxLen) * 100));

  // Default fallback cevabi
  const fallback = {
    accepted: typoScore >= 85 || normUser === normCorrect,
    score: typoScore,
    verdict: normUser === normCorrect ? 'exact' : 'typo',
    synonyms: [] as string[],
    explanation: 'Levenshtein tabanli skor',
  };

  if (!apiKey) {
    return res.status(200).json(fallback);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey, { apiVersion: 'v1' });
    const model = genAI.getGenerativeModel({ model: modelName });

    const promptText = `
Sen bir sinav degerlendiricisisin. Ogrenci bir kelimenin karsiligini yaziyor.
Dil: ${lang === 'tr' ? 'Turkce' : 'Ingilizce'}
Dogru cevap: "${correct}"
Ogrenci cevabi: "${user}"

Gorev:
1) Es anlamli veya ayni anlama gelen kelime/ifade ise kabul et.
2) Kucuk yazim hatalarini (harf eksik/fazla, yer degisimi) %85+ kabul et, %60-85 kismi uyarili kismi dogru say.
3) JSON formatinda cevap ver:
{
  "accepted": true/false,
  "score": 0-100,
  "verdict": "exact" | "synonym" | "typo" | "wrong",
  "synonyms": ["...","..."] // varsa en fazla 5
}
`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      generationConfig: { temperature: 0.2 }
    });

    const raw = result.response.text().trim();
    const clean = raw.replace(/```(json)?/gi, '').replace(/```/g, '').trim();
    let parsed: any = {};
    try {
      parsed = JSON.parse(clean);
    } catch {
      parsed = fallback;
    }

    return res.status(200).json({
      accepted: parsed.accepted ?? fallback.accepted,
      score: parsed.score ?? fallback.score,
      verdict: parsed.verdict ?? fallback.verdict,
      synonyms: parsed.synonyms ?? [],
    });
  } catch (err: any) {
    console.error('validate-answer error', err?.message || err);
    return res.status(200).json(fallback);
  }
}
