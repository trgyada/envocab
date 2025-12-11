/**
 * SM-2 (SuperMemo 2) Spaced Repetition Algorithm
 * 
 * Bu dosya, SM-2 algoritmasının TypeScript implementasyonunu içerir.
 * Algoritma, her cevap sonrası kartın easiness factor (EF) ve tekrar aralığını günceller.
 * 
 * Kalite Puanları (q):
 * 0 - Yanlış: Hiç hatırlanamadı
 * 1 - Zor: Çok düşündükten sonra hatırlandı
 * 2 - İyi: Biraz düşündükten sonra hatırlandı
 * 3 - Çok Kolay: Anında hatırlandı
 */

import { 
  UserCardState, 
  QualityResponse, 
  MasteryLevel,
  ResponseRecord 
} from '../types';

// ==========================================
// SABITLER
// ==========================================

/** Minimum Easiness Factor değeri */
export const MIN_EF = 1.3;

/** Maksimum Easiness Factor değeri */
export const MAX_EF = 2.5;

/** Başlangıç Easiness Factor değeri */
export const INITIAL_EF = 2.5;

/** Başlangıç interval (gün) */
export const INITIAL_INTERVAL = 1;

/** Zorluk etkisi katsayısı (alpha) */
export const DIFFICULTY_ALPHA = 0.5;

/** Son kaç cevabı değerlendirelim */
export const RECENT_RESPONSES_COUNT = 8;

/** Mastery level için minimum tekrar sayıları */
export const MASTERY_THRESHOLDS = {
  level1: 1,   // Öğreniliyor
  level2: 3,   // Tanıdık
  level3: 5,   // Biliniyor
  level4: 7,   // İyi Biliniyor
  level5: 10,  // Ustalaşıldı
};

// ==========================================
// VARSAYILAN DEĞERLER
// ==========================================

/**
 * Yeni bir kart için varsayılan UserCardState oluşturur
 */
export const createDefaultCardState = (
  userId: string,
  cardId: string
): UserCardState => ({
  userId,
  cardId,
  easinessFactor: INITIAL_EF,
  interval: INITIAL_INTERVAL,
  repetitionCount: 0,
  lastReviewDate: null,
  nextReviewDate: new Date(),
  lapses: 0,
  totalReviews: 0,
  difficultyScore: 0.5, // Orta zorlukta başla
  masteryLevel: 0,
  recentResponses: [],
});

// ==========================================
// SM-2 ANA ALGORİTMA
// ==========================================

export interface SM2Result {
  newState: UserCardState;
  wasSuccessful: boolean;
}

const mapQualityTo05 = (quality: QualityResponse): number => {
  switch (quality) {
    case 0:
      return 0;
    case 1:
      return 3;
    case 2:
      return 4;
    case 3:
      return 5;
    default:
      return 0;
  }
};

/**
 * SM-2 algoritmasının ana fonksiyonu
 * 
 * @param currentState - Kartın mevcut durumu
 * @param quality - Kullanıcının cevap kalitesi (0-3)
 * @param responseTimeMs - Cevap süresi (milisaniye)
 * @returns Güncellenmiş kart durumu
 */
