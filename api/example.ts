import { GoogleGenerativeAI } from '@google/generative-ai';

const modelName = 'gemini-1.5-flash-latest';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
  }

  const { word, lang } = req.body as { word?: string; lang?: 'en' | 'tr' };
  if (!word || (lang !== 'en' && lang !== 'tr')) {
    return res.status(400).json({ error: 'word and lang (en|tr) are required' });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    const prompt = `
Kelime: "${word}"
Dil: ${lang === 'en' ? 'İngilizce' : 'Türkçe'}
Görev: C1-C2 seviyesinde tek cümle kur. Kelimeyi doğal bağlamda kullan.
Çeviri: Cevap verildikten sonra göstermek için karşı dilde bir çeviri de üret.

Yanıtı şu JSON formatında ver:
{
  "sentence": "cümle",
  "translation": "çeviri"
}
`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    const text = result.response.text().trim();

    let data: { sentence?: string; translation?: string } = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { sentence: text, translation: '' };
    }

    return res.status(200).json({
      sentence: data.sentence || '',
      translation: data.translation || ''
    });
  } catch (error: any) {
    console.error('Gemini error', error?.message || error);
    const status = error?.status || 500;
    return res.status(status).json({
      error: error?.message || 'Example generation failed',
      status
    });
  }
}
