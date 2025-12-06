/**
 * Card Store - Zustand ile Kart Yönetimi
 * 
 * Bu store, SM-2 spaced repetition sistemi için kart durumlarını yönetir.
 * localStorage ile kalıcı hale getirilir.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  Word, 
  Card, 
  UserCardState, 
  QualityResponse,
  MasteryLevel 
} from '../types';
import { 
  createDefaultCardState, 
  processReview, 
  getDueCards,
  prioritizeCards,
  SM2Result 
} from '../services/sm2Algorithm';

// ==========================================
// STORE TİPLERİ
// ==========================================

interface CardStore {
  // State
  cards: Card[];
  cardStates: Record<string, UserCardState>; // cardId -> UserCardState
  
  // Actions - Card Yönetimi
  createCardsFromWords: (words: Word[], userId?: string) => void;
  getCardByWordId: (wordId: string) => Card | undefined;
  getCardsForWordList: (wordIds: string[]) => Card[];
  
  // Actions - Card State Yönetimi
  getCardState: (cardId: string) => UserCardState | undefined;
  initializeCardState: (cardId: string, userId?: string) => UserCardState;
  updateCardState: (cardId: string, quality: QualityResponse, responseTimeMs: number) => SM2Result | null;
  
  // Actions - Review Yönetimi
  getDueCardsForReview: (wordIds?: string[]) => Card[];
  getNewCards: (wordIds?: string[], limit?: number) => Card[];
  getPrioritizedCards: (wordIds?: string[], limit?: number) => Card[];
  
  // Actions - İstatistikler
  getCardsByMasteryLevel: (wordIds?: string[]) => Record<MasteryLevel, Card[]>;
  getMasteryDistribution: (wordIds?: string[]) => Record<MasteryLevel, number>;
  getAverageDifficultyScore: (wordIds?: string[]) => number;
  getDifficultCards: (wordIds?: string[], threshold?: number) => Card[];
  
  // Actions - Reset
  resetCardState: (cardId: string) => void;
  resetAllCardStates: (wordIds?: string[]) => void;
  clearAllData: () => void;
}

// ==========================================
// YARDIMCI FONKSİYONLAR
// ==========================================

/**
 * Word'den Card oluşturur
 */
const createCardFromWord = (word: Word): Card => ({
  id: `card-${word.id}`,
  wordId: word.id,
  frontType: 'word',
  backType: 'translation',
  frontContent: word.english,
  backContent: word.turkish,
  createdAt: new Date(),
});

// ==========================================
// STORE
// ==========================================

