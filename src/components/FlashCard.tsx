import React, { useState } from 'react';
import { Word } from '../types';

interface FlashCardProps {
  word: Word;
  onAnswer: (isCorrect: boolean) => void;
  isEnglishToTurkish?: boolean;
}

const FlashCard: React.FC<FlashCardProps> = ({ word, onAnswer, isEnglishToTurkish = true }) => {
  const [flipped, setFlipped] = useState(false);
  const [answered, setAnswered] = useState(false);

  const frontText = isEnglishToTurkish ? word.english : word.turkish;
  const backText = isEnglishToTurkish ? word.turkish : word.english;

  const handleFlip = () => {
    if (!answered) {
      setFlipped(!flipped);
    }
  };

  const handleAnswer = (knew: boolean) => {
    setAnswered(true);
    setTimeout(() => {
      onAnswer(knew);
      setFlipped(false);
      setAnswered(false);
    }, 500);
  };

  return (
    <div className="flashcard-container">
      <div 
        className={`flashcard ${flipped ? 'flipped' : ''}`} 
        onClick={handleFlip}
      >
        <div className="flashcard-front">
          <span>{frontText}</span>
        </div>
        <div className="flashcard-back">
          <span>{backText}</span>
        </div>
      </div>

      {!flipped && (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '20px' }}>
          Kartı çevirmek için tıklayın
        </p>
      )}

      {flipped && !answered && (
        <div className="flashcard-controls">
          <button 
            className="btn btn-danger" 
            onClick={() => handleAnswer(false)}
          >
            ❌ Bilmedim
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={() => handleAnswer(true)}
          >
            ✓ Bildim
          </button>
        </div>
      )}
    </div>
  );
};

export default FlashCard;