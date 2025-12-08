import { GoogleGenerativeAI } from '@google/generative-ai';

// v1 endpoint ve güncel model adı (Gemini 2.5 Flash)
const modelName = 'gemini-2.5-flash';

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
    // v1 API kullan
    const genAI = new GoogleGenerativeAI(apiKey, { apiVersion: 'v1' });
    const model = genAI.getGenerativeModel({ model: modelName });

    const prompt = `
Kelime: "${word}"
Dil: ${lang === 'en' ? 'Ingilizce' : 'Turkce'}
Gorev: C1-C2 seviyesinde tek cumle kur. Kelimeyi dogal baglamda kullan.
Ceviri: Cevap verildikten sonra gostermek icin karsi dilde bir ceviri de uret.

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
      ]
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
