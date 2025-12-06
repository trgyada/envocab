import { Word, QuizQuestion, QuizType, MatchingCard, MatchingPair } from '../types';
import { v4 as uuidv4 } from 'uuid';

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
 */
export const generateMultipleChoiceQuestion = (
  word: Word,
  allWords: Word[],
  isEnglishToTurkish: boolean = true
): QuizQuestion => {
  const question = isEnglishToTurkish ? word.english : word.turkish;
  const correctAnswer = isEnglishToTurkish ? word.turkish : word.english;

  // Yanlış şıkları seç (doğru cevap hariç ve tekrar etmeyen)
  const otherWords = allWords.filter((w) => w.id !== word.id);
  const shuffledOthers = shuffleArray(otherWords);
  
  // 3 yanlış şık + 1 doğru cevap - tekrar eden cevapları filtrele
  const usedAnswers = new Set<string>([correctAnswer.toLowerCase().trim()]);
  const wrongOptions: string[] = [];
  
  for (const w of shuffledOthers) {
    const option = isEnglishToTurkish ? w.turkish : w.english;
    const normalizedOption = option.toLowerCase().trim();
    
    // Eğer bu cevap daha önce kullanılmadıysa ekle
    if (!usedAnswers.has(normalizedOption)) {
      usedAnswers.add(normalizedOption);
      wrongOptions.push(option);
      
      // 3 yanlış şık yeterli
      if (wrongOptions.length >= 3) break;
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
  };
};

/**
 * Çoktan seçmeli quiz soruları oluşturur
 */
export const generateMultipleChoiceQuiz = (
  words: Word[],
  count?: number,
  isEnglishToTurkish: boolean = true
): QuizQuestion[] => {
  const shuffledWords = shuffleArray(words);
  const quizWords = count ? shuffledWords.slice(0, count) : shuffledWords;
  
  return quizWords.map((word) =>
    generateMultipleChoiceQuestion(word, words, isEnglishToTurkish)
  );
};

/**
 * Flashcard soruları oluşturur
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

  // İngilizce ve Türkçe kartları oluştur
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
 * Yazma soruları oluşturur
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
export const generateMixedQuiz = (words: Word[], count?: number, isEnglishToTurkish: boolean = true): QuizQuestion[] => {
  const shuffledWords = shuffleArray(words);
  const quizWords = count ? shuffledWords.slice(0, count) : shuffledWords;

  return quizWords.map((word, index) => {
    const questionTypes: QuizType[] = ['multiple-choice', 'flashcard', 'write'];
    const selectedType = questionTypes[index % questionTypes.length];

    switch (selectedType) {
      case 'multiple-choice':
        return generateMultipleChoiceQuestion(word, words, isEnglishToTurkish);
      case 'flashcard':
        return {
          id: uuidv4(),
          word,
          questionType: 'flashcard' as const,
          question: isEnglishToTurkish ? word.english : word.turkish,
          correctAnswer: isEnglishToTurkish ? word.turkish : word.english,
        };
      case 'write':
        return {
          id: uuidv4(),
          word,
          questionType: 'write' as const,
          question: isEnglishToTurkish ? word.english : word.turkish,
          correctAnswer: isEnglishToTurkish ? word.turkish : word.english,
        };
      default:
        return generateMultipleChoiceQuestion(word, words, isEnglishToTurkish);
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
 * Quiz tipine göre soru oluşturur
 */
export const generateQuiz = (
  words: Word[],
  type: QuizType,
  count?: number,
  isEnglishToTurkish: boolean = true
): QuizQuestion[] => {
  switch (type) {
    case 'multiple-choice':
      return generateMultipleChoiceQuiz(words, count, isEnglishToTurkish);
    case 'flashcard':
      return generateFlashcardQuiz(words, count);
    case 'write':
      return generateWriteQuiz(words, count);
    case 'matching':
      // Matching için multiple-choice kullan (matching component kendi içinde yönetiyor)
      return generateMultipleChoiceQuiz(words, count, isEnglishToTurkish);
    default:
      return generateMultipleChoiceQuiz(words, count, isEnglishToTurkish);
  }
};

/**
 * Skoru hesaplar
 */
export const calculateScore = (correct: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
};