/**
 * Review Session Store - Zustand ile Oturum Yönetimi
 * 
 * Bu store, quiz oturumlarını ve review loglarını yönetir.
 * Her quiz oturumu için detaylı istatistikler tutar.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  ReviewSession, 
  ReviewLog, 
  QualityResponse,
  QuizType 
} from '../types';
import { v4 as uuidv4 } from 'uuid';

// ==========================================
// STORE TİPLERİ
// ==========================================

interface ReviewSessionStore {
  // State
  sessions: ReviewSession[];
  currentSession: ReviewSession | null;
  
  // Actions - Oturum Yönetimi
  startSession: (wordListId: string, totalCards: number, userId?: string) => ReviewSession;
  endSession: () => ReviewSession | null;
  abandonSession: () => void;
  
  // Actions - Log Kayıtları
  addReviewLog: (log: Omit<ReviewLog, 'id' | 'userId' | 'timestamp'>) => void;
  
  // Actions - Mevcut Oturum Güncellemeleri
  incrementCorrect: () => void;
  incrementIncorrect: () => void;
  incrementReviewed: () => void;
  
  // Actions - Geçmiş Oturumlar
  getSessionsByWordList: (wordListId: string) => ReviewSession[];
  getRecentSessions: (limit?: number) => ReviewSession[];
  getSessionStats: (sessionId: string) => SessionStats | null;
  
  // Actions - İstatistikler
  getTotalStats: () => TotalStats;
  getDailyStats: (date?: Date) => DailyStats;
  getStreakDays: () => number;
  
  // Actions - Temizlik
  clearHistory: () => void;
}

// ==========================================
// YARDIMCI TİPLER
// ==========================================

interface SessionStats {
  duration: number; // saniye
  averageResponseTime: number; // ms
  averageQuality: number;
  accuracy: number; // yüzde
  cardsPerMinute: number;
}

interface TotalStats {
  totalSessions: number;
  totalCardsReviewed: number;
  totalCorrect: number;
  totalIncorrect: number;
  averageAccuracy: number;
  totalStudyTimeMinutes: number;
  averageSessionDuration: number; // dakika
}

interface DailyStats {
  date: string;
  sessionsCount: number;
  cardsReviewed: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  studyTimeMinutes: number;
}

// ==========================================
// YARDIMCI FONKSİYONLAR
// ==========================================

const generateSessionId = () => `session-${uuidv4()}`;
const generateLogId = () => `log-${uuidv4()}`;

const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

const getDateString = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// ==========================================
// STORE
// ==========================================

export const useReviewSessionStore = create<ReviewSessionStore>()(
  persist(
    (set, get) => ({
      // Initial State
      sessions: [],
      currentSession: null,

      // ==========================================
      // OTURUM YÖNETİMİ
      // ==========================================

      startSession: (wordListId: string, totalCards: number, userId = 'default-user') => {
        // Eğer devam eden bir oturum varsa, önce onu sonlandır
        const current = get().currentSession;
        if (current) {
          get().endSession();
        }
        
        const newSession: ReviewSession = {
          id: generateSessionId(),
          userId,
          wordListId,
          startTime: new Date(),
          totalCards,
          reviewedCards: 0,
          correctCount: 0,
          incorrectCount: 0,
          logs: [],
          isComplete: false,
        };
        
        set({ currentSession: newSession });
        return newSession;
      },

      endSession: () => {
        const current = get().currentSession;
        if (!current) return null;
        
        const endTime = new Date();
        const duration = (endTime.getTime() - new Date(current.startTime).getTime()) / 1000;
        
        // Ortalama metrikleri hesapla
        let averageResponseTime: number | undefined;
        let averageQuality: number | undefined;
        
        if (current.logs.length > 0) {
          averageResponseTime = current.logs.reduce((sum, log) => sum + log.responseTimeMs, 0) / current.logs.length;
          averageQuality = current.logs.reduce((sum, log) => sum + log.quality, 0) / current.logs.length;
        }
        
        const completedSession: ReviewSession = {
          ...current,
          endTime,
          averageResponseTimeMs: averageResponseTime,
          averageQuality,
          isComplete: true,
        };
        
        set(state => ({
          sessions: [...state.sessions, completedSession],
          currentSession: null,
        }));
        
        return completedSession;
      },

      abandonSession: () => {
        set({ currentSession: null });
      },

      // ==========================================
      // LOG KAYITLARI
      // ==========================================

      addReviewLog: (logData) => {
        const current = get().currentSession;
        if (!current) {
          console.warn('No active session to add review log');
          return;
        }
        
        const log: ReviewLog = {
          id: generateLogId(),
          userId: current.userId,
          timestamp: new Date(),
          ...logData,
        };
        
        set(state => ({
          currentSession: state.currentSession ? {
            ...state.currentSession,
            logs: [...state.currentSession.logs, log],
          } : null,
        }));
      },

      // ==========================================
      // MEVCUT OTURUM GÜNCELLEMELERİ
      // ==========================================

      incrementCorrect: () => {
        set(state => ({
          currentSession: state.currentSession ? {
            ...state.currentSession,
            correctCount: state.currentSession.correctCount + 1,
          } : null,
        }));
      },

      incrementIncorrect: () => {
        set(state => ({
          currentSession: state.currentSession ? {
            ...state.currentSession,
            incorrectCount: state.currentSession.incorrectCount + 1,
          } : null,
        }));
      },

      incrementReviewed: () => {
        set(state => ({
          currentSession: state.currentSession ? {
            ...state.currentSession,
            reviewedCards: state.currentSession.reviewedCards + 1,
          } : null,
        }));
      },

      // ==========================================
      // GEÇMİŞ OTURUMLAR
      // ==========================================

      getSessionsByWordList: (wordListId: string) => {
        return get().sessions.filter(s => s.wordListId === wordListId);
      },

      getRecentSessions: (limit = 10) => {
        return [...get().sessions]
          .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
          .slice(0, limit);
      },

      getSessionStats: (sessionId: string) => {
        const session = get().sessions.find(s => s.id === sessionId);
        if (!session || !session.endTime) return null;
        
        const duration = (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 1000;
        const accuracy = session.reviewedCards > 0 
          ? (session.correctCount / session.reviewedCards) * 100 
          : 0;
        const cardsPerMinute = duration > 0 
          ? (session.reviewedCards / duration) * 60 
          : 0;
        
        return {
          duration,
          averageResponseTime: session.averageResponseTimeMs || 0,
          averageQuality: session.averageQuality || 0,
          accuracy,
          cardsPerMinute,
        };
      },

      // ==========================================
      // İSTATİSTİKLER
      // ==========================================

      getTotalStats: () => {
        const sessions = get().sessions;
        
        if (sessions.length === 0) {
          return {
            totalSessions: 0,
            totalCardsReviewed: 0,
            totalCorrect: 0,
            totalIncorrect: 0,
            averageAccuracy: 0,
            totalStudyTimeMinutes: 0,
            averageSessionDuration: 0,
          };
        }
        
        const totalCardsReviewed = sessions.reduce((sum, s) => sum + s.reviewedCards, 0);
        const totalCorrect = sessions.reduce((sum, s) => sum + s.correctCount, 0);
        const totalIncorrect = sessions.reduce((sum, s) => sum + s.incorrectCount, 0);
        
        const totalStudyTimeMs = sessions.reduce((sum, s) => {
          if (!s.endTime) return sum;
          return sum + (new Date(s.endTime).getTime() - new Date(s.startTime).getTime());
        }, 0);
        
        return {
          totalSessions: sessions.length,
          totalCardsReviewed,
          totalCorrect,
          totalIncorrect,
          averageAccuracy: totalCardsReviewed > 0 ? (totalCorrect / totalCardsReviewed) * 100 : 0,
          totalStudyTimeMinutes: totalStudyTimeMs / (1000 * 60),
          averageSessionDuration: totalStudyTimeMs / (sessions.length * 1000 * 60),
        };
      },

      getDailyStats: (date = new Date()) => {
        const sessions = get().sessions.filter(s => isSameDay(new Date(s.startTime), date));
        
        const cardsReviewed = sessions.reduce((sum, s) => sum + s.reviewedCards, 0);
        const correctCount = sessions.reduce((sum, s) => sum + s.correctCount, 0);
        const incorrectCount = sessions.reduce((sum, s) => sum + s.incorrectCount, 0);
        
        const studyTimeMs = sessions.reduce((sum, s) => {
          if (!s.endTime) return sum;
          return sum + (new Date(s.endTime).getTime() - new Date(s.startTime).getTime());
        }, 0);
        
        return {
          date: getDateString(date),
          sessionsCount: sessions.length,
          cardsReviewed,
          correctCount,
          incorrectCount,
          accuracy: cardsReviewed > 0 ? (correctCount / cardsReviewed) * 100 : 0,
          studyTimeMinutes: studyTimeMs / (1000 * 60),
        };
      },

      getStreakDays: () => {
        const sessions = get().sessions;
        if (sessions.length === 0) return 0;
        
        // Tarihleri unique olarak al ve sırala
        const dates = [...new Set(
          sessions.map(s => getDateString(new Date(s.startTime)))
        )].sort().reverse();
        
        if (dates.length === 0) return 0;
        
        // Bugünden başlayarak ardışık günleri say
        const today = getDateString(new Date());
        const yesterday = getDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));
        
        // Bugün veya dün çalışılmamışsa streak 0
        if (dates[0] !== today && dates[0] !== yesterday) {
          return 0;
        }
        
        let streak = 1;
        let currentDate = new Date(dates[0]);
        
        for (let i = 1; i < dates.length; i++) {
          const prevDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
          const prevDateStr = getDateString(prevDate);
          
          if (dates[i] === prevDateStr) {
            streak++;
            currentDate = prevDate;
          } else {
            break;
          }
        }
        
        return streak;
      },

      // ==========================================
      // TEMİZLİK
      // ==========================================

      clearHistory: () => {
        set({ sessions: [], currentSession: null });
      },
    }),
    {
      name: 'vocab-review-session-store',
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          
          const data = JSON.parse(str);
          
          // Date string'lerini Date objelerine çevir
          if (data.state?.sessions) {
            data.state.sessions.forEach((session: any) => {
              if (session.startTime) session.startTime = new Date(session.startTime);
              if (session.endTime) session.endTime = new Date(session.endTime);
              if (session.logs) {
                session.logs.forEach((log: any) => {
                  if (log.timestamp) log.timestamp = new Date(log.timestamp);
                });
              }
            });
          }
          
          if (data.state?.currentSession) {
            const session = data.state.currentSession;
            if (session.startTime) session.startTime = new Date(session.startTime);
            if (session.endTime) session.endTime = new Date(session.endTime);
            if (session.logs) {
              session.logs.forEach((log: any) => {
                if (log.timestamp) log.timestamp = new Date(log.timestamp);
              });
            }
          }
          
          return data;
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          localStorage.removeItem(name);
        },
      },
    }
  )
);

// ==========================================
// SELECTOR HOOKS
// ==========================================

/**
 * Mevcut oturumu getirir
 */
export const useCurrentSession = () => {
  return useReviewSessionStore(state => state.currentSession);
};

/**
 * Streak gün sayısını getirir
 */
export const useStreakDays = () => {
  return useReviewSessionStore(state => state.getStreakDays());
};

/**
 * Toplam istatistikleri getirir
 */
export const useTotalStats = () => {
  return useReviewSessionStore(state => state.getTotalStats());
};
