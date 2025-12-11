from pathlib import Path
p = Path('src/services/quizEngine.ts')
text = p.read_text(encoding='utf-8')
old = '''  // YanlZÒèY èYZÒklarZÒ se«ı (doZYru cevap hari«ı, tekrar yok, anlamca yakZÒn olanlara «Ùncelik)
  const otherWords = allWords.filter((w) => w.id !== word.id);

  const scoreCandidate = (candidate: Word, optionText: string) => {
    let score = 0;
    if (candidate.partOfSpeech && word.partOfSpeech && candidate.partOfSpeech === word.partOfSpeech) {
      score += 3;
    }
    const lenDiff = Math.abs(optionText.length - correctAnswer.length);
    if (lenDiff <= 2) score += 2;
    if (optionText[0]?.toLowerCase() === correctAnswer[0]?.toLowerCase()) score += 1;
    return score;
  };

  const ranked = otherWords
    .map((w) => {
      const option = isEnglishToTurkish ? w.turkish : w.english;
      return { option, score: scoreCandidate(w, option) };
    })
    .filter((item) => item.option && item.option.trim().length > 0)
    .sort((a, b) => b.score - a.score);

  const topCandidates = ranked.slice(0, 12);
  const shuffledTop = shuffleArray(topCandidates);

  const usedAnswers = new Set<string>([correctAnswer.toLowerCase().trim()]);
  const wrongOptions: string[] = [];

  for (const item of shuffledTop) {
    const normalizedOption = item.option.toLowerCase().trim();
    if (!usedAnswers.has(normalizedOption)) {
      usedAnswers.add(normalizedOption);
      wrongOptions.push(item.option);
      if (wrongOptions.length >= 3) break;
    }
  }

  // H«Ωl«Ω eksikse rastgele tamamla
  if (wrongOptions.length < 3) {
    const fallback = shuffleArray(otherWords);
    for (const w of fallback) {
      const option = isEnglishToTurkish ? w.turkish : w.english;
      const normalizedOption = option.toLowerCase().trim();
      if (!usedAnswers.has(normalizedOption)) {
        usedAnswers.add(normalizedOption);
        wrongOptions.push(option);
        if (wrongOptions.length >= 3) break;
      }
    }
  }
'''
new = '''  // YanlZÒèY èYZÒklarZÒ se«ı (tier: POS + uzunluk > POS > uzunluk > rastgele)
  const otherWords = allWords.filter((w) => w.id !== word.id);
  const correctLen = correctAnswer.length;
  const correctPos = word.partOfSpeech || '';

  const candidates = otherWords
    .map((w) => ({
      option: isEnglishToTurkish ? w.turkish : w.english,
      pos: w.partOfSpeech || '',
    }))
    .filter((c) => c.option && c.option.trim().length > 0);

  const tierBuckets = {
    tier1: [] as string[], // AynZÒ POS + benzer uzunluk
    tier2: [] as string[], // AynZÒ POS
    tier3: [] as string[], // Benzer uzunluk
    tier4: [] as string[], // DièYerleri
  };

  candidates.forEach((c) => {
    const opt = c.option.trim();
    const samePos = correctPos && c.pos && c.pos === correctPos;
    const lenClose = abs(opt.length - correctLen) <= 2;

    if (samePos && lenClose) {
      tierBuckets.tier1.push(opt);
    } else if (samePos) {
      tierBuckets.tier2.push(opt);
    } else if (lenClose) {
      tierBuckets.tier3.push(opt);
    } else {
      tierBuckets.tier4.push(opt);
    }
  });

  const usedAnswers = new Set<string>([correctAnswer.toLowerCase().trim()]);
  const wrongOptions: string[] = [];
  const takeFromTier = (arr: string[]) => {
    const shuffled = shuffleArray(arr);
    for (const opt of shuffled) {
      const norm = opt.toLowerCase().trim();
      if (!usedAnswers.has(norm)) {
        usedAnswers.add(norm);
        wrongOptions.push(opt);
        if (wrongOptions.length >= 3) break;
      }
    }
  };

  takeFromTier(tierBuckets.tier1);
  if (wrongOptions.length < 3) takeFromTier(tierBuckets.tier2);
  if (wrongOptions.length < 3) takeFromTier(tierBuckets.tier3);
  if (wrongOptions.length < 3) takeFromTier(tierBuckets.tier4);

  // H«Ωl«Ω eksikse rastgele tamamla
  if (wrongOptions.length < 3) {
    const fallback = shuffleArray(otherWords);
    for (const w of fallback) {
      const option = isEnglishToTurkish ? w.turkish : w.english;
      const normalizedOption = option.toLowerCase().trim();
      if (!usedAnswers.has(normalizedOption)) {
        usedAnswers.add(normalizedOption);
        wrongOptions.push(option);
        if (wrongOptions.length >= 3) break;
      }
    }
  }
'''
if old not in text:
    raise SystemExit('old block not found')
new_text = text.replace(old, new)
p.write_text(new_text, encoding='utf-8')
print('updated')