export const processReview = (
  currentState: UserCardState,
  quality: QualityResponse,
  responseTimeMs: number
): SM2Result => {
  const sm2Quality = mapQualityTo05(quality); // 0-5 skalasına çevir
  const wasSuccessful = sm2Quality >= 3; // 3-5 başarı
  
  // Yeni state'i klonla
  const newState: UserCardState = {
    ...currentState,
    lastReviewDate: new Date(),
    totalReviews: currentState.totalReviews + 1,
  };
  
  // Son cevapları güncelle
  const newResponse: ResponseRecord = {
    timestamp: new Date(),
    quality,
    responseTimeMs,
    wasCorrect: wasSuccessful,
  };
  
  newState.recentResponses = [
    newResponse,
    ...currentState.recentResponses.slice(0, RECENT_RESPONSES_COUNT - 1)
  ];
  
  // Başarısız cevap (q < 2)
  if (!wasSuccessful) {
    newState.repetitionCount = 0;
    newState.interval = 1;
    newState.lapses = currentState.lapses + 1;
  } else {
    // Başarılı cevap (q >= 2)
    if (currentState.repetitionCount === 0) {
      newState.interval = 1;
    } else if (currentState.repetitionCount === 1) {
      newState.interval = 3;
    } else {
      // interval = interval * EF
      newState.interval = Math.round(currentState.interval * currentState.easinessFactor);
    }
    
    newState.repetitionCount = currentState.repetitionCount + 1;
  }
  
  // EF (Easiness Factor) güncellemesi
  // EF' = EF + (0.1 - (3 - q) * (0.08 + (3 - q) * 0.02))  | q: 0-5 skalası
  const efDelta = 0.1 - (3 - sm2Quality) * (0.08 + (3 - sm2Quality) * 0.02);
  newState.easinessFactor = Math.max(MIN_EF, Math.min(MAX_EF, currentState.easinessFactor + efDelta));
  
  // Zorluk skorunu güncelle
  newState.difficultyScore = calculateDifficultyScore(newState);
  
  // Zorluk skoruna göre interval'i ayarla
  // Daha zor kartlar için interval kısaltılır
  const effectiveInterval = Math.max(
    1,
    Math.round(newState.interval * (1 - DIFFICULTY_ALPHA * newState.difficultyScore))
  );
  newState.interval = effectiveInterval;
  
  // Sonraki review tarihini hesapla
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + newState.interval);
  newState.nextReviewDate = nextReview;
  
  // Mastery level güncelle
  newState.masteryLevel = calculateMasteryLevel(newState);
  
  return {
    newState,
    wasSuccessful,
  };
};

// ==========================================
// ZORLUK SKORU HESAPLAMA
// ==========================================

/**
 * Kartın zorluk skorunu hesaplar (0-1 arası, 1 = çok zor)
 * 
 * Formül:
 * difficulty = w1 * wrong_rate + w2 * time_norm + w3 * lapses_norm
 * 
 * Ağırlıklar:
 * w1 = 0.5 (yanlış oranı)
 * w2 = 0.3 (cevap süresi)
 * w3 = 0.2 (unutma sayısı)
 */
export const calculateDifficultyScore = (state: UserCardState): number => {
  const { recentResponses, lapses, totalReviews } = state;
  
  if (recentResponses.length === 0) {
    return 0.5; // Varsayılan orta zorluk
  }
  
  // 1. Yanlış oranı (son N cevap)
  const wrongCount = recentResponses.filter(r => !r.wasCorrect).length;
  const wrongRate = wrongCount / recentResponses.length;
  
  // 2. Ortalama cevap süresi (normalize edilmiş)
  // 0-3 saniye: kolay, 3-6 saniye: orta, 6+ saniye: zor
  const avgResponseTime = recentResponses.reduce((sum, r) => sum + r.responseTimeMs, 0) / recentResponses.length;
  const timeNormalized = Math.min(1, avgResponseTime / 10000); // 10 saniyeye normalize
  
  // 3. Unutma oranı
  const lapsesNormalized = totalReviews > 0 
    ? Math.min(1, lapses / totalReviews) 
    : 0;
  
  // Ağırlıklı hesaplama
  const newDifficulty = 0.5 * wrongRate + 0.3 * timeNormalized + 0.2 * lapsesNormalized;
  
  // Mevcut zorlukla smooth geçiş (momentum)
  const smoothedDifficulty = 0.7 * state.difficultyScore + 0.3 * newDifficulty;
  
  return Math.max(0, Math.min(1, smoothedDifficulty));
};

// ==========================================
// MASTERY LEVEL HESAPLAMA
// ==========================================

/**
 * Kartın mastery level'ını hesaplar (0-5)
 * 
 * 0: Yeni (hiç görülmedi)
 * 1: Öğreniliyor (1-2 doğru)
 * 2: Tanıdık (3-4 doğru)
 * 3: Biliniyor (5-6 doğru, EF >= 2.0)
 * 4: İyi Biliniyor (7+ doğru, EF >= 2.3)
 * 5: Ustalaşıldı (10+ doğru, EF >= 2.5, interval >= 21 gün)
 */
