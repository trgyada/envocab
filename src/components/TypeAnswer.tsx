import React, { useState } from 'react';
import { QuizQuestion, Word } from '../types';

type Props = {
  question: QuizQuestion;
  onAnswer: (isCorrect: boolean, word: Word, userAnswer: string, direction?: 'en-to-tr' | 'tr-to-en') => void;
};

type ValidateResponse = {
  accepted: boolean;
  score: number;
  verdict: 'exact' | 'synonym' | 'typo' | 'wrong' | string;
  synonyms?: string[];
};

const TypeAnswer: React.FC<Props> = ({ question, onAnswer }) => {
  const [value, setValue] = useState('');
  const [result, setResult] = useState<ValidateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const direction = question.direction === 'tr-to-en' ? 'tr-to-en' : 'en-to-tr';

  const handleSubmit = async () => {
    if (!value.trim() || loading) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/validate-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: question.question,
          correct: (question as any).correctAnswer || question.word[direction === 'tr-to-en' ? 'english' : 'turkish'],
          user: value.trim(),
          lang: direction === 'tr-to-en' ? 'tr' : 'en'
        })
      });
      const data: ValidateResponse = await res.json();
      setResult(data);
      onAnswer(data.accepted, question.word, value.trim(), direction === 'tr-to-en' ? 'tr-to-en' : 'en-to-tr');
    } catch (err) {
      onAnswer(false, question.word, value.trim(), direction === 'tr-to-en' ? 'tr-to-en' : 'en-to-tr');
    } finally {
      setLoading(false);
    }
  };

  const enterPress: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="type-answer-card">
      <div className="type-question">
        <div className="type-label">Soru</div>
        <div className="type-text">{question.question}</div>
      </div>
      <div className="type-input-row">
        <input
          className="type-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={enterPress}
          placeholder="Cevabini yaz..."
        />
        <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || !value.trim()}>
          {loading ? 'Kontrol ediliyor...' : 'Gonder'}
        </button>
      </div>
      {result && (
        <div className="type-result">
          <div className="type-score">
            Skor: <strong>{Math.round(result.score)}%</strong> {result.verdict !== 'exact' && `(${result.verdict})`}
          </div>
          {result.synonyms && result.synonyms.length > 0 && (
            <div className="type-synonyms">
              Eş anlamlılar: {result.synonyms.slice(0, 5).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TypeAnswer;
