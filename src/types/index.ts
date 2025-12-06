// Kelime türleri
export type PartOfSpeech = 'n' | 'v' | 'adj' | 'adv' | 'prep' | 'conj' | 'pron' | 'interj' | 'det' | 'phr' | '';

// Kelime çifti - Excel'den gelen veri yapısı
export interface Word {
  id: string;
  english: string;
  turkish: string;
  partOfSpeech?: PartOfSpeech; // Kelime türü: n=noun, v=verb, adj=adjective vb.
  mastery: number; // 0-100 arası öğrenme seviyesi
  correctCount: number;
  incorrectCount: number;
  lastPracticed?: Date;
}

// Kelime listesi
export interface WordList {
  id: string;
  title: string;
  description?: string;
  words: Word[];
  createdAt: Date;
  updatedAt: Date;
}

// Quiz sorusu
export interface QuizQuestion {
  id: string;
  word: Word;
  questionType: 'multiple-choice' | 'matching' | 'flashcard' | 'write';
  question: string;
  options?: string[];
  correctAnswer: string;
  userAnswer?: string;
  isCorrect?: boolean;
}

// Quiz oturumu
export interface QuizSession {
  id: string;
  wordListId: string;
  quizType: QuizType;
  questions: QuizQuestion[];
  currentIndex: number;
  startTime: Date;
  endTime?: Date;
  isComplete: boolean;
}

// Quiz tipleri
export type QuizType = 'multiple-choice' | 'matching' | 'flashcard' | 'write';

// Quiz sonucu
export interface QuizResult {
  id: string;
  sessionId: string;
  wordListId: string;
  wordListTitle: string;
  quizType: QuizType;
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  score: number; // Yüzde
  duration: number; // Saniye
  completedAt: Date;
  wrongWords: Word[]; // Yanlış yapılan kelimeler
}

// Kullanıcı istatistikleri
export interface UserStats {
  totalQuizzes: number;
  totalWords: number;
  averageScore: number;
  bestScore: number;
  totalStudyTime: number; // Dakika
  streakDays: number;
  lastStudyDate?: Date;
}

// Analiz verileri
export interface AnalyticsData {
  dailyProgress: DailyProgress[];
  wordMastery: WordMasteryData[];
  quizHistory: QuizResult[];
  weakWords: Word[]; // En çok yanlış yapılan kelimeler
  strongWords: Word[]; // En iyi bilinen kelimeler
}

export interface DailyProgress {
  date: string;
  quizCount: number;
  wordsStudied: number;
  averageScore: number;
}

export interface WordMasteryData {
  level: string;
  count: number;
}

// Eşleştirme oyunu için
export interface MatchingPair {
  id: string;
  english: string;
  turkish: string;
  isMatched: boolean;
}

export interface MatchingCard {
  id: string;
  text: string;
  type: 'english' | 'turkish';
  pairId: string;
  isSelected: boolean;
  isMatched: boolean;
}