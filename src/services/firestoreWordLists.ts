import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { WordList, Word } from '../types';

const COLLECTION = 'lists';

const toTimestamp = (value?: Date | Timestamp) => {
  if (!value) return serverTimestamp();
  if (value instanceof Timestamp) return value;
  return Timestamp.fromDate(value);
};

const toDate = (value: any): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Timestamp) return value.toDate();
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? undefined : parsed;
};

const serializeWord = (word: Word) => {
  const base: any = {
    id: word.id,
    english: word.english,
    turkish: word.turkish,
    mastery: word.mastery || 0,
    correctCount: word.correctCount || 0,
    incorrectCount: word.incorrectCount || 0,
    lastPracticed: word.lastPracticed ? toTimestamp(word.lastPracticed) : null,
  };

  if (word.partOfSpeech) {
    base.partOfSpeech = word.partOfSpeech;
  }
  if (word.difficultyLevel) {
    base.difficultyLevel = word.difficultyLevel;
  }
  if (word.frequencyRank !== undefined) {
    base.frequencyRank = word.frequencyRank;
  }
  if (word.tags) {
    base.tags = word.tags;
  }

  return base;
};

const serializeWordList = (list: WordList) => ({
  title: list.title,
  description: list.description || '',
  words: list.words.map(serializeWord),
  createdAt: toTimestamp(list.createdAt),
  updatedAt: serverTimestamp(),
});

const deserializeWord = (raw: any): Word => ({
  id: raw.id,
  english: raw.english,
  turkish: raw.turkish,
  partOfSpeech: raw.partOfSpeech,
  mastery: raw.mastery ?? 0,
  correctCount: raw.correctCount ?? 0,
  incorrectCount: raw.incorrectCount ?? 0,
  lastPracticed: toDate(raw.lastPracticed),
});

const deserializeWordList = (id: string, data: any): WordList => ({
  id,
  title: data.title || 'İsimsiz Liste',
  description: data.description,
  words: Array.isArray(data.words) ? data.words.map(deserializeWord) : [],
  createdAt: toDate(data.createdAt) || new Date(),
  updatedAt: toDate(data.updatedAt) || new Date(),
});

export const fetchWordListsFromFirestore = async (): Promise<WordList[]> => {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map((d) => deserializeWordList(d.id, d.data()));
};

export const saveWordListToFirestore = async (list: WordList) => {
  const ref = doc(db, COLLECTION, list.id);
  await setDoc(ref, serializeWordList(list), { merge: true });
};

export const deleteWordListFromFirestore = async (id: string) => {
  const ref = doc(db, COLLECTION, id);
  await deleteDoc(ref);
};
