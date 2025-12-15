/**
 * SM-2+ Enhanced Spaced Repetition Algorithm
 * 
 * Bu dosya, SM-2 algoritmasının geliştirilmiş TypeScript implementasyonunu içerir.
 * Orijinal SM-2'ye ek olarak şu özellikler eklenmiştir:
 * 
 * 🧠 Leech Detection: Sürekli unutulan kelimeleri tespit eder
 * ⏰ Optimal Review Time: Günün saatine göre optimal tekrar önerir
 * 📉 Forgetting Curve: Ebbinghaus unutma eğrisi entegrasyonu
 * 🎯 Adaptive Learning: Kullanıcıya özel öğrenme hızı
 * 📅 Fuzzy Due Dates: Esnek tekrar zamanları (sıkışıklığı önler)
 * 💪 Confidence Weighting: Güven bazlı ağırlıklandırma
 * 🔥 Streak Bonus: Ardışık doğru cevaplara bonus
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
// YENİ: GELİŞMİŞ ALGORİTMA SABİTLERİ
// ==========================================

/** Leech (sülük) eşiği - bu kadar ardışık hata = leech */
export const LEECH_THRESHOLD = 4;

/** Streak bonus maksimum çarpanı */
export const MAX_STREAK_BONUS = 1.5;

/** Fuzzy interval yüzdesi (±%10) */
export const FUZZY_INTERVAL_PERCENT = 0.1;

/** Minimum güven skoru */
export const MIN_CONFIDENCE = 0.1;

/** Maksimum güven skoru */
export const MAX_CONFIDENCE = 1.0;

/** Unutma eğrisi sabiti (Ebbinghaus) */
export const FORGETTING_CURVE_CONSTANT = 1.84;

/** Optimal çalışma saatleri */
export const OPTIMAL_STUDY_HOURS = {
  morning: { start: 9, end: 11, bonus: 1.1 },
  afternoon: { start: 14, end: 16, bonus: 1.05 },
  evening: { start: 19, end: 21, bonus: 1.0 },
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
  // Yeni alanlar
  consecutiveCorrect: 0,
  consecutiveWrong: 0,
  isLeech: false,
  confidenceScore: 0.5,
  bestStudyHour: null,
  lastStudyHour: null,
});

// ==========================================
// YENİ: GELİŞMİŞ YARDIMCI FONKSİYONLAR
// ==========================================

/**
 * Streak (ardışık doğru) bonusu hesaplar
 * Ardışık doğru cevaplara interval bonusu verir
 */
export const calculateStreakBonus = (consecutiveCorrect: number): number => {
  if (consecutiveCorrect <= 1) return 1.0;
  // Her ardışık doğru için %5 bonus, max %50
  const bonus = 1 + (consecutiveCorrect - 1) * 0.05;
  return Math.min(bonus, MAX_STREAK_BONUS);
};

/**
 * Fuzzy interval hesaplar (±%10 rastgelelik)
 * Tüm kartların aynı güne yığılmasını önler
 */
export const applyFuzzyInterval = (interval: number): number => {
  if (interval <= 1) return interval;
  const fuzz = interval * FUZZY_INTERVAL_PERCENT;
  const randomOffset = (Math.random() * 2 - 1) * fuzz; // -fuzz ile +fuzz arası
  return Math.max(1, Math.round(interval + randomOffset));
};

/**
 * Leech (sülük) tespiti
 * Çok fazla ardışık hata yapan kartları tespit eder
 */
export const detectLeech = (consecutiveWrong: number, lapses: number): boolean => {
  return consecutiveWrong >= LEECH_THRESHOLD || lapses >= LEECH_THRESHOLD * 2;
};

/**
 * Güven skoru hesaplar (son cevaplara göre)
 * Yüksek güven = daha uzun interval
 */
