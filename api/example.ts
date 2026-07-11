import { GoogleGenerativeAI } from '@google/generative-ai';

// v1 endpoint ve güncel model (Gemini 2.5 Flash)
const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
type LanguageCode = 'en' | 'de' | 'tr';
type GermanExampleLevel = 'a1-a2' | 'a2-b1';

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

const exampleInstructions: Record<Exclude<LanguageCode, 'de'>, string> = {
  en: `Task: Write one B2-C1 level sentence in English. Use the word naturally in context.
Style: Academic but fluent, dictionary-quality.`,
  tr: `Task: Write one B2-C1 level sentence in Turkish. Use the word naturally in context.
Style: Academic but fluent, dictionary-quality.`,
};

const germanExampleInstructions: Record<GermanExampleLevel, string> = {
  'a1-a2': `Task: Write one A1-A2 CEFR level sentence in German. Use the word naturally in a simple everyday context.
Style: Beginner-friendly, short, clear, and natural. Use common vocabulary and simple grammar.
Length: 5-10 words when possible. Prefer present tense. Avoid idioms, subordinate clauses, advanced connectors, and long sentences.`,
  'a2-b1': `Task: Write one A2-B1 CEFR level sentence in German. Use the word naturally in an everyday context.
Style: Clear and natural for a learner moving toward intermediate level. Use common vocabulary and practical grammar.
Length: 8-14 words when possible. You may use modal verbs, past tense, or one simple subordinate clause. Avoid rare vocabulary, idioms, and complex sentence structures.`,
};

const isLanguageCode = (value: unknown): value is LanguageCode =>
  value === 'en' || value === 'de' || value === 'tr';

const isGermanExampleLevel = (value: unknown): value is GermanExampleLevel =>
  value === 'a1-a2' || value === 'a2-b1';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
  }

  const { word, lang, level } = req.body as {
    word?: string;
    lang?: LanguageCode;
    level?: GermanExampleLevel;
  };
  if (!word || !isLanguageCode(lang)) {
    return res.status(400).json({ error: 'word and lang (en|de|tr) are required' });
  }
  if (lang === 'de' && level !== undefined && !isGermanExampleLevel(level)) {
    return res.status(400).json({ error: 'level must be a1-a2 or a2-b1 for German examples' });
  }

  const germanLevel = lang === 'de' && isGermanExampleLevel(level) ? level : 'a1-a2';
  const instructions = lang === 'de' ? germanExampleInstructions[germanLevel] : exampleInstructions[lang];

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: 'v1' });

    const prompt = `
Word: "${word}"
Language: ${languageNames[lang]}
${instructions}
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
