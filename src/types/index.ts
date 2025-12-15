// ==========================================
// TEMEL TİPLER
// ==========================================

// Kelime türleri
export type PartOfSpeech = 'n' | 'v' | 'adj' | 'adv' | 'prep' | 'conj' | 'pron' | 'interj' | 'det' | 'phr' | '';

// CEFR Dil Seviyeleri
export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

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
  exampleSentence?: string;
  exampleTranslation?: string;
  exampleLang?: 'en' | 'tr';
  exampleUpdatedAt?: Date;
  exampleModel?: string;
  englishDefinition?: string; // İngilizce tanım (EN→EN) - Excel'den veya AI'dan
  
  // SM-2 için ek alanlar
  difficultyLevel?: CEFRLevel; // Kelimenin zorluğu (A1-C2)
  frequencyRank?: number; // Corpus frekans sıralaması
  tags?: string[]; // Etiketler: "Business", "IT", "Academic" vb.
}

// ==========================================
// SENSE (Anlam) - Gelecekte çoklu anlam desteği için
// ==========================================
export interface Sense {
  id: string;
  wordId: string;
  definition: string; // İngilizce tanım
  translation: string; // Türkçe karşılık
  usageNotes?: string; // Kullanım notları
  exampleSentences?: string[]; // Örnek cümleler
}

// ==========================================
// CARD (Öğrenme Kartı) - SM-2 Temel Birimi
// ==========================================
export type CardFrontType = 'word' | 'definition' | 'example_gap' | 'translation' | 'audio';
export type CardBackType = 'translation' | 'word' | 'definition' | 'example';

export interface Card {
  id: string;
  wordId: string;
  senseId?: string; // Opsiyonel: belirli bir anlam için
  
  frontType: CardFrontType;
  backType: CardBackType;
  frontContent: string;
  backContent: string;
  
  createdAt: Date;
}

// ==========================================
// USER CARD STATE - Kullanıcıya Özel Öğrenme Durumu
// ==========================================
export interface UserCardState {
  userId: string;
  cardId: string;
  
  // SM-2 Temel Parametreleri
  easinessFactor: number; // EF: 1.3 - 2.5 arası, başlangıç 2.5
  interval: number; // Gün cinsinden tekrar aralığı
  repetitionCount: number; // Başarılı tekrar sayısı
  
  // Tarih Bilgileri
  lastReviewDate: Date | null;
  nextReviewDate: Date; // Bir sonraki tekrar tarihi
  
  // İstatistikler
  lapses: number; // Unutma sayısı (yanlış cevaplar)
  totalReviews: number; // Toplam review sayısı
  
  // Zorluk Skoru (0-1 arası, 1 = çok zor)
  difficultyScore: number;
  
  // Mastery Level (0-5 seviyeleri)
  masteryLevel: MasteryLevel;
  
  // Son N cevabın geçmişi (difficulty hesaplama için)
  recentResponses: ResponseRecord[];
  
  // YENİ: SM-2+ Gelişmiş Alanlar
  consecutiveCorrect?: number; // Ardışık doğru sayısı (streak)
  consecutiveWrong?: number; // Ardışık yanlış sayısı
  isLeech?: boolean; // Sürekli unutulan kart mı?
  confidenceScore?: number; // Güven skoru (0-1)
  bestStudyHour?: number | null; // En iyi çalışma saati (0-23)
  lastStudyHour?: number | null; // Son çalışma saati
}

// Mastery seviyeleri
export type MasteryLevel = 0 | 1 | 2 | 3 | 4 | 5;
// 0: Yeni (hiç görülmedi)
// 1: Öğreniliyor (1-2 doğru)
// 2: Tanıdık (3-4 doğru)
// 3: Biliniyor (5-6 doğru, EF >= 2.0)
// 4: İyi Biliniyor (7+ doğru, EF >= 2.3)
// 5: Ustalaşıldı (10+ doğru, EF >= 2.5, interval >= 21 gün)

// Son cevapların kaydı
export interface ResponseRecord {
  timestamp: Date;
  quality: QualityResponse; // 0-3 arası
  responseTimeMs: number;
  wasCorrect: boolean;
}

// ==========================================
// REVIEW LOG - Her Soru-Cevap Kaydı
// ==========================================
export type QualityResponse = 0 | 1 | 2 | 3;
// 0: Yanlış (hatırlanamadı)
// 1: Zor (çok düşündükten sonra hatırlandı)
// 2: İyi (biraz düşündükten sonra hatırlandı)
// 3: Çok Kolay (anında hatırlandı)

export type QuestionContext = 'mobile' | 'web' | 'desktop';

export interface ReviewLog {
  id: string;
  userId: string;
  cardId: string;
  wordId: string;
  
  timestamp: Date;
  responseTimeMs: number; // Cevap süresi (milisaniye)
  quality: QualityResponse; // Kalite puanı (0-3)
  
  questionType: QuizType; // Soru tipi
  wasCorrect: boolean;
  
  // Önceki ve sonraki durum (delta tracking)
  previousEF?: number;
  newEF?: number;
  previousInterval?: number;
  newInterval?: number;
  
  context?: QuestionContext;
}

// ==========================================
// REVIEW SESSION - Quiz Oturumu
// ==========================================
export interface ReviewSession {
  id: string;
  userId: string;
  wordListId: string;
  
  startTime: Date;
  endTime?: Date;
  
  // Oturum istatistikleri
  totalCards: number;
  reviewedCards: number;
  correctCount: number;
  incorrectCount: number;
  
  // Detaylı loglar
  logs: ReviewLog[];
  
  // Ortalama metrikler
  averageResponseTimeMs?: number;
  averageQuality?: number;
  
  isComplete: boolean;
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

// Quiz soru yönü
export type QuizDirection = 'en-to-tr' | 'tr-to-en' | 'mixed';

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
  direction?: 'en-to-tr' | 'tr-to-en'; // Bu sorunun yönü (karışık modda her soru için farklı olabilir)
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
