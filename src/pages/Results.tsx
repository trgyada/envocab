import React from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Word } from '../types';

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

  const { score, correct, total, wrongWords, quizType, duration } = state;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getEmoji = () => {
    if (score >= 90) return '🏆';
    if (score >= 70) return '🎉';
    if (score >= 50) return '👍';
    return '💪';
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
      case 'matching': return 'Eşleştirme';
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
              <div className="stat-value">⏱️ {formatDuration(duration)}</div>
              <div className="stat-label">Süre</div>
            </div>
          )}
        </div>

        {/* Yanlış Yapılan Kelimeler */}
        {wrongWords && wrongWords.length > 0 && (
          <div className="wrong-words-section">
            <h3>
              ❌ Yanlış Yapılan Kelimeler ({wrongWords.length})
            </h3>
            <div style={{ display: 'grid', gap: '10px' }}>
              {wrongWords.map((word, idx) => (
                <div key={idx} className="wrong-word-item">
                  <strong>{word.english}</strong>
                  <span>{word.turkish}</span>
                </div>
              ))}
            </div>
          </div>
        )}

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