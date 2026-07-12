import type { AppLanguageCode } from './languages';
import { getStudyLanguageConfig } from './languages';

export const getSpeechLanguage = (language: AppLanguageCode) =>
  language === 'tr' ? 'tr-TR' : getStudyLanguageConfig(language).sourceSpeechLang;

export const speakText = (text: string, language: AppLanguageCode, rate?: number): boolean => {
  const content = text.trim();
  if (!content || typeof window === 'undefined' || !('speechSynthesis' in window)) return false;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(content);
  utterance.lang = getSpeechLanguage(language);
  utterance.rate = rate ?? (language === 'de' ? 0.9 : 1);
  window.speechSynthesis.speak(utterance);
  return true;
};
