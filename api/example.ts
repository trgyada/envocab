import { GoogleGenerativeAI } from '@google/generative-ai';

// v1 endpoint ve güncel model (Gemini 2.5 Flash)
const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
type LanguageCode = 'en' | 'de' | 'tr';

const languageNames: Record<LanguageCode, string> = {
  en: 'English',
  de: 'German',
  tr: 'Turkish',
};

const translationTargetNames: Record<LanguageCode, string> = {
  en: 'Turkish',
  de: 'Turkish',
  tr: 'English',
};

const exampleInstructions: Record<LanguageCode, string> = {
  en: `Task: Write one B2-C1 level sentence in English. Use the word naturally in context.
Style: Academic but fluent, dictionary-quality.`,
  de: `Task: Write one A1-A2 CEFR level sentence in German. Use the word naturally in a simple everyday context.
Style: Beginner-friendly, short, clear, and natural. Use common vocabulary and simple grammar.
Length: 5-10 words when possible. Prefer present tense. Avoid idioms, subordinate clauses, advanced connectors, and long sentences.`,
  tr: `Task: Write one B2-C1 level sentence in Turkish. Use the word naturally in context.
Style: Academic but fluent, dictionary-quality.`,
};

const isLanguageCode = (value: unknown): value is LanguageCode =>
  value === 'en' || value === 'de' || value === 'tr';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
  }

  const { word, lang } = req.body as { word?: string; lang?: LanguageCode };
  if (!word || !isLanguageCode(lang)) {
    return res.status(400).json({ error: 'word and lang (en|de|tr) are required' });
  }

  try {
    // v1 API kullan
    const genAI = new GoogleGenerativeAI(apiKey, { apiVersion: 'v1' });
    const model = genAI.getGenerativeModel({ model: modelName });

    const prompt = `
Word: "${word}"
Language: ${languageNames[lang]}
${exampleInstructions[lang]}
Translation: Also produce a ${translationTargetNames[lang]} translation for showing after the answer.

Yaniti su JSON formatinda ver:
{
  "sentence": "cumle",
  "translation": "ceviri"
}
`;

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
      }
    });
    const raw = result.response.text().trim();
    const clean = raw.replace(/```(json)?/gi, '').replace(/```/g, '').trim();

    let data: { sentence?: string; translation?: string } = {};
    try {
      data = JSON.parse(clean);
    } catch {
      const sentenceMatch = clean.match(/"sentence"\\s*:\\s*"([^"]+)"/i);
      const translationMatch = clean.match(/"translation"\\s*:\\s*"([^"]+)"/i);
      data = {
        sentence: sentenceMatch ? sentenceMatch[1] : clean,
        translation: translationMatch ? translationMatch[1] : ''
      };
    }

    return res.status(200).json({
      sentence: data.sentence || '',
      translation: data.translation || ''
    });
  } catch (error: any) {
    console.error('Gemini error', error?.message || error);
    const status = error?.status || 500;
    const raw = error?.message || '';
    const retryMatch = raw.match(/retryDelay\":\"(\d+)s\"/i);
    const retryAfterMs = retryMatch ? Number(retryMatch[1]) * 1000 : undefined;
    return res.status(status).json({
      error: error?.message || 'Example generation failed',
      status,
      retryAfterMs
    });
  }
}
