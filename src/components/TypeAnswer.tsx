import React, { useEffect, useState } from 'react';
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
  const [hasSkipped, setHasSkipped] = useState(false);
  const [showSynonyms, setShowSynonyms] = useState(false);
  const [hintSynonyms, setHintSynonyms] = useState<string[]>([]);

  const direction = question.direction === 'tr-to-en' ? 'tr-to-en' : 'en-to-tr';
  const correctAnswer =
    (question as any).correctAnswer || question.word[direction === 'tr-to-en' ? 'english' : 'turkish'];

  useEffect(() => {
    setValue('');
    setResult(null);
    setHasSkipped(false);
    setShowSynonyms(false);
    setHintSynonyms([]);
  }, [question.id]);

  const fetchHintSynonyms = async () => {
    try {
      const res = await fetch('/api/validate-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: question.question,
          correct: correctAnswer,
          user: correctAnswer,
          lang: direction === 'tr-to-en' ? 'tr' : 'en'
        })
      });
      const data: ValidateResponse = await res.json();
      if (data.synonyms) setHintSynonyms(data.synonyms);
    } catch {
      // ignore
    }
  };

  const handleSubmit = async () => {
    if (!value.trim() || loading) return;
    setLoading(true);
    setResult(null);
    setHasSkipped(false);
    try {
      const res = await fetch('/api/validate-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: question.question,
          correct: correctAnswer,
          user: value.trim(),
          lang: direction === 'tr-to-en' ? 'tr' : 'en'
        })
      });
      const data: ValidateResponse = await res.json();
      const accepted = data.accepted && data.score >= 60;
      const normalized: ValidateResponse = {
        ...data,
        accepted,
        verdict: accepted ? data.verdict : 'wrong'
      };
      setResult(normalized);
      onAnswer(accepted, question.word, value.trim(), direction === 'tr-to-en' ? 'tr-to-en' : 'en-to-tr');
    } catch {
      onAnswer(false, question.word, value.trim(), direction === 'tr-to-en' ? 'tr-to-en' : 'en-to-tr');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    if (result?.accepted || hasSkipped || loading) return;
    setHasSkipped(true);
    setValue('');
    onAnswer(false, question.word, 'UNKNOWN', direction === 'tr-to-en' ? 'tr-to-en' : 'en-to-tr');
    setResult({
      accepted: false,
      score: 0,
      verdict: 'wrong',
      synonyms: []
    });
  };

  const enterPress: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const handleHintClick = async () => {
    if (showSynonyms) {
      setShowSynonyms(false);
      return;
    }
    setShowSynonyms(true);
    if (!(result?.synonyms?.length || hintSynonyms.length)) {
      await fetchHintSynonyms();
    }
  };

  const verdictText = () => {
    if (!result) return '';
    switch (result.verdict) {
      case 'exact':
        return 'Tam doğru';
      case 'synonym':
        return 'Eş anlamlı kabul edildi';
      case 'typo':
        return 'Küçük yazım hatası';
      default:
        return 'Yanlış';
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
          placeholder="Cevabını yaz..."
        />
        <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || !value.trim()}>
          {loading ? 'Kontrol ediliyor...' : 'Gönder'}
        </button>
      </div>
      {result && (
        <div
          className="type-result"
          style={{
            background: result.accepted ? 'rgba(0, 128, 0, 0.12)' : 'rgba(200, 32, 32, 0.15)',
            borderColor: result.accepted ? 'rgba(0, 200, 0, 0.25)' : 'rgba(220, 40, 40, 0.35)'
          }}
        >
          <div className="type-score">
            Skor: <strong>{Math.round(result.score)}%</strong> {result.verdict !== 'exact' && `(${result.verdict})`}
          </div>
          <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>Durum: {verdictText()}</div>
          <div style={{ marginTop: 4 }}>
            Doğru cevap: <strong>{correctAnswer}</strong>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleSkip} disabled={!!result || hasSkipped}>
              Bilmiyorum / Listeye ekle
            </button>
          </div>
        </div>
      )}
      {!result && (
        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button className="btn btn-secondary btn-sm" onClick={handleSkip} disabled={hasSkipped}>
            Bilmiyorum / Listeye ekle
          </button>
          <button className="btn btn-outline btn-sm" onClick={handleHintClick}>
            İpucu (eş anlamlılar)
          </button>
        </div>
      )}
      {!result && showSynonyms && (
        <div className="type-synonyms" style={{ marginTop: 6 }}>
          {(hintSynonyms.length > 0 && hintSynonyms.slice(0, 5).join(', ')) || 'Eş anlamlı bulunamadı.'}
        </div>
      )}
    </div>
  );
};

export default TypeAnswer;
