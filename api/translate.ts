import { GoogleGenerativeAI } from '@google/generative-ai';

const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
type LanguageCode = 'en' | 'de' | 'tr';

const languageNames: Record<LanguageCode, string> = {
  en: 'English',
  de: 'German',
  tr: 'Turkish',
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

  const { text, from = 'en', to = 'tr' } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text is required' });
  }
  if (!isLanguageCode(from) || !isLanguageCode(to)) {
    return res.status(400).json({ error: 'from and to must be one of en, de, tr' });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: 'v1' });

    const prompt = `Translate the text.\nSource language: ${languageNames[from]}\nTarget language: ${languageNames[to]}\nText: "${text}"\nReturn only the translation, with no extra text.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const translation = result.response.text().replace(/```/g, '').trim();
    return res.status(200).json({ translation });
  } catch (error: any) {
    console.error('Translate error', error?.message || error);
    const status = error?.status || 500;
    const raw = error?.message || '';
    const retryMatch = raw.match(/retryDelay\":\"(\d+)s\"/i);
    const retryAfterMs = retryMatch ? Number(retryMatch[1]) * 1000 : undefined;
    return res.status(status).json({
      error: error?.message || 'Translate failed',
      status,
      retryAfterMs
    });
  }
}
