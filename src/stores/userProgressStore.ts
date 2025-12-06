import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { QuizResult, UserStats, Word } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface UserProgressState {
  quizResults: QuizResult[];
  stats: UserStats;
  
  // Actions
  addQuizResult: (result: Omit<QuizResult, 'id' | 'completedAt'>) => void;
  getRecentResults: (limit?: number) => QuizResult[];
  getResultsByWordList: (wordListId: string) => QuizResult[];
  getWeakWords: () => Word[];
  updateStreak: () => void;
  resetStats: () => void;
}

const initialStats: UserStats = {
  totalQuizzes: 0,
  totalWords: 0,
  averageScore: 0,
  bestScore: 0,
  totalStudyTime: 0,
  streakDays: 0,
  lastStudyDate: undefined,
};

export const useUserProgressStore = create<UserProgressState>()(
  persist(
    (set, get) => ({
      quizResults: [],
      stats: initialStats,

      addQuizResult: (result) => {
        const newResult: QuizResult = {
          ...result,
          id: uuidv4(),
          completedAt: new Date(),
        };

        set((state) => {
          const allResults = [...state.quizResults, newResult];
          const totalScore = allResults.reduce((sum, r) => sum + r.score, 0);
          
          return {
            quizResults: allResults,
            stats: {
              ...state.stats,
              totalQuizzes: state.stats.totalQuizzes + 1,
              totalWords: state.stats.totalWords + result.totalQuestions,
              averageScore: Math.round(totalScore / allResults.length),
              bestScore: Math.max(state.stats.bestScore, result.score),
              totalStudyTime: state.stats.totalStudyTime + Math.round(result.duration / 60),
              lastStudyDate: new Date(),
            },
          };
        });

        // Streak güncelle
        get().updateStreak();
      },

      getRecentResults: (limit = 10) => {
        const results = get().quizResults;
        return results
          .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
          .slice(0, limit);
      },

      getResultsByWordList: (wordListId) => {
        return get().quizResults.filter((r) => r.wordListId === wordListId);
      },

      getWeakWords: () => {
        const results = get().quizResults;
        const allWrongWords: Word[] = [];
        
        results.forEach((result) => {
          allWrongWords.push(...result.wrongWords);
        });

        // En çok yanlış yapılan kelimeleri bul
        const wordCounts = new Map<string, { word: Word; count: number }>();
        allWrongWords.forEach((word) => {
          const existing = wordCounts.get(word.id);
          if (existing) {
            existing.count++;
          } else {
            wordCounts.set(word.id, { word, count: 1 });
          }
        });

        return Array.from(wordCounts.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 20)
          .map((item) => item.word);
      },

      updateStreak: () => {
        set((state) => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const lastStudy = state.stats.lastStudyDate 
            ? new Date(state.stats.lastStudyDate) 
            : null;
          
          if (lastStudy) {
            lastStudy.setHours(0, 0, 0, 0);
            const diffDays = Math.floor((today.getTime() - lastStudy.getTime()) / (1000 * 60 * 60 * 24));
            
            if (diffDays === 0) {
              // Aynı gün, streak değişmez
              return state;
            } else if (diffDays === 1) {
              // Ardışık gün, streak artar
              return {
                stats: {
                  ...state.stats,
                  streakDays: state.stats.streakDays + 1,
                },
              };
            } else {
              // Gün atlandı, streak sıfırlanır
              return {
                stats: {
                  ...state.stats,
                  streakDays: 1,
                },
              };
            }
          }
          
          // İlk çalışma
          return {
            stats: {
              ...state.stats,
              streakDays: 1,
            },
          };
        });
      },

      resetStats: () => {
        set({
          quizResults: [],
          stats: initialStats,
        });
      },
    }),
    {
      name: 'user-progress-storage',
    }
  )
);