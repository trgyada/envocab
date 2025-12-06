// Analytics Service - İstatistik hesaplamaları için yardımcı fonksiyonlar

import { QuizResult, Word, DailyProgress, WordMasteryData } from '../types';

/**
 * Günlük ilerleme verilerini hesaplar
 */
export const calculateDailyProgress = (
  results: QuizResult[],
  days: number = 7
): DailyProgress[] => {
  const progress: DailyProgress[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const dayResults = results.filter((r) => {
      const resultDate = new Date(r.completedAt).toISOString().split('T')[0];
      return resultDate === dateStr;
    });

    const wordsStudied = dayResults.reduce((sum, r) => sum + r.totalQuestions, 0);
    const avgScore =
      dayResults.length > 0
        ? Math.round(dayResults.reduce((sum, r) => sum + r.score, 0) / dayResults.length)
        : 0;

    progress.push({
      date: dateStr,
      quizCount: dayResults.length,
      wordsStudied,
      averageScore: avgScore,
    });
  }

  return progress;
};

/**
 * Kelime öğrenme seviyelerini hesaplar
 */
export const calculateWordMastery = (words: Word[]): WordMasteryData[] => {
  const levels = {
    'Başlangıç (0-25%)': 0,
    'Gelişen (26-50%)': 0,
    'Orta (51-75%)': 0,
    'İleri (76-100%)': 0,
  };

  words.forEach((word) => {
    if (word.mastery <= 25) {
      levels['Başlangıç (0-25%)']++;
    } else if (word.mastery <= 50) {
      levels['Gelişen (26-50%)']++;
    } else if (word.mastery <= 75) {
      levels['Orta (51-75%)']++;
    } else {
      levels['İleri (76-100%)']++;
    }
  });

  return Object.entries(levels).map(([level, count]) => ({
    level,
    count,
  }));
};

/**
 * En zayıf kelimeleri bulur
 */
export const findWeakWords = (words: Word[], limit: number = 10): Word[] => {
  return [...words]
    .filter((w) => w.correctCount + w.incorrectCount > 0) // En az bir kez çalışılmış
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, limit);
};

/**
 * En güçlü kelimeleri bulur
 */
export const findStrongWords = (words: Word[], limit: number = 10): Word[] => {
  return [...words]
    .filter((w) => w.correctCount + w.incorrectCount > 0)
    .sort((a, b) => b.mastery - a.mastery)
    .slice(0, limit);
};

/**
 * Haftalık skor ortalaması hesaplar
 */
export const calculateWeeklyAverage = (results: QuizResult[]): number => {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const weeklyResults = results.filter(
    (r) => new Date(r.completedAt) >= weekAgo
  );

  if (weeklyResults.length === 0) return 0;

  const total = weeklyResults.reduce((sum, r) => sum + r.score, 0);
  return Math.round(total / weeklyResults.length);
};

/**
 * Çalışma süresi formatlar
 */
export const formatStudyTime = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes} dakika`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours} saat ${mins} dakika`;
};