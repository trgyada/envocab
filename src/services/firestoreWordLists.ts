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
import { DEFAULT_STUDY_LANGUAGE, StudyLanguage, getStudyLanguageConfig } from '../utils/languages';

const getCollectionName = (language: StudyLanguage = DEFAULT_STUDY_LANGUAGE) =>
  getStudyLanguageConfig(language).collectionName;

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
  if (word.exampleSentence) {
    base.exampleSentence = word.exampleSentence;
  }
  if (word.exampleTranslation) {
    base.exampleTranslation = word.exampleTranslation;
  }
  if (word.exampleLang) {
    base.exampleLang = word.exampleLang;
  }
  if (word.exampleModel) {
    base.exampleModel = word.exampleModel;
  }
  if (word.exampleUpdatedAt) {
    base.exampleUpdatedAt = toTimestamp(word.exampleUpdatedAt);
  }
  if (word.englishDefinition) {
    base.englishDefinition = word.englishDefinition;
  }
  if (word.synonyms && word.synonyms.length) {
    base.synonyms = word.synonyms;
  }


  return base;
};

const serializeWordList = (list: WordList, language: StudyLanguage) => ({
  title: list.title,
  description: list.description || '',
  language,
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
  exampleSentence: raw.exampleSentence,
  exampleTranslation: raw.exampleTranslation,
  exampleLang: raw.exampleLang,
  exampleModel: raw.exampleModel,
  exampleUpdatedAt: toDate(raw.exampleUpdatedAt),
  englishDefinition: raw.englishDefinition,
  synonyms: Array.isArray(raw.synonyms) ? raw.synonyms : undefined,
});

const deserializeWordList = (id: string, data: any, language: StudyLanguage): WordList => ({
  id,
  title: data.title || 'İsimsiz Liste',
  description: data.description,
  language,
  words: Array.isArray(data.words) ? data.words.map(deserializeWord) : [],
  createdAt: toDate(data.createdAt) || new Date(),
  updatedAt: toDate(data.updatedAt) || new Date(),
});

export const fetchWordListsFromFirestore = async (
  language: StudyLanguage = DEFAULT_STUDY_LANGUAGE
): Promise<WordList[]> => {
  const snap = await getDocs(collection(db, getCollectionName(language)));
  return snap.docs.map((d) => deserializeWordList(d.id, d.data(), language));
};

export const saveWordListToFirestore = async (
  list: WordList,
  language: StudyLanguage = list.language || DEFAULT_STUDY_LANGUAGE
) => {
  const ref = doc(db, getCollectionName(language), list.id);
  await setDoc(ref, serializeWordList(list, language), { merge: true });
};

export const deleteWordListFromFirestore = async (
  id: string,
  language: StudyLanguage = DEFAULT_STUDY_LANGUAGE
) => {
  const ref = doc(db, getCollectionName(language), id);
  await deleteDoc(ref);
};