export const calculateMasteryLevel = (state: UserCardState): MasteryLevel => {
  const { repetitionCount, easinessFactor, interval } = state;
  
  if (repetitionCount === 0) return 0;
  
  if (repetitionCount >= MASTERY_THRESHOLDS.level5 && easinessFactor >= 2.5 && interval >= 21) {
    return 5;
  }
  
  if (repetitionCount >= MASTERY_THRESHOLDS.level4 && easinessFactor >= 2.3) {
    return 4;
  }
  
  if (repetitionCount >= MASTERY_THRESHOLDS.level3 && easinessFactor >= 2.0) {
    return 3;
  }
  
  if (repetitionCount >= MASTERY_THRESHOLDS.level2) {
    return 2;
  }
  
  if (repetitionCount >= MASTERY_THRESHOLDS.level1) {
    return 1;
  }
  
  return 0;
};

// ==========================================
// YARDIMCI FONKSİYONLAR
// ==========================================

/**
 * Cevap süresinden kalite puanı tahmin eder
 * Kullanıcı manuel puan vermiyorsa bu fonksiyon kullanılabilir
 * 
 * @param responseTimeMs - Cevap süresi (milisaniye)
 * @param isCorrect - Cevap doğru mu?
 */
export const estimateQualityFromResponse = (
  responseTimeMs: number,
  isCorrect: boolean
): QualityResponse => {
  if (!isCorrect) {
    return 0; // Yanlış = 0
  }
  
  // Doğru cevap süresine göre kalite belirle
  if (responseTimeMs < 2000) {
    return 3; // Çok hızlı = Çok kolay
  } else if (responseTimeMs < 5000) {
    return 2; // Normal = İyi
  } else {
    return 1; // Yavaş = Zor (ama doğru)
  }
};

/**
 * Bugün review edilmesi gereken kartları filtreler
 */
export const getDueCards = (cardStates: UserCardState[]): UserCardState[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return cardStates.filter(state => {
    const nextReview = new Date(state.nextReviewDate);
    nextReview.setHours(0, 0, 0, 0);
    return nextReview <= today;
  });
};

/**
 * Kartları öncelik sırasına göre sıralar
 * 1. Gecikmiş kartlar (overdue)
 * 2. Yüksek zorluk skorlu kartlar
 * 3. Düşük mastery level'lı kartlar
 */
export const prioritizeCards = (cardStates: UserCardState[]): UserCardState[] => {
  const today = new Date();
  
  return [...cardStates].sort((a, b) => {
    // Gecikme gün sayısı
    const overdueA = Math.max(0, (today.getTime() - new Date(a.nextReviewDate).getTime()) / (1000 * 60 * 60 * 24));
    const overdueB = Math.max(0, (today.getTime() - new Date(b.nextReviewDate).getTime()) / (1000 * 60 * 60 * 24));
    
    // Gecikmiş kartlar önce
    if (overdueA !== overdueB) {
      return overdueB - overdueA;
    }
    
    // Zorluk skoruna göre (zor olanlar önce)
    if (a.difficultyScore !== b.difficultyScore) {
      return b.difficultyScore - a.difficultyScore;
    }
    
    // Mastery level'a göre (düşük olanlar önce)
    return a.masteryLevel - b.masteryLevel;
  });
};

/**
 * Mastery level'a göre renk döndürür
 */
export const getMasteryColor = (level: MasteryLevel): string => {
  const colors: Record<MasteryLevel, string> = {
    0: '#94a3b8', // Slate (Yeni)
    1: '#f87171', // Red (Öğreniliyor)
    2: '#fb923c', // Orange (Tanıdık)
    3: '#facc15', // Yellow (Biliniyor)
    4: '#4ade80', // Green (İyi Biliniyor)
    5: '#22d3ee', // Cyan (Ustalaşıldı)
  };
  return colors[level];
};

/**
 * Mastery level'a göre label döndürür
 */
export const getMasteryLabel = (level: MasteryLevel): string => {
  const labels: Record<MasteryLevel, string> = {
    0: 'Yeni',
    1: 'Öğreniliyor',
    2: 'Tanıdık',
    3: 'Biliniyor',
    4: 'İyi Biliniyor',
    5: 'Ustalaşıldı',
  };
  return labels[level];
};
