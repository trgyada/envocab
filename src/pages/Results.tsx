import React from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Word } from '../types';
import { useCardStore } from '../stores/cardStore';
import { useReviewSessionStore } from '../stores/reviewSessionStore';
import { useWordListStore } from '../stores/wordListStore';
import { getMasteryLabel, getMasteryColor } from '../services/sm2Algorithm';

interface ResultsState {
  score: number;
  correct: number;
  total: number;
  wrongWords: Word[];
  quizType: string;
  duration?: number;
}

const Results: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ResultsState | null;

  const { cards, cardStates, getCardByWordId } = useCardStore();
  const { getStreakDays, getRecentSessions } = useReviewSessionStore();
  const { wordLists } = useWordListStore();

  if (!state) {
    return (
      <div className="results-container">
        <div className="results-card">
          <h1>Sonuç Bulunamadı</h1>
          <p>Quiz sonucu bulunamadı. Lütfen bir quiz tamamlayın.</p>
          <Link to="/quiz" className="btn btn-primary" style={{ marginTop: '20px' }}>
            Quiz'e Git
          </Link>
        </div>
      </div>
    );
  }

  const { score, correct, total, wrongWords, quizType, duration, answerSheet, examMode } = state as any;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getEmoji = () => {
    if (score >= 90) return '⭐';
    if (score >= 70) return '✅';
    if (score >= 50) return '🙂';
    return '🔥';
  };

  const getMessage = () => {
    if (score >= 90) return 'Mükemmel! Harika bir performans!';
    if (score >= 70) return 'Çok iyi! Devam et!';
    if (score >= 50) return 'İyi gidiyorsun! Biraz daha çalış!';
    return 'Pratik yapmaya devam et!';
  };

  const getQuizTypeName = () => {
    switch (quizType) {
      case 'multiple-choice': return 'Çoktan Seçmeli';
      case 'flashcard': return 'Flashcard';
      case 'matching': return 'Eşleşme';
      case 'synonym': return 'Eş Anlamlı';
      case 'mixed': return 'Karışık';
      default: return 'Quiz';
    }
  };

  return (
    <div className="results-container">
      <div className="results-card">
        <div style={{ fontSize: '4rem', marginBottom: '10px' }}>{getEmoji()}</div>
        <h1 style={{ marginBottom: '10px' }}>{getMessage()}</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
          {getQuizTypeName()} tamamlandı!
        </p>

        <div className="results-score">%{score}</div>

        <div className="results-stats">
          <div className="stat-item">
            <div className="stat-value" style={{ color: 'var(--success-color)' }}>
              {correct}
            </div>
            <div className="stat-label">Doğru</div>
          </div>
          <div className="stat-item">
            <div className="stat-value" style={{ color: 'var(--danger-color)' }}>
              {total - correct}
            </div>
            <div className="stat-label">Yanlış</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{total}</div>
            <div className="stat-label">Toplam</div>
          </div>
          {duration !== undefined && (
            <div className="stat-item">
              <div className="stat-value">⏱ {formatDuration(duration)}</div>
              <div className="stat-label">Süre</div>
            </div>
          )}
        </div>

        {wrongWords && wrongWords.length > 0 && (
          <div className="wrong-words-section">
            <h3>Tekrar Edilmesi Gereken Kelimeler ({wrongWords.length})</h3>
            <div style={{ display: 'grid', gap: '10px' }}>
              {wrongWords.map((word: Word, idx: number) => {
                const card = getCardByWordId(word.id);
                const cardState = card ? cardStates[card.id] : null;
                const masteryLevel = cardState?.masteryLevel ?? 0;
                
                return (
                  <div key={idx} className="wrong-word-item" style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '12px 15px'
                  }}>
                    <div>
                      <strong>{word.english}</strong>
                      <span style={{ marginLeft: '10px', color: 'var(--text-secondary)' }}>
                        {word.turkish}
                      </span>
                    </div>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      padding: '4px 8px', 
                      borderRadius: '12px',
                      backgroundColor: getMasteryColor(masteryLevel),
                      color: '#fff'
                    }}>
                      {getMasteryLabel(masteryLevel)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {examMode && answerSheet && answerSheet.length > 0 && (
          <div className="wrong-words-section" style={{ marginTop: '20px' }}>
            <h3>Cevap Tablosu</h3>
            <div className="results-table">
              <div className="results-table-header">
                <span>Soru</span>
                <span>Cevabın</span>
                <span>Doğru Cevap</span>
              </div>
              {answerSheet.map((item: any, idx: number) => (
                <div key={idx} className="results-table-row">
                  <span>{item.word?.english}</span>
                  <span className={item.isCorrect ? 'answer-correct' : 'answer-wrong'}>{item.userAnswer}</span>
                  <span>{item.correctAnswer}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div style={{ 
          marginTop: '25px', 
          padding: '15px', 
          backgroundColor: 'rgba(102, 126, 234, 0.1)', 
          borderRadius: '12px',
          textAlign: 'center'
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                🔥 {getStreakDays()}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Günlük Seri
              </div>
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--success-color)' }}>
                📊 {getRecentSessions(30).length}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Bu Ay Quiz
              </div>
            </div>
            {cardStates && Object.keys(cardStates).length > 0 && (
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--warning-color)' }}>
                  🎯 {Object.values(cardStates).filter(s => s.masteryLevel >= 3).length}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Öğrenilen
                </div>
              </div>
            )}
          </div>
          <p style={{ 
            marginTop: '15px', 
            fontSize: '0.9rem', 
            color: 'var(--text-secondary)',
            marginBottom: 0
          }}>
            Spaced repetition sistemi ile kelimeler en uygun zamanda tekrar edilecek.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '30px' }}>
          <button 
            className="btn btn-outline"
            onClick={() => navigate('/')}
          >
            Ana Sayfa
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => navigate('/quiz')}
          >
            Yeni Quiz 🚀
          </button>
        </div>
      </div>
    </div>
  );
};

export default Results;
