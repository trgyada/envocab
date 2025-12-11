import { Word, QuizQuestion, QuizType, MatchingCard, MatchingPair, UserCardState, Card } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { prioritizeCards, getDueCards } from './sm2Algorithm';

/**
 * Diziyi karıştırır (Fisher-Yates + rastgele kesme + ikinci hafif karıştırma)
 * Böylece hep aynı başlangıç sıralaması hissi azalır.
 */
export const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];

  // Güçlü rastgelelik: crypto varsa kullan
  const rand = (max: number) => {
    if (typeof crypto !== 'undefined' && (crypto as any).getRandomValues) {
      const buf = new Uint32Array(1);
      (crypto as any).getRandomValues(buf);
      return buf[0] % max;
    }
    return Math.floor(Math.random() * max);
  };

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Rastgele kesip başa alma (cut)
  if (shuffled.length > 2) {
    const cut = rand(shuffled.length);
    const rotated = [...shuffled.slice(cut), ...shuffled.slice(0, cut)];
    // Hafif ikinci karıştırma (komşu swap)
    for (let k = 0; k < rotated.length - 1; k += 2) {
      if (rand(2) === 0) {
        [rotated[k], rotated[k + 1]] = [rotated[k + 1], rotated[k]];
      }
    }
    return rotated;
  }

  return shuffled;
};

