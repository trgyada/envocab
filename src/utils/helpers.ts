/**
 * Metni formatlar - fazla boşlukları temizler
 */
export const formatText = (text: string): string => {
  return text.trim().replace(/\s+/g, ' ');
};

/**
 * Skor hesaplar (yüzde olarak)
 */
export const calculateScore = (correctAnswers: number, totalQuestions: number): number => {
  return totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
};

/**
 * Diziyi karıştırır (Fisher-Yates)
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
 * UUID benzeri benzersiz ID üretir
 */
export const generateId = (): string => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

/**
 * Tarihi formatlar (Türkçe)
 */
export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/**
 * Süreyi formatlar
 */
export const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds} saniye`;
  }
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes} dakika ${secs} saniye`;
};

/**
 * Metni normalleştirir (karşılaştırma için)
 */
export const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:'"()-]/g, '')
    .replace(/\s+/g, ' ');
};

/**
 * İki metni karşılaştırır
 */
export const compareTexts = (text1: string, text2: string): boolean => {
  return normalizeText(text1) === normalizeText(text2);
};

/**
 * Yüzdeye göre renk döndürür
 */
export const getScoreColor = (score: number): string => {
  if (score >= 80) return 'var(--success-color)';
  if (score >= 60) return 'var(--warning-color)';
  return 'var(--danger-color)';
};

/**
 * Emoji döndürür skora göre
 */
export const getScoreEmoji = (score: number): string => {
  if (score >= 90) return '🏆';
  if (score >= 80) return '🌟';
  if (score >= 70) return '🎉';
  if (score >= 60) return '👍';
  if (score >= 50) return '💪';
  return '📚';
};