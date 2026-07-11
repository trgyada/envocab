import type { AppLanguageCode } from './languages';

const baseExampleModel = 'gemini-2.5-flash';
export type GermanExampleLevel = 'a1-a2' | 'a2-b1';

export const DEFAULT_GERMAN_EXAMPLE_LEVEL: GermanExampleLevel = 'a1-a2';

export const GERMAN_EXAMPLE_LEVEL_OPTIONS: Array<{
  id: GermanExampleLevel;
  label: string;
  description: string;
}> = [
  {
    id: 'a1-a2',
    label: 'A1-A2',
    description: 'Kısa cümleler, temel kelimeler ve basit dil bilgisi.',
  },
  {
    id: 'a2-b1',
    label: 'A2-B1',
    description: 'Biraz daha uzun cümleler, bağlaçlar ve günlük anlatım.',
  },
];

const getGermanProfile = (level: GermanExampleLevel) => `${baseExampleModel}-de-${level}`;

export const isGermanExampleLevel = (value: unknown): value is GermanExampleLevel =>
  value === 'a1-a2' || value === 'a2-b1';

export const getExampleModelLabel = (
  language: AppLanguageCode,
  germanLevel: GermanExampleLevel = DEFAULT_GERMAN_EXAMPLE_LEVEL
) => language === 'de' ? getGermanProfile(germanLevel) : baseExampleModel;

export const getGermanExampleLevelFromModel = (model?: string): GermanExampleLevel | null => {
  if (!model) return null;
  const level = model.split('-de-')[1];
  return isGermanExampleLevel(level) ? level : null;
};

export const isStoredExampleCurrent = (
  exampleSentence: string | undefined,
  exampleLang: AppLanguageCode | undefined,
  exampleModel: string | undefined,
  language: AppLanguageCode,
  germanLevel: GermanExampleLevel = DEFAULT_GERMAN_EXAMPLE_LEVEL
) => {
  if (!exampleSentence?.trim() || exampleLang !== language) return false;
  if (language !== 'de') return true;
  return exampleModel === getGermanProfile(germanLevel);
};
