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
    setTimeout(() => onAnswer(isCorrect, question.word), 1);
  };

  const handleUnknown = () => {
    if (showResult || isTransitioning) return;
    setSelectedAnswer('UNKNOWN');
    setShowResult(true);
    setIsTransitioning(true);
    setTimeout(() => onAnswer(false, question.word), 1);
  };

  const getButtonClass = (option: string) => {
    const base = 'option-btn';
    if (!showResult) return base;
    if (option === question.correctAnswer) return `${base} correct`;
    if (option === selectedAnswer && option !== question.correctAnswer) return `${base} incorrect`;
    return base;
  };

  const isEnglishToTurkish = question.direction !== 'tr-to-en';
  const directionLabel = isEnglishToTurkish ? 'Ingilizce -> Turkce' : 'Turkce -> Ingilizce';
  const speakCurrent = () => {
    const text = isEnglishToTurkish ? question.word.english : question.word.turkish;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = isEnglishToTurkish ? 'en-US' : 'tr-TR';
    speechSynthesis.speak(utter);
  };

  return (
    <div className="quiz-card">
      <div className="question-badge">{directionLabel}</div>
      <div className="question-text-row">
        <h2 className="question-text">
          {question.question}
          {question.word.partOfSpeech && (
            <span className="part-of-speech"> {getPartOfSpeechLabel(question.word.partOfSpeech)}</span>
          )}
        </h2>
        <button className="question-speak-btn" onClick={speakCurrent} title="Sesli oku">
          🔊
        </button>
      </div>
      <p className="question-hint">
        {isEnglishToTurkish ? 'Dogru Turkce karsiligini sec' : 'Dogru Ingilizce karsiligini sec'}
      </p>

      {onRequestExample && (
        <div className="example-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
            <div className="example-title">Ornek cumle (Gemini)</div>
            <button className="btn btn-outline btn-sm" onClick={onRequestExample} disabled={example?.loading}>
              {example?.loading ? 'Yukleniyor...' : 'Yeniden getir'}
            </button>
          </div>
          {example?.error && <div className="example-error">{example.error}</div>}
          {example?.sentence && (
            <div className="example-sentence">
              {example.sentence}
              {showResult && example.translation && (
                <div className="example-translation">Ceviri: {example.translation}</div>
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
            {showResult && optionMeaning && <span className="option-meaning-inline">{optionMeaning(option) || ''}</span>}
            {showResult && option === question.correctAnswer && <span className="option-icon"></span>}
            {showResult && option === selectedAnswer && option !== question.correctAnswer && (
              <span className="option-icon"></span>
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
              Doru cevap: <strong>{question.correctAnswer}</strong>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default MultipleChoice;
