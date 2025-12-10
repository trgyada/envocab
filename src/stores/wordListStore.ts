import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Word, WordList } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { 
  fetchWordListsFromFirestore, 
  saveWordListToFirestore, 
  deleteWordListFromFirestore 
} from '../services/firestoreWordLists';

interface WordListState {
  wordLists: WordList[];
  selectedListId: string | null;
  hydrateFromCloud: () => Promise<void>;
  syncList: (list: WordList) => Promise<void>;
  
  // Actions
  addWordList: (title: string, words: Omit<Word, 'id' | 'mastery' | 'correctCount' | 'incorrectCount'>[]) => void;
  removeWordList: (id: string) => void;
  selectWordList: (id: string | null) => void;
  getSelectedList: () => WordList | null;
  updateWordMastery: (listId: string, wordId: string, isCorrect: boolean) => void;
  getWordsByMastery: (listId: string, maxMastery: number) => Word[];
  addWordToList: (listId: string, english: string, turkish: string) => void;
  removeWordFromList: (listId: string, wordId: string) => void;
  updateWord: (listId: string, wordId: string, english: string, turkish: string) => void;
  updateListTitle: (listId: string, newTitle: string) => void;
  updateWordExample: (
    wordId: string,
    payload: { sentence?: string; translation?: string; lang?: 'en' | 'tr'; model?: string; updatedAt?: Date }
  ) => void;
  addUnknownWord: (params: { english: string; turkish: string; source?: string }) => void;
}

