import { GoogleGenerativeAI } from '@google/generative-ai';

const modelName = 'gemma-3-27b-it';

const normalize = (value: string) => value.toLowerCase().trim();

const sanitizeSynonyms = (synonyms: string[], original: string, maxCount: number) => {
  const originalNorm = normalize(original);
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const raw of synonyms) {
    const candidate = raw.replace(/["'`]/g, '').replace(/\s+/g, ' ').trim();
    if (!candidate) continue;
    const normalized = normalize(candidate);
    if (normalized === originalNorm) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    cleaned.push(candidate);
    if (cleaned.length >= maxCount) break;
  }

  return cleaned;
};

const parseSynonymResponse = (raw: string) => {
  const cleaned = raw.replace(/```(json)?/gi, '').replace(/```/g, '').trim();
  try {
    const data = JSON.parse(cleaned);
    if (Array.isArray(data?.synonyms)) {
      return data.synonyms.map((s) => String(s));
    }
  } catch {
    // fall through
  }

  if (cleaned.includes('[') && cleaned.includes(']')) {
    const bracket = cleaned.slice(cleaned.indexOf('[') + 1, cleaned.lastIndexOf(']'));
    return bracket
      .split(',')
      .map((s) => s.replace(/["'`]/g, '').trim())
      .filter(Boolean);
  }

  return cleaned
    .split(/\n|;|,/)
    .map((s) => s.replace(/^[\-\*\d\.\)]\s*/, '').trim())
    .filter(Boolean);
};

const buildPrompt = (word: string, count: number) => `
Word: "${word}"
Task: Provide ${count} English synonyms.
Guidelines:
- Prefer standard, dictionary-grade synonyms (Oxford/Cambridge/Merriam-Webster style).
- Avoid slang or overly rare terms.
- No duplicates.
- Do not include the original word.
Return JSON only in this format:
{
  "synonyms": ["syn1", "syn2", "syn3", "syn4"]
}
`;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
  }

  const { word, count } = req.body as { word?: string; count?: number };
  if (!word || typeof word !== 'string') {
    return res.status(400).json({ error: 'word is required' });
  }

  const targetCount = Math.max(1, Math.min(Number(count) || 4, 6));

  try {
    const genAI = new GoogleGenerativeAI(apiKey, { apiVersion: 'v1' });
    const model = genAI.getGenerativeModel({ model: modelName });

    const generateOnce = async () => {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: buildPrompt(word, targetCount) }] }],
        generationConfig: {
          temperature: 0.6,
          topP: 0.9,
          topK: 40,
        },
      });
      return parseSynonymResponse(result.response.text() || '');
    };

    let rawSynonyms = await generateOnce();
    let synonyms = sanitizeSynonyms(rawSynonyms, word, targetCount);

    if (synonyms.length === 0) {
      rawSynonyms = await generateOnce();
      synonyms = sanitizeSynonyms(rawSynonyms, word, targetCount);
    }

    return res.status(200).json({ synonyms });
  } catch (error: any) {
    console.error('synonyms error', error?.message || error);
    const status = error?.status || 500;
    const raw = error?.message || '';
    const retryMatch = raw.match(/retryDelay\":\"(\d+)s\"/i);
    const retryAfterMs = retryMatch ? Number(retryMatch[1]) * 1000 : undefined;
    return res.status(status).json({
      error: error?.message || 'Synonym generation failed',
      status,
      retryAfterMs
    });
  }
}
