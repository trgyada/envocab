import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Word, WordList } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { 
  fetchWordListsFromFirestore, 
  saveWordListToFirestore, 
  deleteWordListFromFirestore 
} from '../services/firestoreWordLists';
import { DEFAULT_STUDY_LANGUAGE, StudyLanguage } from '../utils/languages';

// ==========================================
// DEBOUNCE UTILITY - Prevents excessive Firestore syncs
// ==========================================
const pendingSyncs = new Map<string, NodeJS.Timeout>();
const SYNC_DEBOUNCE_MS = 2000; // 2 saniye bekle, sonra sync et

const debouncedSync = (
  language: StudyLanguage,
  listId: string,
  list: WordList,
  syncFn: (list: WordList, language?: StudyLanguage) => Promise<void>
) => {
  // Önceki pending sync varsa iptal et
  const syncKey = `${language}:${listId}`;
  const existing = pendingSyncs.get(syncKey);
  if (existing) {
    clearTimeout(existing);
  }
  
  // Yeni debounced sync planla
  const timeout = setTimeout(() => {
    syncFn(list, language);
    pendingSyncs.delete(syncKey);
  }, SYNC_DEBOUNCE_MS);
  
  pendingSyncs.set(syncKey, timeout);
};

const resolveListLanguage = (list: WordList, fallback?: StudyLanguage | null): StudyLanguage =>
  list.language || fallback || DEFAULT_STUDY_LANGUAGE;

interface WordListState {
  activeLanguage: StudyLanguage | null;
  wordLists: WordList[];
  selectedListId: string | null;
  setActiveLanguage: (language: StudyLanguage) => void;
  hydrateFromCloud: (language?: StudyLanguage) => Promise<void>;
  syncList: (list: WordList, language?: StudyLanguage) => Promise<void>;
  
  // Actions
  addWordList: (title: string, words: Omit<Word, 'id' | 'mastery' | 'correctCount' | 'incorrectCount'>[]) => void;
  removeWordList: (id: string) => void;
  selectWordList: (id: string | null) => void;
  getSelectedList: () => WordList | null;
  updateWordMastery: (listId: string, wordId: string, isCorrect: boolean) => void;
  getWordsByMastery: (listId: string, maxMastery: number) => Word[];
  addWordToList: (listId: string, english: string, turkish: string) => void;
  removeWordFromList: (listId: string, wordId: string) => void;
  updateWord: (
    listId: string,
    wordId: string,
    payload: {
      english: string;
      turkish: string;
      synonyms?: string[];
      exampleSentence?: string;
      exampleTranslation?: string;
      exampleLang?: StudyLanguage | 'tr';
      exampleModel?: string;
      exampleUpdatedAt?: Date;
      englishDefinition?: string;
    }
  ) => void;
  updateWordsSynonyms: (listId: string, updates: { wordId: string; synonyms: string[] }[]) => void;
  updateListTitle: (listId: string, newTitle: string) => void;
  updateWordExample: (
    wordId: string,
    payload: { sentence?: string; translation?: string; lang?: StudyLanguage | 'tr'; model?: string; updatedAt?: Date }
  ) => void;
  addUnknownWord: (params: { english: string; turkish: string; source?: string }) => void;
}