export const calculateConfidenceScore = (recentResponses: ResponseRecord[]): number => {
  if (recentResponses.length === 0) return 0.5;
  
  // Son cevapların kalitelerini ağırlıklı ortala (yeniler daha önemli)
  let weightedSum = 0;
  let weightTotal = 0;
  
  recentResponses.forEach((response, index) => {
    const weight = 1 / (index + 1); // Yeni cevaplar daha ağırlıklı
    const qualityNorm = response.quality / 3; // 0-1 arası normalize
    weightedSum += qualityNorm * weight;
    weightTotal += weight;
  });
  
  const confidence = weightedSum / weightTotal;
  return Math.max(MIN_CONFIDENCE, Math.min(MAX_CONFIDENCE, confidence));
};

/**
 * Unutma eğrisi tahmini (Ebbinghaus)
 * Belirli bir süre sonra kartın unutulma olasılığını hesaplar
 */
export const calculateRetentionProbability = (
  daysSinceReview: number,
  memoryStrength: number // EF ile ilişkili
): number => {
  // R = e^(-t/S) formülü, S = memory strength
  const S = memoryStrength * FORGETTING_CURVE_CONSTANT;
  return Math.exp(-daysSinceReview / S);
};

/**
 * Optimal review zamanı önerir
 * Retention ~%90 olduğunda tekrar etmek en verimli
 */
export const calculateOptimalReviewDay = (memoryStrength: number): number => {
  // R = 0.9 için t değerini bul: t = -S * ln(0.9)
  const S = memoryStrength * FORGETTING_CURVE_CONSTANT;
  const optimalDay = -S * Math.log(0.9);
  return Math.max(1, Math.round(optimalDay));
};

/**
 * Günün saatine göre çalışma bonusu
 */
export const getTimeOfDayBonus = (hour?: number): number => {
  const currentHour = hour ?? new Date().getHours();
  
  if (currentHour >= OPTIMAL_STUDY_HOURS.morning.start && 
      currentHour < OPTIMAL_STUDY_HOURS.morning.end) {
    return OPTIMAL_STUDY_HOURS.morning.bonus;
  }
  if (currentHour >= OPTIMAL_STUDY_HOURS.afternoon.start && 
      currentHour < OPTIMAL_STUDY_HOURS.afternoon.end) {
    return OPTIMAL_STUDY_HOURS.afternoon.bonus;
  }
  if (currentHour >= OPTIMAL_STUDY_HOURS.evening.start && 
      currentHour < OPTIMAL_STUDY_HOURS.evening.end) {
    return OPTIMAL_STUDY_HOURS.evening.bonus;
  }
  return 1.0;
};

// ==========================================
// SM-2+ GELİŞMİŞ ANA ALGORİTMA
// ==========================================

