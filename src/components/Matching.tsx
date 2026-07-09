import React, { useState, useEffect } from 'react';
import { Word } from '../types';
import { shuffleArray } from '../services/quizEngine';
import { useWordListStore } from '../stores/wordListStore';
import { DEFAULT_STUDY_LANGUAGE, getStudyLanguageConfig } from '../utils/languages';

interface MatchingProps {
  words: Word[];
  onComplete: (correct: number, total: number, wrongWords: Word[]) => void;
  onExit?: () => void;
  onWordResult?: (wordId: string, isCorrect: boolean) => void;
}

interface Card {
  id: string;
  text: string;
  type: 'english' | 'turkish';
  wordId: string;
  isMatched: boolean;
}

const Matching: React.FC<MatchingProps> = ({ words, onComplete, onExit, onWordResult }) => {
  const activeLanguage = useWordListStore((state) => state.activeLanguage);
  const languageConfig = getStudyLanguageConfig(activeLanguage || DEFAULT_STUDY_LANGUAGE);
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<string[]>([]);
  const [wrongAttempts, setWrongAttempts] = useState<string[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    // Kartları oluştur
    const gameWords = words.slice(0, 8);
    
    const englishCards: Card[] = gameWords.map((word, idx) => ({
      id: `eng-${idx}`,
      text: word.english,
      type: 'english',
      wordId: word.id,
      isMatched: false,
    }));

    const turkishCards: Card[] = gameWords.map((word, idx) => ({
      id: `tr-${idx}`,
      text: word.turkish,
      type: 'turkish',
      wordId: word.id,
      isMatched: false,
    }));

    // Kartları karıştır
    setCards(shuffleArray([...englishCards, ...turkishCards]));
  }, [words]);

  const handleCardClick = (card: Card) => {
    if (isChecking || card.isMatched) return;

    // Eğer hiç kart seçili değilse
    if (!selectedCard) {
      setSelectedCard(card);
      return;
    }

    // Aynı karta tıklandıysa seçimi kaldır
    if (selectedCard.id === card.id) {
      setSelectedCard(null);
      return;
    }

    // Aynı tip kart seçildiyse değiştir
    if (selectedCard.type === card.type) {
      setSelectedCard(card);
      return;
    }

    // Eşleşme kontrolü
    setIsChecking(true);
    
    if (selectedCard.wordId === card.wordId) {
      // Doğru eşleşme - önce matched olarak işaretle
      setCards((prev) =>
        prev.map((c) =>
          c.wordId === selectedCard.wordId ? { ...c, isMatched: true } : c
        )
      );
      
      // Kelime başarısını güncelle
      if (onWordResult) {
        onWordResult(selectedCard.wordId, true);
      }
      
      // Animasyon bittikten sonra listeden kaldır (0.3s animasyon)
      setTimeout(() => {
        setMatchedPairs((prev) => [...prev, selectedCard.wordId]);
      }, 50);
      
      // Tamamlandı mı kontrol et
      const newMatchedCount = matchedPairs.length + 1;
      const totalPairs = words.slice(0, 8).length;
      
      if (newMatchedCount === totalPairs) {
        const wrongWords = words.filter((w) => wrongAttempts.includes(w.id));
        setTimeout(() => {
          onComplete(totalPairs - wrongWords.length, totalPairs, wrongWords);
        }, 1000);
      }
    } else {
      // Yanlış eşleşme
      if (!wrongAttempts.includes(selectedCard.wordId)) {
        setWrongAttempts((prev) => [...prev, selectedCard.wordId]);
        // Kelime başarısını güncelle (yanlış)
        if (onWordResult) {
          onWordResult(selectedCard.wordId, false);
        }
      }
    }

    setTimeout(() => {
      setSelectedCard(null);
      setIsChecking(false);
    }, 300);
  };

  const getCardClass = (card: Card) => {
    let className = 'matching-card';
    
    if (card.isMatched) {
      className += ' matched hidden';
    } else if (selectedCard?.id === card.id) {
      className += ' selected';
    }
    
    return className;
  };

  // Eşleşen kartlar animasyon bittikten sonra gizlenir
  const visibleCards = cards.filter(card => !matchedPairs.includes(card.wordId));
  const progress = (matchedPairs.length / words.slice(0, 8).length) * 100;

  return (
    <div className="matching-container">
      {/* Çıkış Butonu */}
      {onExit && (
        <button 
          className="quiz-exit-btn"
          onClick={onExit}
          title="Quizden Çık"
        >
          ✕
        </button>
      )}
      
      <h1 style={{ textAlign: 'center', marginBottom: '20px' }}>🔗 Eşleştirme Oyunu</h1>
      
      <div style={{ marginBottom: '30px' }}>
        <div className="quiz-progress">
          <div 
            className="quiz-progress-bar" 
            style={{ width: `${progress}%` }}
          />
        </div>
        <p style={{ textAlign: 'center', marginTop: '10px', color: 'var(--text-secondary)' }}>
          {matchedPairs.length} / {words.slice(0, 8).length} eşleşme tamamlandı
        </p>
      </div>

      <p style={{ textAlign: 'center', marginBottom: '20px', color: 'var(--text-secondary)' }}>
        {languageConfig.sourceLabel} kelimeyi Türkçe karşılığıyla eşleştirin
      </p>

      <div className="matching-grid">
        {visibleCards.map((card) => (
          <div
            key={card.id}
            className={getCardClass(card)}
            onClick={() => handleCardClick(card)}
            style={{
              backgroundColor: card.type === 'english' 
                ? 'rgba(99, 102, 241, 0.1)' 
                : 'rgba(16, 185, 129, 0.1)',
              borderColor: selectedCard?.id === card.id 
                ? 'var(--primary-color)' 
                : 'var(--border-color)',
            }}
          >
            <span style={{ 
              fontSize: '0.75rem', 
              color: 'var(--text-secondary)',
              display: 'block',
              marginBottom: '5px'
            }}>
              {card.type === 'english' ? `${languageConfig.flag} ${languageConfig.sourceShortLabel}` : '🇹🇷 TR'}
            </span>
            {card.text}
          </div>
        ))}
      </div>

      {visibleCards.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--success-color)' }}>
          <h2>🎉 Tebrikler!</h2>
          <p>Tüm eşleştirmeleri tamamladınız!</p>
        </div>
      )}
    </div>
  );
};

export default Matching;
