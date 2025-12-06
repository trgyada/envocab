import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Word, WordList } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface WordListState {
  wordLists: WordList[];
  selectedListId: string | null;
  
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
      },

      removeWordList: (id) => {
        set((state) => ({
          wordLists: state.wordLists.filter((list) => list.id !== id),
          selectedListId: state.selectedListId === id ? null : state.selectedListId,
        }));
      },

      selectWordList: (id) => {
        set({ selectedListId: id });
      },

      getSelectedList: () => {
        const { wordLists, selectedListId } = get();
        return wordLists.find((list) => list.id === selectedListId) || null;
      },

      updateWordMastery: (listId, wordId, isCorrect) => {
        set((state) => ({
          wordLists: state.wordLists.map((list) => {
            if (list.id !== listId) return list;
            
            return {
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
          }),
        }));
      },

      getWordsByMastery: (listId, maxMastery) => {
        const list = get().wordLists.find((l) => l.id === listId);
        if (!list) return [];
        return list.words.filter((word) => word.mastery <= maxMastery);
      },

      addWordToList: (listId, english, turkish) => {
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
            
            return {
              ...list,
              updatedAt: new Date(),
              words: [...list.words, newWord],
            };
          }),
        }));
      },

      removeWordFromList: (listId, wordId) => {
        set((state) => ({
          wordLists: state.wordLists.map((list) => {
            if (list.id !== listId) return list;
            
            return {
              ...list,
              updatedAt: new Date(),
              words: list.words.filter((word) => word.id !== wordId),
            };
          }),
        }));
      },

      updateWord: (listId, wordId, english, turkish) => {
        set((state) => ({
          wordLists: state.wordLists.map((list) => {
            if (list.id !== listId) return list;
            
            return {
              ...list,
              updatedAt: new Date(),
              words: list.words.map((word) => {
                if (word.id !== wordId) return word;
                return { ...word, english, turkish };
              }),
            };
          }),
        }));
      },

      updateListTitle: (listId, newTitle) => {
        set((state) => ({
          wordLists: state.wordLists.map((list) => {
            if (list.id !== listId) return list;
            return { ...list, title: newTitle, updatedAt: new Date() };
          }),
        }));
      },
    }),
    {
      name: 'word-lists-storage',
    }
  )
);