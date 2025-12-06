import React from 'react';
import { QuizQuestion } from '../types';

interface QuizCardProps {
  question: QuizQuestion;
  onAnswer: (selectedOption: string, isCorrect: boolean) => void;
}

const QuizCard: React.FC<QuizCardProps> = ({ question, onAnswer }) => {
  const handleOptionClick = (option: string) => {
    const isCorrect = option === question.correctAnswer;
    onAnswer(option, isCorrect);
  };

  return (
    <div className="quiz-card">
      <h2>{question.question}</h2>
      <div className="options">
        {question.options?.map((option, index) => (
          <button 
            key={index} 
            className="option-btn"
            onClick={() => handleOptionClick(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuizCard;