import React, { useState, useEffect } from 'react';
import { QuizQuestion, PartOfSpeech } from '../types';

interface MultipleChoiceProps {
  question: QuizQuestion;
  onAnswer: (isCorrect: boolean) => void;
}

// Kelime türü kısaltmalarını göster
const getPartOfSpeechLabel = (pos?: PartOfSpeech): string => {
  if (!pos) return '';
  const labels: Record<PartOfSpeech, string> = {
    'n': '(n.)',
    'v': '(v.)',
    'adj': '(adj.)',
    'adv': '(adv.)',
    'prep': '(prep.)',
    'conj': '(conj.)',
    'pron': '(pron.)',
    'interj': '(interj.)',
    'det': '(det.)',
    'phr': '(phr.)',
    '': ''
  };
  return labels[pos] || '';
};

const MultipleChoice: React.FC<MultipleChoiceProps> = ({ question, onAnswer }) => {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Soru değiştiğinde state'leri sıfırla
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
    
    // Kısa bir gecikme ile sonraki soruya geç
    setTimeout(() => {
      onAnswer(isCorrect);
    }, 200);
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

  return (
    <div className="quiz-card">
      <div className="question-badge">
        🇬🇧 İngilizce → 🇹🇷 Türkçe
      </div>
      <h2 className="question-text">
        {question.question}
        {question.word.partOfSpeech && (
          <span className="part-of-speech"> {getPartOfSpeechLabel(question.word.partOfSpeech)}</span>
        )}
      </h2>
      <p className="question-hint">
        Doğru Türkçe karşılığını seçin
      </p>
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
            {showResult && option === question.correctAnswer && (
              <span className="option-icon">✓</span>
            )}
            {showResult && option === selectedAnswer && option !== question.correctAnswer && (
              <span className="option-icon">✗</span>
            )}
          </button>
        ))}
      </div>
      {showResult && (
        <div className={`result-feedback ${selectedAnswer === question.correctAnswer ? 'correct' : 'incorrect'}`}>
          {selectedAnswer === question.correctAnswer ? (
            <>🎉 Doğru!</>
          ) : (
            <>❌ Yanlış! Doğru cevap: <strong>{question.correctAnswer}</strong></>
          )}
        </div>
      )}
    </div>
  );
};

export default MultipleChoice;