export const useCardStore = create<CardStore>()(
  persist(
    (set, get) => ({
      // Initial State
      cards: [],
      cardStates: {},

      // ==========================================
      // CARD YÖNETİMİ
      // ==========================================

      createCardsFromWords: (words: Word[], userId = 'default-user') => {
        const existingCardIds = new Set(get().cards.map(c => c.wordId));
        
        // Sadece yeni kelimeler için kart oluştur
        const newCards = words
          .filter(word => !existingCardIds.has(word.id))
          .map(createCardFromWord);
        
        if (newCards.length === 0) return;
        
        // Yeni kartlar için varsayılan state'ler oluştur
        const newCardStates: Record<string, UserCardState> = {};
        newCards.forEach(card => {
          newCardStates[card.id] = createDefaultCardState(userId, card.id);
        });
        
        set(state => ({
          cards: [...state.cards, ...newCards],
          cardStates: { ...state.cardStates, ...newCardStates },
        }));
      },

      getCardByWordId: (wordId: string) => {
        return get().cards.find(card => card.wordId === wordId);
      },

      getCardsForWordList: (wordIds: string[]) => {
        const wordIdSet = new Set(wordIds);
        return get().cards.filter(card => wordIdSet.has(card.wordId));
      },

      // ==========================================
      // CARD STATE YÖNETİMİ
      // ==========================================

      getCardState: (cardId: string) => {
        return get().cardStates[cardId];
      },

      initializeCardState: (cardId: string, userId = 'default-user') => {
        const existingState = get().cardStates[cardId];
        if (existingState) return existingState;
        
        const newState = createDefaultCardState(userId, cardId);
        set(state => ({
          cardStates: { ...state.cardStates, [cardId]: newState },
        }));
        
        return newState;
      },

      updateCardState: (cardId: string, quality: QualityResponse, responseTimeMs: number) => {
        const currentState = get().cardStates[cardId];
        if (!currentState) {
          console.warn(`Card state not found for cardId: ${cardId}`);
          return null;
        }
        
        const result = processReview(currentState, quality, responseTimeMs);
        
        set(state => ({
          cardStates: {
            ...state.cardStates,
            [cardId]: result.newState,
          },
        }));
        
        return result;
      },

      // ==========================================
      // REVIEW YÖNETİMİ
      // ==========================================

      getDueCardsForReview: (wordIds?: string[]) => {
        const { cards, cardStates } = get();
        
        // Filtreleme
        let targetCards = wordIds 
          ? cards.filter(c => wordIds.includes(c.wordId))
          : cards;
        
        // Card state'leri al
        const states = targetCards
          .map(card => cardStates[card.id])
          .filter((state): state is UserCardState => !!state);
        
        // Due olan state'leri bul
        const dueStates = getDueCards(states);
        const dueCardIds = new Set(dueStates.map(s => s.cardId));
        
        return targetCards.filter(card => dueCardIds.has(card.id));
      },

      getNewCards: (wordIds?: string[], limit = 10) => {
        const { cards, cardStates } = get();
        
        // Filtreleme
        let targetCards = wordIds 
          ? cards.filter(c => wordIds.includes(c.wordId))
          : cards;
        
        // Hiç review edilmemiş kartları bul
        const newCards = targetCards.filter(card => {
          const state = cardStates[card.id];
          return !state || state.totalReviews === 0;
        });
        
        return newCards.slice(0, limit);
      },

      getPrioritizedCards: (wordIds?: string[], limit = 20) => {
        const { cards, cardStates } = get();
        
        // Filtreleme
        let targetCards = wordIds 
          ? cards.filter(c => wordIds.includes(c.wordId))
          : cards;
        
        // State'leri al ve prioritize et
        const states = targetCards
          .map(card => cardStates[card.id])
          .filter((state): state is UserCardState => !!state);
        
        const prioritized = prioritizeCards(states);
        const orderedCardIds = prioritized.map(s => s.cardId);
        
        // Kartları sırala
        const cardMap = new Map(targetCards.map(c => [c.id, c]));
        const sortedCards = orderedCardIds
          .map(id => cardMap.get(id))
          .filter((card): card is Card => !!card);
        
        // Yeni kartları da ekle (henüz state'i olmayanlar)
        const newCards = targetCards.filter(card => !cardStates[card.id]);
        
        return [...sortedCards, ...newCards].slice(0, limit);
      },

      // ==========================================
      // İSTATİSTİKLER
      // ==========================================

      getCardsByMasteryLevel: (wordIds?: string[]) => {
        const { cards, cardStates } = get();
        
        let targetCards = wordIds 
          ? cards.filter(c => wordIds.includes(c.wordId))
          : cards;
        
        const result: Record<MasteryLevel, Card[]> = {
          0: [], 1: [], 2: [], 3: [], 4: [], 5: []
        };
        
        targetCards.forEach(card => {
          const state = cardStates[card.id];
          const level = state?.masteryLevel ?? 0;
          result[level].push(card);
        });
        
        return result;
      },

      getMasteryDistribution: (wordIds?: string[]) => {
        const byLevel = get().getCardsByMasteryLevel(wordIds);
        
        return {
          0: byLevel[0].length,
          1: byLevel[1].length,
          2: byLevel[2].length,
          3: byLevel[3].length,
          4: byLevel[4].length,
          5: byLevel[5].length,
        };
      },

      getAverageDifficultyScore: (wordIds?: string[]) => {
        const { cards, cardStates } = get();
        
        let targetCards = wordIds 
          ? cards.filter(c => wordIds.includes(c.wordId))
          : cards;
        
        const scores = targetCards
          .map(card => cardStates[card.id]?.difficultyScore)
          .filter((score): score is number => score !== undefined);
        
        if (scores.length === 0) return 0.5;
        
        return scores.reduce((sum, s) => sum + s, 0) / scores.length;
      },

      getDifficultCards: (wordIds?: string[], threshold = 0.7) => {
        const { cards, cardStates } = get();
        
        let targetCards = wordIds 
          ? cards.filter(c => wordIds.includes(c.wordId))
          : cards;
        
        return targetCards.filter(card => {
          const state = cardStates[card.id];
          return state && state.difficultyScore >= threshold;
        });
      },

      // ==========================================
      // RESET
      // ==========================================

      resetCardState: (cardId: string) => {
        const state = get().cardStates[cardId];
        if (!state) return;
        
        set(state => ({
          cardStates: {
            ...state.cardStates,
            [cardId]: createDefaultCardState(state.cardStates[cardId]?.userId || 'default-user', cardId),
          },
        }));
      },

      resetAllCardStates: (wordIds?: string[]) => {
        const { cards, cardStates } = get();
        
        let targetCards = wordIds 
          ? cards.filter(c => wordIds.includes(c.wordId))
          : cards;
        
        const newStates = { ...cardStates };
        targetCards.forEach(card => {
          const userId = cardStates[card.id]?.userId || 'default-user';
          newStates[card.id] = createDefaultCardState(userId, card.id);
        });
        
        set({ cardStates: newStates });
      },

      clearAllData: () => {
        set({ cards: [], cardStates: {} });
      },
    }),
    {
      name: 'vocab-card-store',
      // Date objelerini serialize/deserialize et
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          
          const data = JSON.parse(str);
          
          // Date string'lerini Date objelerine çevir
          if (data.state?.cardStates) {
            Object.values(data.state.cardStates).forEach((state: any) => {
              if (state.lastReviewDate) state.lastReviewDate = new Date(state.lastReviewDate);
              if (state.nextReviewDate) state.nextReviewDate = new Date(state.nextReviewDate);
              if (state.recentResponses) {
                state.recentResponses.forEach((r: any) => {
                  if (r.timestamp) r.timestamp = new Date(r.timestamp);
                });
              }
            });
          }
          
          if (data.state?.cards) {
            data.state.cards.forEach((card: any) => {
              if (card.createdAt) card.createdAt = new Date(card.createdAt);
            });
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
 * Belirli bir kelime listesi için due kartları getirir
 */
export const useDueCards = (wordIds?: string[]) => {
  return useCardStore(state => state.getDueCardsForReview(wordIds));
};

/**
 * Mastery dağılımını getirir
 */
export const useMasteryDistribution = (wordIds?: string[]) => {
  return useCardStore(state => state.getMasteryDistribution(wordIds));
};