export interface SM2Result {
  newState: UserCardState;
  wasSuccessful: boolean;
  isLeech: boolean;
  retentionProbability: number;
  streakBonus: number;
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
 * SM-2+ Gelişmiş algoritmanın ana fonksiyonu
 * 
 * Yenilikler:
 * - Streak bonus: Ardışık doğrulara interval bonusu
 * - Fuzzy dates: Rastgele ±%10 interval sapması
 * - Leech detection: Sürekli unutulan kartları işaretle
 * - Confidence weighting: Güven bazlı interval ayarı
 * - Time-of-day bonus: Optimal saatlerde çalışmaya bonus
 * 
 * @param currentState - Kartın mevcut durumu
 * @param quality - Kullanıcının cevap kalitesi (0-3)
 * @param responseTimeMs - Cevap süresi (milisaniye)
 * @returns Güncellenmiş kart durumu ve metadata
 */
export const processReview = (
  currentState: UserCardState,
  quality: QualityResponse,
  responseTimeMs: number
): SM2Result => {
  const sm2Quality = mapQualityTo05(quality); // 0-5 skalasına çevir
  const wasSuccessful = sm2Quality >= 3; // 3-5 başarı
  const currentHour = new Date().getHours();
  
  // Yeni state'i klonla
  const newState: UserCardState = {
    ...currentState,
    lastReviewDate: new Date(),
    totalReviews: currentState.totalReviews + 1,
    lastStudyHour: currentHour,
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
  
  // Streak takibi
  if (wasSuccessful) {
    newState.consecutiveCorrect = (currentState.consecutiveCorrect || 0) + 1;
    newState.consecutiveWrong = 0;
  } else {
    newState.consecutiveWrong = (currentState.consecutiveWrong || 0) + 1;
    newState.consecutiveCorrect = 0;
  }
  
  // Streak bonusu hesapla
  const streakBonus = calculateStreakBonus(newState.consecutiveCorrect || 0);
  
  // Başarısız cevap (q < 3)
  if (!wasSuccessful) {
    newState.repetitionCount = 0;
    newState.interval = 1;
    newState.lapses = currentState.lapses + 1;
  } else {
    // Başarılı cevap (q >= 3)
    if (currentState.repetitionCount === 0) {
      newState.interval = 1;
    } else if (currentState.repetitionCount === 1) {
      newState.interval = 3;
    } else {
      // interval = interval * EF * streakBonus
      const baseInterval = currentState.interval * currentState.easinessFactor;
      newState.interval = Math.round(baseInterval * streakBonus);
    }
    
    newState.repetitionCount = currentState.repetitionCount + 1;
  }
  
  // EF (Easiness Factor) güncellemesi
  // EF' = EF + (0.1 - (3 - q) * (0.08 + (3 - q) * 0.02))  | q: 0-5 skalası
  const efDelta = 0.1 - (3 - sm2Quality) * (0.08 + (3 - sm2Quality) * 0.02);
  newState.easinessFactor = Math.max(MIN_EF, Math.min(MAX_EF, currentState.easinessFactor + efDelta));
  
  // Zorluk skorunu güncelle
  newState.difficultyScore = calculateDifficultyScore(newState);
  
  // Güven skorunu güncelle
  newState.confidenceScore = calculateConfidenceScore(newState.recentResponses);
  
  // Zorluk skoruna göre interval'i ayarla
  // Daha zor kartlar için interval kısaltılır
  // Güven skoru yüksekse interval uzatılır
  const difficultyMultiplier = 1 - DIFFICULTY_ALPHA * newState.difficultyScore;
  const confidenceMultiplier = 0.8 + (newState.confidenceScore || 0.5) * 0.4; // 0.8 - 1.2 arası
  
  let effectiveInterval = Math.max(
    1,
    Math.round(newState.interval * difficultyMultiplier * confidenceMultiplier)
  );
  
  // Günün saatine göre bonus (sadece başarılı cevaplarda)
  if (wasSuccessful) {
    const timeBonus = getTimeOfDayBonus(currentHour);
    effectiveInterval = Math.round(effectiveInterval * timeBonus);
    
    // En iyi çalışma saatini kaydet
    if (quality === 3 && (!newState.bestStudyHour || Math.random() > 0.7)) {
      newState.bestStudyHour = currentHour;
    }
  }
  
  // Fuzzy interval uygula (yığılmayı önle)
  newState.interval = applyFuzzyInterval(effectiveInterval);
  
  // Leech tespiti
  const isLeech = detectLeech(newState.consecutiveWrong || 0, newState.lapses);
  newState.isLeech = isLeech;
  
  // Leech ise interval'i daha da kısalt
  if (isLeech) {
    newState.interval = Math.max(1, Math.floor(newState.interval / 2));
  }
  
  // Sonraki review tarihini hesapla
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + newState.interval);
  newState.nextReviewDate = nextReview;
  
  // Mastery level güncelle
  newState.masteryLevel = calculateMasteryLevel(newState);
  
  // Retention probability hesapla (bilgi amaçlı)
  const retentionProbability = calculateRetentionProbability(0, newState.easinessFactor);
  
  return {
    newState,
    wasSuccessful,
    isLeech,
    retentionProbability,
    streakBonus,
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

// ==========================================
// YENİ: GELİŞMİŞ ÖNCELİKLENDİRME VE ANALİZ
// ==========================================

/**
 * Gelişmiş kart önceliklendirme
 * Leech kartları, düşük güven, gecikme ve zorluk skorlarını hesaba katar
 */
export const prioritizeCardsEnhanced = (cardStates: UserCardState[]): UserCardState[] => {
  const today = new Date();
  const currentHour = today.getHours();
  
  return [...cardStates].sort((a, b) => {
    // 1. Leech kartlar EN ÖNCE (özel dikkat gerekiyor)
    if (a.isLeech !== b.isLeech) {
      return a.isLeech ? -1 : 1;
    }
    
    // 2. Gecikme gün sayısı
    const overdueA = Math.max(0, (today.getTime() - new Date(a.nextReviewDate).getTime()) / (1000 * 60 * 60 * 24));
    const overdueB = Math.max(0, (today.getTime() - new Date(b.nextReviewDate).getTime()) / (1000 * 60 * 60 * 24));
    
    if (Math.abs(overdueA - overdueB) > 0.5) {
      return overdueB - overdueA;
    }
    
    // 3. Düşük güven skoru önce
    const confA = a.confidenceScore || 0.5;
    const confB = b.confidenceScore || 0.5;
    if (Math.abs(confA - confB) > 0.1) {
      return confA - confB;
    }
    
    // 4. Optimal çalışma saatine yakınlık (kullanıcının en iyi saati)
    const hourDiffA = a.bestStudyHour != null ? Math.abs(currentHour - a.bestStudyHour) : 12;
    const hourDiffB = b.bestStudyHour != null ? Math.abs(currentHour - b.bestStudyHour) : 12;
    if (Math.abs(hourDiffA - hourDiffB) > 2) {
      return hourDiffA - hourDiffB;
    }
    
    // 5. Zorluk skoruna göre (zor olanlar önce)
    if (a.difficultyScore !== b.difficultyScore) {
      return b.difficultyScore - a.difficultyScore;
    }
    
    // 6. Mastery level'a göre (düşük olanlar önce)
    return a.masteryLevel - b.masteryLevel;
  });
};

/**
 * Leech kartları filtreler
 */
export const getLeechCards = (cardStates: UserCardState[]): UserCardState[] => {
  return cardStates.filter(state => state.isLeech);
};

/**
 * Kart sağlığı raporu oluşturur
 */
export interface CardHealthReport {
  totalCards: number;
  dueToday: number;
  overdue: number;
  leechCount: number;
  averageConfidence: number;
  averageMastery: number;
  estimatedStudyTimeMinutes: number;
  recommendations: string[];
}

export const generateCardHealthReport = (cardStates: UserCardState[]): CardHealthReport => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dueCards = cardStates.filter(state => {
    const nextReview = new Date(state.nextReviewDate);
    nextReview.setHours(0, 0, 0, 0);
    return nextReview <= today;
  });
  
  const overdueCards = cardStates.filter(state => {
    const nextReview = new Date(state.nextReviewDate);
    nextReview.setHours(0, 0, 0, 0);
    const daysOverdue = (today.getTime() - nextReview.getTime()) / (1000 * 60 * 60 * 24);
    return daysOverdue > 1;
  });
  
  const leechCards = cardStates.filter(state => state.isLeech);
  
  const avgConfidence = cardStates.length > 0
    ? cardStates.reduce((sum, s) => sum + (s.confidenceScore || 0.5), 0) / cardStates.length
    : 0.5;
    
  const avgMastery = cardStates.length > 0
    ? cardStates.reduce((sum, s) => sum + s.masteryLevel, 0) / cardStates.length
    : 0;
  
  // Tahmini çalışma süresi (kart başına ortalama 15 saniye)
  const estimatedMinutes = Math.ceil(dueCards.length * 0.25);
  
  // Öneriler
  const recommendations: string[] = [];
  
  if (overdueCards.length > 10) {
    recommendations.push(`⚠️ ${overdueCards.length} gecikmiş kart var. Bugün çalışmaya başla!`);
  }
  
  if (leechCards.length > 0) {
    recommendations.push(`🩸 ${leechCards.length} "sülük" kart var. Bunları farklı yöntemlerle çalış.`);
  }
  
  if (avgConfidence < 0.4) {
    recommendations.push('💡 Güven skorun düşük. Daha sık tekrar yap.');
  }
  
  if (avgMastery < 2) {
    recommendations.push('📚 Kelime hakimiyetin gelişiyor. Devam et!');
  } else if (avgMastery >= 4) {
    recommendations.push('🌟 Harika! Yeni kelimeler ekleyebilirsin.');
  }
  
  const currentHour = new Date().getHours();
  if (currentHour >= 9 && currentHour < 11) {
    recommendations.push('☀️ Sabah çalışması için ideal zaman!');
  }
  
  return {
    totalCards: cardStates.length,
    dueToday: dueCards.length,
    overdue: overdueCards.length,
    leechCount: leechCards.length,
    averageConfidence: avgConfidence,
    averageMastery: avgMastery,
    estimatedStudyTimeMinutes: estimatedMinutes,
    recommendations,
  };
};

/**
 * Günlük çalışma planı oluşturur
 */
export interface DailyStudyPlan {
  newCards: UserCardState[];
  reviewCards: UserCardState[];
  leechCards: UserCardState[];
  totalEstimatedMinutes: number;
  suggestedSessions: { time: string; cardCount: number }[];
}

export const generateDailyStudyPlan = (
  cardStates: UserCardState[],
  maxNewCardsPerDay: number = 10,
  maxReviewsPerDay: number = 50
): DailyStudyPlan => {
  const dueCards = getDueCards(cardStates);
  const prioritized = prioritizeCardsEnhanced(dueCards);
  
  // Leech kartları ayır
  const leechCards = prioritized.filter(c => c.isLeech).slice(0, 5);
  const normalCards = prioritized.filter(c => !c.isLeech);
  
  // Yeni ve review kartları ayır
  const newCards = normalCards
    .filter(c => c.repetitionCount === 0)
    .slice(0, maxNewCardsPerDay);
    
  const reviewCards = normalCards
    .filter(c => c.repetitionCount > 0)
    .slice(0, maxReviewsPerDay);
  
  const totalCards = newCards.length + reviewCards.length + leechCards.length;
  const totalMinutes = Math.ceil(totalCards * 0.25);
  
  // Oturum önerileri
  const suggestedSessions: { time: string; cardCount: number }[] = [];
  
  if (totalCards > 0) {
    if (totalCards <= 15) {
      suggestedSessions.push({ time: '09:00-09:15', cardCount: totalCards });
    } else if (totalCards <= 30) {
      suggestedSessions.push({ time: '09:00-09:15', cardCount: Math.ceil(totalCards / 2) });
      suggestedSessions.push({ time: '19:00-19:15', cardCount: Math.floor(totalCards / 2) });
    } else {
      suggestedSessions.push({ time: '09:00-09:15', cardCount: 15 });
      suggestedSessions.push({ time: '14:00-14:15', cardCount: 15 });
      suggestedSessions.push({ time: '19:00-19:20', cardCount: totalCards - 30 });
    }
  }
  
  return {
    newCards,
    reviewCards,
    leechCards,
    totalEstimatedMinutes: totalMinutes,
    suggestedSessions,
  };
};

/**
 * Haftalık ilerleme tahmini
 */
export const predictWeeklyProgress = (
  cardStates: UserCardState[],
  averageCardsPerDay: number = 20
): { day: number; masteredCards: number; dueCards: number }[] => {
  const predictions: { day: number; masteredCards: number; dueCards: number }[] = [];
  const today = new Date();
  
  for (let day = 0; day < 7; day++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + day);
    targetDate.setHours(0, 0, 0, 0);
    
    const dueOnDay = cardStates.filter(state => {
      const nextReview = new Date(state.nextReviewDate);
      nextReview.setHours(0, 0, 0, 0);
      return nextReview.getTime() === targetDate.getTime();
    }).length;
    
    const masteredByDay = cardStates.filter(state => 
      state.masteryLevel >= 4
    ).length + Math.floor(day * averageCardsPerDay * 0.1); // Tahmini artış
    
    predictions.push({
      day,
      masteredCards: Math.min(masteredByDay, cardStates.length),
      dueCards: dueOnDay,
    });
  }
  
  return predictions;
};