export const useWordListStore = create<WordListState>()(
  persist(
    (set, get) => ({
      wordLists: [],
      selectedListId: null,
      hydrateFromCloud: async () => {
        try {
          const lists = await fetchWordListsFromFirestore();
          set({ wordLists: lists });
        } catch (err) {
          console.error('Cloud hydrate failed', err);
        }
      },
      syncList: async (list: WordList) => {
        try {
          await saveWordListToFirestore(list);
        } catch (err) {
          console.error('Sync list failed', err);
        }
      },

      addWordList: (title, rawWords) => {
        const seen = new Set<string>();
        const words: Word[] = [];

        rawWords.forEach((w) => {
          const key = w.english.trim().toLowerCase();
          if (seen.has(key)) return;
          seen.add(key);
          words.push({
            id: uuidv4(),
            english: w.english.trim(),
            turkish: w.turkish.trim(),
            partOfSpeech: w.partOfSpeech,
            mastery: 0,
            correctCount: 0,
            incorrectCount: 0,
          });
        });

        const newList: WordList = {
          id: uuidv4(),
          title,
          words,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        set((state) => ({
          wordLists: [...state.wordLists, newList],
        }));

        // Sync to Firestore
        get().syncList(newList);
      },

      removeWordList: (id) => {
        set((state) => ({
          wordLists: state.wordLists.filter((list) => list.id !== id),
          selectedListId: state.selectedListId === id ? null : state.selectedListId,
        }));

        deleteWordListFromFirestore(id).catch((err) => console.error('Delete list failed', err));
      },

      selectWordList: (id) => {
        set({ selectedListId: id });
      },

      getSelectedList: () => {
        const { wordLists, selectedListId } = get();
        return wordLists.find((list) => list.id === selectedListId) || null;
      },

      updateWordMastery: (listId, wordId, isCorrect) => {
        let updatedList: WordList | null = null;
        set((state) => ({
          wordLists: state.wordLists.map((list) => {
            if (list.id !== listId) return list;
            
            const nextList = {
              ...list,
              updatedAt: new Date(),
              words: list.words.map((word) => {
                if (word.id !== wordId) return word;
                
                const newCorrect = word.correctCount + (isCorrect ? 1 : 0);
                const newIncorrect = word.incorrectCount + (isCorrect ? 0 : 1);
                const total = newCorrect + newIncorrect;
                const newMastery = total > 0 ? Math.round((newCorrect / total) * 100) : 0;
                
                return {
                  ...word,
                  correctCount: newCorrect,
                  incorrectCount: newIncorrect,
                  mastery: newMastery,
                  lastPracticed: new Date(),
                };
              }),
            };
            updatedList = nextList;
            return nextList;
          }),
        }));

        if (updatedList) get().syncList(updatedList);
      },

      getWordsByMastery: (listId, maxMastery) => {
        const list = get().wordLists.find((l) => l.id === listId);
        if (!list) return [];
        return list.words.filter((word) => word.mastery <= maxMastery);
      },

      addWordToList: (listId, english, turkish) => {
        let updatedList: WordList | null = null;
        set((state) => ({
          wordLists: state.wordLists.map((list) => {
            if (list.id !== listId) return list;

            const key = english.trim().toLowerCase();
            const exists = list.words.some((w) => w.english.trim().toLowerCase() === key);
            if (exists) {
              updatedList = list;
              return list;
            }
            
            const newWord: Word = {
              id: uuidv4(),
              english: english.trim(),
              turkish: turkish.trim(),
              mastery: 0,
              correctCount: 0,
              incorrectCount: 0,
            };
            
            const nextList = {
              ...list,
              updatedAt: new Date(),
              words: [...list.words, newWord],
            };
            updatedList = nextList;
            return nextList;
          }),
        }));

        if (updatedList) get().syncList(updatedList);
      },

      removeWordFromList: (listId, wordId) => {
        let updatedList: WordList | null = null;
        set((state) => ({
          wordLists: state.wordLists.map((list) => {
            if (list.id !== listId) return list;
            
            const nextList = {
              ...list,
              updatedAt: new Date(),
              words: list.words.filter((word) => word.id !== wordId),
            };
            updatedList = nextList;
            return nextList;
          }),
        }));

        if (updatedList) get().syncList(updatedList);
      },

      updateWord: (listId, wordId, english, turkish) => {
        let updatedList: WordList | null = null;
        set((state) => ({
          wordLists: state.wordLists.map((list) => {
            if (list.id !== listId) return list;
            
            const nextList = {
              ...list,
              updatedAt: new Date(),
              words: list.words.map((word) => {
                if (word.id !== wordId) return word;
                return { ...word, english, turkish };
              }),
            };
            updatedList = nextList;
            return nextList;
          }),
        }));

        if (updatedList) get().syncList(updatedList);
      },

      updateListTitle: (listId, newTitle) => {
        let updatedList: WordList | null = null;
        set((state) => ({
          wordLists: state.wordLists.map((list) => {
            if (list.id !== listId) return list;
            const nextList = { ...list, title: newTitle, updatedAt: new Date() };
            updatedList = nextList;
            return nextList;
          }),
        }));

        if (updatedList) get().syncList(updatedList);
      },

      updateWordExample: (wordId, payload) => {
        const updatedLists: WordList[] = [];
        set((state) => ({
          wordLists: state.wordLists.map((list) => {
            const hasWord = list.words.some((w) => w.id === wordId);
            if (!hasWord) return list;
            const nextList = {
              ...list,
              updatedAt: new Date(),
              words: list.words.map((w) =>
                w.id === wordId
                  ? {
                      ...w,
                      exampleSentence: payload.sentence ?? w.exampleSentence,
                      exampleTranslation: payload.translation ?? w.exampleTranslation,
                      exampleLang: payload.lang ?? w.exampleLang,
                      exampleModel: payload.model ?? w.exampleModel,
                      exampleUpdatedAt: payload.updatedAt ?? new Date(),
                    }
                  : w
              ),
            };
            updatedLists.push(nextList);
            return nextList;
          }),
        }));

        updatedLists.forEach((list) => get().syncList(list));
      },

      addUnknownWord: ({ english, turkish, source }) => {
        if (!english.trim() || !turkish.trim()) return;
        set((state) => {
          const existingUnknown = state.wordLists.find((l) => l.id === 'unknown');
          const normalized = english.trim().toLowerCase();

          const hasDuplicate = existingUnknown?.words.some((w) => w.english.toLowerCase() === normalized);
          if (hasDuplicate) return state;

          const newWord: Word = {
            id: uuidv4(),
            english: english.trim(),
            turkish: turkish.trim(),
            mastery: 0,
            correctCount: 0,
            incorrectCount: 0,
            tags: source ? [source] : undefined,
          };

          if (existingUnknown) {
            const updated: WordList = {
              ...existingUnknown,
              updatedAt: new Date(),
              words: [...existingUnknown.words, newWord],
            };
            const lists = state.wordLists.map((l) => (l.id === 'unknown' ? updated : l));
            // Fire and forget sync
            get().syncList(updated);
            return { ...state, wordLists: lists };
          }

          const newList: WordList = {
            id: 'unknown',
            title: 'Bilinmeyenler',
            description: 'Ornek cumlelerden eklenen bilinmeyen kelimeler',
            createdAt: new Date(),
            updatedAt: new Date(),
            words: [newWord],
          };
          get().syncList(newList);
          return { ...state, wordLists: [...state.wordLists, newList] };
        });
      },
    }),
    {
      name: 'word-lists-storage',
    }
  )
);
