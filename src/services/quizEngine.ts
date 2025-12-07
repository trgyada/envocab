import { Word, QuizQuestion, QuizType, MatchingCard, MatchingPair, UserCardState, Card } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { prioritizeCards, getDueCards } from './sm2Algorithm';

/**
 * Diziyi karıştırır (Fisher-Yates shuffle)
 */
export const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
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

  // Yanlış şıkları seç (doğru cevap hariç, tekrar yok, anlamca yakın olanlara öncelik)
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

  // Hâlâ eksikse rastgele tamamla
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
