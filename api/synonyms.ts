const normalize = (value: string) => value.toLowerCase().trim();

const sanitizeSynonyms = (synonyms: string[], original: string, maxCount: number) => {
  const originalNorm = normalize(original);
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const raw of synonyms) {
    const candidate = raw
      .replace(/["'`“”]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
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

type NinjaResponse = {
  word?: string;
  synonyms?: string[];
  antonyms?: string[];
};

const fetchSynonyms = async (word: string, apiKey: string): Promise<string[]> => {
  const url = `https://api.api-ninjas.com/v1/thesaurus?word=${encodeURIComponent(word)}`;
  const res = await fetch(url, {
    headers: { 'X-Api-Key': apiKey },
  });
  const data = (await res.json()) as NinjaResponse;
  if (!res.ok) {
    throw new Error(data?.word ? `API error for "${data.word}"` : 'API error');
  }
  return Array.isArray(data?.synonyms) ? data.synonyms.map((s) => String(s)) : [];
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.NINJAS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing NINJAS_API_KEY' });
  }

  const { word, count } = req.body as { word?: string; count?: number };
  if (!word || typeof word !== 'string') {
    return res.status(400).json({ error: 'word is required' });
  }

  const targetCount = Math.max(1, Math.min(Number(count) || 4, 6));

  try {
    let rawSynonyms = await fetchSynonyms(word, apiKey);
    let synonyms = sanitizeSynonyms(rawSynonyms, word, targetCount);

    if (synonyms.length === 0) {
      rawSynonyms = await fetchSynonyms(word, apiKey);
      synonyms = sanitizeSynonyms(rawSynonyms, word, targetCount);
    }

    return res.status(200).json({ synonyms });
  } catch (error: any) {
    console.error('synonyms error', error?.message || error);
    const status = error?.status || 500;
    return res.status(status).json({
      error: error?.message || 'Synonym fetch failed',
      status,
    });
  }
}
