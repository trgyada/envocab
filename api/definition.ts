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

  const { word } = req.body as { word?: string };
  if (!word) {
    return res.status(400).json({ error: 'word is required' });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey, { apiVersion: 'v1' });
    const model = genAI.getGenerativeModel({ model: modelName });

    const prompt = `
Word: "${word}"
Task: Provide a concise English definition (max 20 words). No translation, no examples, just the definition.
Return plain text only.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.5, topP: 0.9, topK: 40 }
    });

    const text = (result.response.text() || '').replace(/```/g, '').trim();
    return res.status(200).json({ definition: text });
  } catch (error: any) {
    console.error('definition error', error?.message || error);
    const status = error?.status || 500;
    return res.status(status).json({
      error: error?.message || 'Definition generation failed',
      status
    });
  }
}