/** Daha önce az sorulmuş kelimeleri öne alan karıştırma */
export const prioritizeUnseenWords = (words: Word[]): Word[] => {
  const scored = words.map((w) => {
    const seen = (w.correctCount || 0) + (w.incorrectCount || 0);
    const mastery = w.mastery || 0;
    // Daha az görülen ve mastery düşük olanlar daha öne çıksın, ufak rastgelelik ekle
    const score = seen * 2 + mastery + Math.random();
    return { word: w, score };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored.map((s) => s.word);
};

/**
 * Çoktan seçmeli soru oluşturur
 * @param word Kelime
 * @param allWords Tüm kelimeler (yanlış şıklar için)
 * @param direction Soru yönü: 'en-to-tr', 'tr-to-en', veya 'mixed' (karışık)
 */
export const generateMultipleChoiceQuestion = (
  word: Word,
  allWords: Word[],
  direction: 'en-to-tr' | 'tr-to-en' | 'mixed' = 'mixed'
): QuizQuestion => {
  // Karışık modda rastgele yön seç
  const isEnglishToTurkish = direction === 'mixed'
    ? Math.random() > 0.5
    : direction === 'en-to-tr';

  const question = isEnglishToTurkish ? word.english : word.turkish;
  const correctAnswer = isEnglishToTurkish ? word.turkish : word.english;

  // YanlZ�Y �YZ�klarZ� se�� (tier: POS + uzunluk > POS > uzunluk > rastgele)
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
    tier1: [] as string[], // AynZ� POS + benzer uzunluk
    tier2: [] as string[], // AynZ� POS
    tier3: [] as string[], // Benzer uzunluk
    tier4: [] as string[], // Di�Yerleri
  };

  candidates.forEach((c) => {
    const opt = c.option.trim();
    const samePos = correctPos && c.pos && c.pos === correctPos;
    const lenClose = Math.abs(opt.length - correctLen) <= 2;

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

  // Hǽlǽ eksikse rastgele tamamla
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

  const options = shuffleArray([correctAnswer, ...wrongOptions]);

  return {
    id: uuidv4(),
    word,
    questionType: 'multiple-choice',
    question,
    options,
    correctAnswer,
    direction: isEnglishToTurkish ? 'en-to-tr' : 'tr-to-en',
  };
};

/**
 * Çoktan seçmeli quiz soruları oluşturur (karışık yön ile)
 */
export const generateMultipleChoiceQuiz = (
  words: Word[],
  count?: number,
  direction: 'en-to-tr' | 'tr-to-en' | 'mixed' = 'mixed'
): QuizQuestion[] => {
  const shuffledWords = shuffleArray(words);
  const quizWords = count ? shuffledWords.slice(0, count) : shuffledWords;
  
  return quizWords.map((word, index) => {
    // Mixed modunda dengeli dağılım için sırayla yön değiştir
    const chosenDirection =
      direction === 'mixed'
        ? (index % 2 === 0 ? 'en-to-tr' : 'tr-to-en')
        : direction;
    return generateMultipleChoiceQuestion(word, words, chosenDirection);
  });
};

/**
 * Flashcard sorularını oluşturur
 */
export const generateFlashcardQuiz = (words: Word[], count?: number): QuizQuestion[] => {
  const shuffledWords = shuffleArray(words);
  const quizWords = count ? shuffledWords.slice(0, count) : shuffledWords;

  return quizWords.map((word) => ({
    id: uuidv4(),
    word,
    questionType: 'flashcard' as const,
    question: word.english,
    correctAnswer: word.turkish,
  }));
};

/**
 * Eşleştirme oyunu için kartlar oluşturur
 */
export const generateMatchingGame = (words: Word[], pairCount: number = 6): MatchingCard[] => {
  const shuffledWords = shuffleArray(words);
  const gameWords = shuffledWords.slice(0, Math.min(pairCount, words.length));

  const pairs: MatchingPair[] = gameWords.map((word) => ({
    id: word.id,
    english: word.english,
    turkish: word.turkish,
    isMatched: false,
  }));

  // İngilizce ve Türkçe kartlarını oluştur
  const englishCards: MatchingCard[] = pairs.map((pair) => ({
    id: uuidv4(),
    text: pair.english,
    type: 'english' as const,
    pairId: pair.id,
    isSelected: false,
    isMatched: false,
  }));

  const turkishCards: MatchingCard[] = pairs.map((pair) => ({
    id: uuidv4(),
    text: pair.turkish,
    type: 'turkish' as const,
    pairId: pair.id,
    isSelected: false,
    isMatched: false,
  }));

  // Tüm kartları karıştır
  return shuffleArray([...englishCards, ...turkishCards]);
};

/**
 * Yazma sorularını oluşturur
 */
export const generateWriteQuiz = (
  words: Word[],
  count?: number,
  isEnglishToTurkish: boolean = true
): QuizQuestion[] => {
  const shuffledWords = shuffleArray(words);
  const quizWords = count ? shuffledWords.slice(0, count) : shuffledWords;

  return quizWords.map((word) => ({
    id: uuidv4(),
    word,
    questionType: 'write' as const,
    question: isEnglishToTurkish ? word.english : word.turkish,
    correctAnswer: isEnglishToTurkish ? word.turkish : word.english,
  }));
};

/**
 * Karışık quiz oluşturur
 */
export const generateMixedQuiz = (
  words: Word[], 
  count?: number, 
  direction: 'en-to-tr' | 'tr-to-en' | 'mixed' = 'mixed'
): QuizQuestion[] => {
  const shuffledWords = shuffleArray(words);
  const quizWords = count ? shuffledWords.slice(0, count) : shuffledWords;

  return quizWords.map((word, index) => {
    const questionTypes: QuizType[] = ['multiple-choice', 'flashcard', 'write'];
    const selectedType = questionTypes[index % questionTypes.length];
    
    // Karışık modda her soru için rastgele yön
    const isEnglishToTurkish = direction === 'mixed' 
      ? Math.random() > 0.5 
      : direction === 'en-to-tr';

    switch (selectedType) {
      case 'multiple-choice':
        return generateMultipleChoiceQuestion(word, words, direction);
      case 'flashcard':
        return {
          id: uuidv4(),
          word,
          questionType: 'flashcard' as const,
          question: isEnglishToTurkish ? word.english : word.turkish,
          correctAnswer: isEnglishToTurkish ? word.turkish : word.english,
          direction: isEnglishToTurkish ? 'en-to-tr' : 'tr-to-en' as const,
        };
      case 'write':
        return {
          id: uuidv4(),
          word,
          questionType: 'write' as const,
          question: isEnglishToTurkish ? word.english : word.turkish,
          correctAnswer: isEnglishToTurkish ? word.turkish : word.english,
          direction: isEnglishToTurkish ? 'en-to-tr' : 'tr-to-en' as const,
        };
      default:
        return generateMultipleChoiceQuestion(word, words, direction);
    }
  });
};

/**
 * Cevabı kontrol eder (yazma soruları için)
 */
export const checkAnswer = (userAnswer: string, correctAnswer: string): boolean => {
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .trim()
      .replace(/[.,!?;:'"()-]/g, '')
      .replace(/\s+/g, ' ');

  return normalize(userAnswer) === normalize(correctAnswer);
};

/**
 * Quiz tipine göre soru oluşturur (karışık yön destekli)
 */
export const generateQuiz = (
  words: Word[],
  type: QuizType,
  count?: number,
  direction: 'en-to-tr' | 'tr-to-en' | 'mixed' = 'mixed'
): QuizQuestion[] => {
  switch (type) {
    case 'multiple-choice':
      return generateMultipleChoiceQuiz(words, count, direction);
    case 'flashcard':
      return generateFlashcardQuiz(words, count);
    case 'write':
      return generateWriteQuiz(words, count);
    case 'matching':
      // Matching için multiple-choice kullan (matching component kendi içinde yönetiyor)
      return generateMultipleChoiceQuiz(words, count, direction);
    default:
      return generateMultipleChoiceQuiz(words, count, direction);
  }
};

/**
 * Skoru hesaplar
 */
export const calculateScore = (correct: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
};

// ==========================================
// SM-2 ENTEGRE KELIME SEÇİMİ
// ==========================================

/**
 * SM-2 algoritmasına göre kelime seçimi yapar
 * 
 * Öncelik sırası:
 * 1. Due (tekrar zamanı gelmiş) kartlar
 * 2. Yüksek zorluk skorlu kartlar
 * 3. Düşük mastery level'lı kartlar
 * 4. Yeni kartlar (hiç görülmemiş)
 * 
 * @param words - Mevcut kelime listesi
 * @param cardStates - Kart durumları (cardId -> UserCardState)
 * @param cards - Kartlar listesi
 * @param options - Seçim opsiyonları
 */
export interface SelectWordsOptions {
  /** Maksimum kelime sayısı */
  limit?: number;
  /** Sadece due kartları getir */
  dueOnly?: boolean;
  /** Yeni kart limiti (hiç görülmemiş) */
  newCardLimit?: number;
  /** Karıştır */
  shuffle?: boolean;
}

export const selectWordsForReview = (
  words: Word[],
  cardStates: Record<string, UserCardState>,
  cards: Card[],
  options: SelectWordsOptions = {}
): Word[] => {
  const {
    limit = 20,
    dueOnly = false,
    newCardLimit = 5,
    shuffle = true,
  } = options;

  // Word ID -> Word map oluştur
  const wordMap = new Map(words.map(w => [w.id, w]));
  
  // Card -> Word ID map oluştur
  const cardToWordId = new Map(cards.map(c => [c.id, c.wordId]));
  
  // Mevcut card state'lerini filtrele
  const relevantStates = Object.values(cardStates).filter(state => {
    const wordId = cardToWordId.get(state.cardId);
    return wordId && wordMap.has(wordId);
  });

  // Due kartları bul
  const dueStates = getDueCards(relevantStates);
  const prioritizedDueStates = prioritizeCards(dueStates);
  
  // Due word'leri al
  const dueWordIds = new Set(
    prioritizedDueStates
      .slice(0, limit)
      .map(state => cardToWordId.get(state.cardId))
      .filter((id): id is string => !!id)
  );
  
  const dueWords = words.filter(w => dueWordIds.has(w.id));
  
  if (dueOnly) {
    return shuffle ? shuffleArray(dueWords) : dueWords;
  }
  
  // Yeni kartları bul (hiç state'i olmayan veya totalReviews === 0)
  const seenWordIds = new Set(
    relevantStates
      .filter(s => s.totalReviews > 0)
      .map(s => cardToWordId.get(s.cardId))
  );
  
  const newWords = words.filter(w => !seenWordIds.has(w.id));
  const selectedNewWords = shuffle 
    ? shuffleArray(newWords).slice(0, newCardLimit)
    : newWords.slice(0, newCardLimit);
  
  // Due + Yeni kelimeleri birleştir
  const selectedWordIds = new Set([
    ...dueWords.map(w => w.id),
    ...selectedNewWords.map(w => w.id),
  ]);
  
  // Limit'e ulaşılmadıysa, diğer kartlardan ekle (zorluk sırasına göre)
  if (selectedWordIds.size < limit) {
    const allPrioritized = prioritizeCards(relevantStates);
    
    for (const state of allPrioritized) {
      if (selectedWordIds.size >= limit) break;
      
      const wordId = cardToWordId.get(state.cardId);
      if (wordId && !selectedWordIds.has(wordId)) {
        selectedWordIds.add(wordId);
      }
    }
  }
  
  // Seçilen kelimeleri döndür
  const selectedWords = words.filter(w => selectedWordIds.has(w.id));
  
  return shuffle ? shuffleArray(selectedWords) : selectedWords;
};

/**
 * Basit kelime seçimi (SM-2 state'siz)
 * Mevcut mastery ve incorrect count'a göre öncelik verir
 */
export const selectWordsSimple = (
  words: Word[],
  options: { limit?: number; prioritizeDifficult?: boolean } = {}
): Word[] => {
  const { limit = 20, prioritizeDifficult = true } = options;
  
  if (!prioritizeDifficult) {
    return shuffleArray(words).slice(0, limit);
  }
  
  // Zorluk skoruna göre sırala (düşük mastery, yüksek incorrect)
  const scored = words.map(word => ({
    word,
    score: (100 - word.mastery) + (word.incorrectCount * 10),
  }));
  
  // Skora göre sırala
  scored.sort((a, b) => b.score - a.score);
  
  // İlk yarısından rastgele seç (tamamen deterministic olmasın)
  const topHalf = scored.slice(0, Math.max(limit * 2, scored.length));
  const shuffled = shuffleArray(topHalf);
  
  return shuffled.slice(0, limit).map(s => s.word);
};

/**
 * Belirli bir word list için quiz kelimelerini seçer
 * CardStore entegrasyonu için wrapper
 */
export interface QuizSelectionResult {
  words: Word[];
  dueCount: number;
  newCount: number;
  reviewCount: number;
}

export const prepareQuizWords = (
  words: Word[],
  cardStates: Record<string, UserCardState>,
  cards: Card[],
  options: SelectWordsOptions = {}
): QuizSelectionResult => {
  const selectedWords = selectWordsForReview(words, cardStates, cards, options);
  
  // Word ID -> Word map
  const wordMap = new Map(words.map(w => [w.id, w]));
  
  // Card -> Word ID map
  const cardToWordId = new Map(cards.map(c => [c.id, c.wordId]));
  
  // Kategorileri say
  let dueCount = 0;
  let newCount = 0;
  let reviewCount = 0;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  selectedWords.forEach(word => {
    const card = cards.find(c => c.wordId === word.id);
    if (!card) {
      newCount++;
      return;
    }
    
    const state = cardStates[card.id];
    if (!state || state.totalReviews === 0) {
      newCount++;
    } else {
      const nextReview = new Date(state.nextReviewDate);
      nextReview.setHours(0, 0, 0, 0);
      
      if (nextReview <= today) {
        dueCount++;
      } else {
        reviewCount++;
      }
    }
  });
  
  return {
    words: selectedWords,
    dueCount,
    newCount,
    reviewCount,
  };
};