export const useWordListStore = create<WordListState>()(
  persist(
    (set, get) => ({
      activeLanguage: null,
      wordLists: [],
      selectedListId: null,
      setActiveLanguage: (language) => {
        set({
          activeLanguage: language,
          selectedListId: null,
          wordLists: [],
        });
      },
      hydrateFromCloud: async (language) => {
        const targetLanguage = language || get().activeLanguage || DEFAULT_STUDY_LANGUAGE;
        try {
          const lists = await fetchWordListsFromFirestore(targetLanguage);
          if (get().activeLanguage === targetLanguage) {
            set({ wordLists: lists });
          }
        } catch (err) {
          console.error('Cloud hydrate failed', err);
        }
      },
      syncList: async (list: WordList, language) => {
        const targetLanguage = language || list.language || get().activeLanguage || DEFAULT_STUDY_LANGUAGE;
        try {
          await saveWordListToFirestore({ ...list, language: targetLanguage }, targetLanguage);
        } catch (err) {
          console.error('Sync list failed', err);
        }
      },

      addWordList: (title, rawWords) => {
        const language = get().activeLanguage || DEFAULT_STUDY_LANGUAGE;
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
            // Excel'den gelen ek alanlar (varsa)
            exampleSentence: (w as any).exampleSentence || undefined,
            exampleTranslation: (w as any).exampleTranslation || undefined,
            exampleLang: (w as any).exampleSentence ? language : undefined,
            englishDefinition: (w as any).englishDefinition || undefined,
            synonyms: (w as any).synonyms || undefined,
          });
        });

        const newList: WordList = {
          id: uuidv4(),
          title,
          language,
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
        const language = get().activeLanguage || DEFAULT_STUDY_LANGUAGE;
        set((state) => ({
          wordLists: state.wordLists.filter((list) => list.id !== id),
          selectedListId: state.selectedListId === id ? null : state.selectedListId,
        }));

        deleteWordListFromFirestore(id, language).catch((err) => console.error('Delete list failed', err));
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

        // Use debounced sync to prevent excessive Firestore writes
        if (updatedList) {
          debouncedSync(resolveListLanguage(updatedList, get().activeLanguage), listId, updatedList, get().syncList);
        }
      },



      updateWordsSynonyms: (listId, updates) => {
        if (!updates.length) return;
        let updatedList: WordList | null = null;
        const updateMap = new Map(updates.map((u) => [u.wordId, u.synonyms]));
        set((state) => ({
          wordLists: state.wordLists.map((list) => {
            if (list.id !== listId) return list;
            const nextList = {
              ...list,
              updatedAt: new Date(),
              words: list.words.map((word) => {
                const nextSynonyms = updateMap.get(word.id);
                if (!nextSynonyms) return word;
                return { ...word, synonyms: nextSynonyms };
              }),
            };
            updatedList = nextList;
            return nextList;
          }),
        }));

        // Debounced sync for synonyms update
        if (updatedList) {
          debouncedSync(resolveListLanguage(updatedList, get().activeLanguage), listId, updatedList, get().syncList);
        }
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

        // Debounced sync for word addition
        if (updatedList) {
          debouncedSync(resolveListLanguage(updatedList, get().activeLanguage), listId, updatedList, get().syncList);
        }
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

        // Debounced sync for word removal
        if (updatedList) {
          debouncedSync(resolveListLanguage(updatedList, get().activeLanguage), listId, updatedList, get().syncList);
        }
      },

      updateWord: (listId, wordId, payload) => {
        let updatedList: WordList | null = null;
        set((state) => ({
          wordLists: state.wordLists.map((list) => {
            if (list.id !== listId) return list;
            
            const nextList = {
              ...list,
              updatedAt: new Date(),
              words: list.words.map((word) => {
                if (word.id !== wordId) return word;
                const nextWord: Word = {
                  ...word,
                  english: payload.english,
                  turkish: payload.turkish,
                };
                if ('synonyms' in payload) nextWord.synonyms = payload.synonyms;
                if ('exampleSentence' in payload) {
                  const value = payload.exampleSentence?.trim();
                  nextWord.exampleSentence = value || undefined;
                }
                if ('exampleTranslation' in payload) {
                  const value = payload.exampleTranslation?.trim();
                  nextWord.exampleTranslation = value || undefined;
                }
                if ('exampleLang' in payload) {
                  nextWord.exampleLang = payload.exampleLang;
                }
                if ('exampleModel' in payload) {
                  nextWord.exampleModel = payload.exampleModel;
                }
                if ('exampleUpdatedAt' in payload) {
                  nextWord.exampleUpdatedAt = payload.exampleUpdatedAt || new Date();
                }
                if ('englishDefinition' in payload) {
                  const value = payload.englishDefinition?.trim();
                  nextWord.englishDefinition = value || undefined;
                }
                return nextWord;
              }),
            };
            updatedList = nextList;
            return nextList;
          }),
        }));

        // Debounced sync for word update
        if (updatedList) {
          debouncedSync(resolveListLanguage(updatedList, get().activeLanguage), listId, updatedList, get().syncList);
        }
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

        // Debounced sync for title update
        if (updatedList) {
          debouncedSync(resolveListLanguage(updatedList, get().activeLanguage), listId, updatedList, get().syncList);
        }
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

        updatedLists.forEach((list) =>
          debouncedSync(resolveListLanguage(list, get().activeLanguage), list.id, list, get().syncList)
        );
      },

      addUnknownWord: ({ english, turkish, source }) => {
        if (!english.trim() || !turkish.trim()) return;
        const language = get().activeLanguage || DEFAULT_STUDY_LANGUAGE;
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
              language,
              updatedAt: new Date(),
              words: [...existingUnknown.words, newWord],
            };
            const lists = state.wordLists.map((l) => (l.id === 'unknown' ? updated : l));
            // Fire and forget sync
            get().syncList(updated, language);
            return { ...state, wordLists: lists };
          }

          const newList: WordList = {
            id: 'unknown',
            title: 'Bilinmeyenler',
            description: 'Ornek cumlelerden eklenen bilinmeyen kelimeler',
            language,
            createdAt: new Date(),
            updatedAt: new Date(),
            words: [newWord],
          };
          get().syncList(newList, language);
          return { ...state, wordLists: [...state.wordLists, newList] };
        });
      },
    }),
    {
      name: 'word-lists-storage',
    }
  )
);
