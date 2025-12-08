import React, { useEffect, useState } from 'react';
import { PartOfSpeech, QuizQuestion, Word } from '../types';

interface MultipleChoiceProps {
  question: QuizQuestion;
  onAnswer: (isCorrect: boolean, word: Word) => void;
  optionMeaning?: (option: string) => string;
  example?: {
    sentence?: string;
    translation?: string;
    loading?: boolean;
    error?: string;
  };
  onRequestExample?: () => void;
  debugInfo?: string | null;
}

const getPartOfSpeechLabel = (pos?: PartOfSpeech): string => {
  if (!pos) return '';
  const labels: Record<PartOfSpeech, string> = {
    n: '(n.)',
    v: '(v.)',
    adj: '(adj.)',
    adv: '(adv.)',
    prep: '(prep.)',
    conj: '(conj.)',
    pron: '(pron.)',
    interj: '(interj.)',
    det: '(det.)',
    phr: '(phr.)',
    '': ''
  };
  return labels[pos] || '';
};

const MultipleChoice: React.FC<MultipleChoiceProps> = ({
  question,
  onAnswer,
  optionMeaning,
  example,
  onRequestExample,
  debugInfo
}) => {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    setSelectedAnswer(null);
    setShowResult(false);
    setIsTransitioning(false);
  }, [question.id]);

  const handleOptionClick = (option: string) => {
    if (showResult || isTransitioning) return;

    setSelectedAnswer(option);
    setShowResult(true);
    setIsTransitioning(true);

    const isCorrect = option === question.correctAnswer;

    setTimeout(() => {
      onAnswer(isCorrect, question.word);
    }, 1);
  };

  const handleUnknown = () => {
    if (showResult || isTransitioning) return;
    setSelectedAnswer('UNKNOWN');
    setShowResult(true);
    setIsTransitioning(true);
    setTimeout(() => onAnswer(false, question.word), 1);
  };

  const getButtonClass = (option: string) => {
    let baseClass = 'option-btn';

    if (!showResult) return baseClass;

    if (option === question.correctAnswer) {
      return `${baseClass} correct`;
    }
    if (option === selectedAnswer && option !== question.correctAnswer) {
      return `${baseClass} incorrect`;
    }
    return baseClass;
  };

  const isEnglishToTurkish = question.direction !== 'tr-to-en';
  const directionLabel = isEnglishToTurkish ? 'İngilizce → Türkçe' : 'Türkçe → İngilizce';

  return (
    <div className="quiz-card">
      <div className="question-badge">{directionLabel}</div>
      <h2 className="question-text">
        {question.question}
        {question.word.partOfSpeech && (
          <span className="part-of-speech"> {getPartOfSpeechLabel(question.word.partOfSpeech)}</span>
        )}
      </h2>
      <p className="question-hint">
        {isEnglishToTurkish ? 'Doğru Türkçe karşılığını seç' : 'Doğru İngilizce karşılığını seç'}
      </p>

      {onRequestExample && (
        <div className="example-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
            <div className="example-title">Örnek cümle (Gemini)</div>
            <button className="btn btn-outline btn-sm" onClick={onRequestExample} disabled={example?.loading}>
              {example?.loading ? 'Yükleniyor...' : example?.sentence ? 'Yeniden getir' : 'Göster'}
            </button>
          </div>
          {example?.error && <div className="example-error">{example.error}</div>}
          {example?.sentence && (
            <div className="example-sentence">
              {example.sentence}
              {showResult && example.translation && (
                <div className="example-translation">Çeviri: {example.translation}</div>
              )}
            </div>
          )}
          {debugInfo && <div className="example-debug">{debugInfo}</div>}
        </div>
      )}

      <div className="options">
        {question.options?.map((option, index) => (
          <button
            key={`${question.id}-${index}`}
            className={getButtonClass(option)}
            onClick={() => handleOptionClick(option)}
            disabled={showResult}
          >
            <span className="option-letter">{String.fromCharCode(65 + index)}</span>
            <span className="option-text">{option}</span>
            {showResult && optionMeaning && (
              <span className="option-meaning-inline">{optionMeaning(option) || '—'}</span>
            )}
            {showResult && option === question.correctAnswer && <span className="option-icon">✓</span>}
            {showResult && option === selectedAnswer && option !== question.correctAnswer && (
              <span className="option-icon">✕</span>
            )}
          </button>
        ))}
      </div>
      {!showResult && (
        <div style={{ marginTop: '14px', textAlign: 'center' }}>
          <button className="btn btn-outline btn-sm" onClick={handleUnknown}>
            Bilmiyorum / Listeye ekle
          </button>
        </div>
      )}
      {showResult && (
        <div className={`result-feedback ${selectedAnswer === question.correctAnswer ? 'correct' : 'incorrect'}`}>
          {selectedAnswer === question.correctAnswer ? (
            <>Doğru!</>
          ) : (
            <>
              {selectedAnswer === 'UNKNOWN' ? 'Bilmiyorum olarak işaretlendi. ' : 'Yanlış! '}
              Doğru cevap: <strong>{question.correctAnswer}</strong>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default MultipleChoice;

