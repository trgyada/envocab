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
        const words: Word[] = rawWords.map((w) => ({
          id: uuidv4(),
          english: w.english,
          turkish: w.turkish,
          partOfSpeech: w.partOfSpeech,
          mastery: 0,
          correctCount: 0,
          incorrectCount: 0,
        }));

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
            
            const newWord: Word = {
              id: uuidv4(),
              english,
              turkish,
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
    }),
    {
      name: 'word-lists-storage',
    }
  )
);
