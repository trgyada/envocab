export type StudyLanguage = 'en' | 'de';
export type AppLanguageCode = StudyLanguage | 'tr';

export interface StudyLanguageConfig {
  id: StudyLanguage;
  name: string;
  nativeName: string;
  flag: string;
  collectionName: string;
  sourceLabel: string;
  sourceShortLabel: string;
  sourceSpeechLang: string;
  sourcePromptName: string;
  definitionLabel: string;
  definitionActionLabel: string;
  excelHint: string;
}

export const DEFAULT_STUDY_LANGUAGE: StudyLanguage = 'en';

export const STUDY_LANGUAGES: StudyLanguageConfig[] = [
  {
    id: 'en',
    name: 'İngilizce',
    nativeName: 'English',
    flag: '🇬🇧',
    collectionName: 'lists',
    sourceLabel: 'İngilizce',
    sourceShortLabel: 'İng',
    sourceSpeechLang: 'en-US',
    sourcePromptName: 'English',
    definitionLabel: 'İngilizce tanım',
    definitionActionLabel: 'İngilizce tanımları üret',
    excelHint: 'Excel/CSV: 1. sütun İngilizce, 2. sütun Türkçe',
  },
  {
    id: 'de',
    name: 'Almanca',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    collectionName: 'lists_de',
    sourceLabel: 'Almanca',
    sourceShortLabel: 'Alm',
    sourceSpeechLang: 'de-DE',
    sourcePromptName: 'German',
    definitionLabel: 'Almanca tanım',
    definitionActionLabel: 'Almanca tanımları üret',
    excelHint: 'Excel/CSV: 1. sütun Almanca, 2. sütun Türkçe',
  },
];

export const getStudyLanguageConfig = (language?: StudyLanguage | null) =>
  STUDY_LANGUAGES.find((item) => item.id === language) ||
  STUDY_LANGUAGES.find((item) => item.id === DEFAULT_STUDY_LANGUAGE)!;

export const isStudyLanguage = (value: unknown): value is StudyLanguage =>
  value === 'en' || value === 'de';

export const getLanguageName = (code: AppLanguageCode) => {
  if (code === 'tr') return 'Türkçe';
  return getStudyLanguageConfig(code).sourceLabel;
};

export const getDirectionLabel = (language: StudyLanguage, direction: 'en-to-tr' | 'tr-to-en' | 'mixed') => {
  const config = getStudyLanguageConfig(language);
  if (direction === 'mixed') return 'Karışık';
  return direction === 'en-to-tr'
    ? `${config.sourceShortLabel} → Tr`
    : `Tr → ${config.sourceShortLabel}`;
};
