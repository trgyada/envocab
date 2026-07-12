import { GoogleGenerativeAI } from '@google/generative-ai';

const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
type DefinitionLanguage = 'en' | 'de';

const languageNames: Record<DefinitionLanguage, string> = {
  en: 'English',
  de: 'German',
};

const isDefinitionLanguage = (value: unknown): value is DefinitionLanguage =>
  value === 'en' || value === 'de';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
  }

  const { word, language = 'en' } = req.body as { word?: string; language?: DefinitionLanguage };
  if (!word) {
    return res.status(400).json({ error: 'word is required' });
  }
  if (!isDefinitionLanguage(language)) {
    return res.status(400).json({ error: 'language must be en or de' });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: 'v1' });

    const prompt = `
Word: "${word}"
Task: Provide a concise ${languageNames[language]} definition (max 20 words).
Guidelines:
- Dictionary-grade, standard learner-friendly wording.
- No translation, no examples, no synonyms list.
Return plain text only.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.5, topP: 0.9, topK: 40 }
    });

    const text = (result.response.text() || '').replace(/```/g, '').trim();
    if (!text) {
      return res.status(500).json({ error: 'Definition generation failed', status: 500 });
    }
    return res.status(200).json({ definition: text });
  } catch (error: any) {
    console.error('definition error', error?.message || error);
    const status = error?.status || 500;
    const raw = error?.message || '';
    const retryMatch = raw.match(/retryDelay\":\"(\d+)s\"/i);
    const retryAfterMs = retryMatch ? Number(retryMatch[1]) * 1000 : undefined;
    return res.status(status).json({
      error: error?.message || 'Definition generation failed',
      status,
      retryAfterMs
    });
  }
}
