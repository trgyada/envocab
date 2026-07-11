import { useCallback, useState } from 'react';
import {
  DEFAULT_GERMAN_EXAMPLE_LEVEL,
  GermanExampleLevel,
  isGermanExampleLevel,
} from '../utils/exampleGeneration';

const STORAGE_KEY = 'vocab-german-example-level';

const readStoredLevel = (): GermanExampleLevel => {
  if (typeof window === 'undefined') return DEFAULT_GERMAN_EXAMPLE_LEVEL;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isGermanExampleLevel(stored) ? stored : DEFAULT_GERMAN_EXAMPLE_LEVEL;
  } catch {
    return DEFAULT_GERMAN_EXAMPLE_LEVEL;
  }
};

export const useGermanExampleLevel = () => {
  const [level, setLevelState] = useState<GermanExampleLevel>(readStoredLevel);

  const setLevel = useCallback((nextLevel: GermanExampleLevel) => {
    setLevelState(nextLevel);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextLevel);
    } catch {
      // The in-memory preference still works when storage is unavailable.
    }
  }, []);

  return [level, setLevel] as const;
};
