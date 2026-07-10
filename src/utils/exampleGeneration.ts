import type { AppLanguageCode } from './languages';

const baseExampleModel = 'gemini-2.5-flash';
const germanBeginnerProfile = `${baseExampleModel}-de-a1-a2`;

export const getExampleModelLabel = (language: AppLanguageCode) =>
  language === 'de' ? germanBeginnerProfile : baseExampleModel;

export const isStoredExampleCurrent = (
  exampleSentence: string | undefined,
  exampleLang: AppLanguageCode | undefined,
  exampleModel: string | undefined,
  language: AppLanguageCode
) => {
  if (!exampleSentence?.trim() || exampleLang !== language) return false;
  if (language !== 'de') return true;
  return exampleModel === germanBeginnerProfile;
};
