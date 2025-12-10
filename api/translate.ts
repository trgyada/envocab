import { GoogleGenerativeAI } from '@google/generative-ai';

const modelName = 'gemma-3-27b-it';

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

  try {
    const genAI = new GoogleGenerativeAI(apiKey, { apiVersion: 'v1' });
    const model = genAI.getGenerativeModel({ model: modelName });

    const prompt = `Metni cevir.\nGiris dili: ${from === 'tr' ? 'Turkce' : 'Ingilizce'}\nHedef dili: ${
      to === 'tr' ? 'Turkce' : 'Ingilizce'
    }\nMetin: "${text}"\nSadece ceviri don, ek yazi yazma.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const translation = result.response.text().replace(/```/g, '').trim();
    return res.status(200).json({ translation });
  } catch (error: any) {
    console.error('Translate error', error?.message || error);
    const status = error?.status || 500;
    return res.status(status).json({ error: error?.message || 'Translate failed', status });
  }
}
