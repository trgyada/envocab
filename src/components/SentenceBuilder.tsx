import React, { useEffect, useMemo, useState } from 'react';
import { RotateCcw, Volume2 } from 'lucide-react';
import type { QuizQuestion, Word } from '../types';
import { speakText } from '../utils/speech';

type Props = {
  question: QuizQuestion;
  onAnswer: (isCorrect: boolean, word: Word, userAnswer: string, direction: 'tr-to-en') => void;
};

type SentenceToken = {
  id: string;
  text: string;
};

const tokenizeSentence = (sentence: string, questionId: string): SentenceToken[] =>
  sentence
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((text, index) => ({ id: `${questionId}-${index}`, text }));

const shuffleTokens = (tokens: SentenceToken[]) => {
  const shuffled = [...tokens];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  if (shuffled.length > 1 && shuffled.every((token, index) => token.id === tokens[index].id)) {
    [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
  }
  return shuffled;
};

const normalizeSentence = (value: string) =>
  value.trim().toLocaleLowerCase('de-DE').replace(/\s+/g, ' ');

const SentenceBuilder: React.FC<Props> = ({ question, onAnswer }) => {
  const sourceTokens = useMemo(
    () => tokenizeSentence(question.correctAnswer, question.id),
    [question.correctAnswer, question.id]
  );
  const [tokenBank, setTokenBank] = useState<SentenceToken[]>(() => shuffleTokens(sourceTokens));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);

  useEffect(() => {
    setTokenBank(shuffleTokens(sourceTokens));
    setSelectedIds([]);
    setResult(null);
  }, [question.id, sourceTokens]);

  const tokenMap = useMemo(() => new Map(sourceTokens.map((token) => [token.id, token])), [sourceTokens]);
  const selectedTokens = selectedIds.map((id) => tokenMap.get(id)).filter((token): token is SentenceToken => Boolean(token));
  const availableTokens = tokenBank.filter((token) => !selectedIds.includes(token.id));
  const userSentence = selectedTokens.map((token) => token.text).join(' ');

  const selectToken = (tokenId: string) => {
    if (result || selectedIds.includes(tokenId)) return;
    setSelectedIds((current) => [...current, tokenId]);
  };

  const removeToken = (tokenId: string) => {
    if (result) return;
    setSelectedIds((current) => current.filter((id) => id !== tokenId));
  };

  const submit = () => {
    if (result || selectedIds.length !== sourceTokens.length) return;
    const isCorrect = normalizeSentence(userSentence) === normalizeSentence(question.correctAnswer);
    setResult(isCorrect ? 'correct' : 'wrong');
    onAnswer(isCorrect, question.word, userSentence, 'tr-to-en');
  };

  const skip = () => {
    if (result) return;
    setResult('wrong');
    onAnswer(false, question.word, 'UNKNOWN', 'tr-to-en');
  };

  const reset = () => {
    if (result) return;
    setSelectedIds([]);
    setTokenBank(shuffleTokens(sourceTokens));
  };

  return (
    <div className="sentence-builder-card">
      <div className="sentence-builder-prompt">
        <div className="sentence-builder-label">Türkçe cümle</div>
        <div className="sentence-builder-prompt-row">
          <p>{question.question}</p>
          <button
            type="button"
            className="sentence-builder-speak"
            onClick={() => speakText(question.question, 'tr')}
            aria-label="Türkçe cümleyi seslendir"
            title="Türkçe cümleyi seslendir"
          >
            <Volume2 size={18} aria-hidden="true" />
          </button>
        </div>
        <span className="sentence-builder-target">Hedef kelime: {question.word.english}</span>
      </div>

      <div className={`sentence-builder-answer ${result || ''}`} aria-live="polite">
        {selectedTokens.length === 0 ? (
          <span className="sentence-builder-placeholder">Almanca cümleniz</span>
        ) : (
          selectedTokens.map((token) => (
            <button key={token.id} type="button" onClick={() => removeToken(token.id)} disabled={Boolean(result)}>
              {token.text}
            </button>
          ))
        )}
      </div>

      <div className="sentence-builder-bank" aria-label="Kullanılabilir Almanca kelimeler">
        {availableTokens.map((token) => (
          <button key={token.id} type="button" onClick={() => selectToken(token.id)} disabled={Boolean(result)}>
            {token.text}
          </button>
        ))}
      </div>

      {!result && (
        <div className="sentence-builder-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={reset} disabled={selectedIds.length === 0}>
            <RotateCcw size={16} aria-hidden="true" /> Sıfırla
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={skip}>Bilmiyorum</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={submit}
            disabled={selectedIds.length !== sourceTokens.length}
          >
            Kontrol et
          </button>
        </div>
      )}

      {result && (
        <div className={`sentence-builder-result ${result}`}>
          <strong>{result === 'correct' ? 'Doğru cümle.' : 'Doğru Almanca cümle:'}</strong>
          <div className="sentence-builder-correct-row">
            <span>{question.correctAnswer}</span>
            <button
              type="button"
              className="sentence-builder-speak"
              onClick={() => speakText(question.correctAnswer, 'de')}
              aria-label="Almanca cümleyi seslendir"
              title="Almanca cümleyi seslendir"
            >
              <Volume2 size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SentenceBuilder;
