import React from 'react';
import { Link } from 'react-router-dom';
import { useUserProgressStore } from '../stores/userProgressStore';
import { useWordListStore } from '../stores/wordListStore';
import { useCardStore } from '../stores/cardStore';
import { useReviewSessionStore } from '../stores/reviewSessionStore';
import { getMasteryLabel, getMasteryColor } from '../services/sm2Algorithm';
import { MasteryLevel } from '../types';
import ProgressChart from '../components/ProgressChart';

const Analytics: React.FC = () => {
  const { stats, quizResults, getWeakWords } = useUserProgressStore();
  const { wordLists } = useWordListStore();
  
  // SM-2 Store'ları
  const { cardStates, getMasteryDistribution, getDifficultCards, cards } = useCardStore();
  const { getStreakDays, getTotalStats, getRecentSessions } = useReviewSessionStore();

  const weakWords = getWeakWords();
  
  // SM-2 İstatistikleri
  const masteryDistribution = getMasteryDistribution();
  const sm2Stats = getTotalStats();
  const streak = getStreakDays();
  const difficultCards = getDifficultCards(undefined, 0.6);
  
  // Due kartları hesapla
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueCardsCount = Object.values(cardStates).filter(state => {
    const nextReview = new Date(state.nextReviewDate);
    nextReview.setHours(0, 0, 0, 0);
    return nextReview <= today;
  }).length;

  // Son 7 günün verilerini hesapla
  const getLast7DaysData = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayResults = quizResults.filter(r => {
        const resultDate = new Date(r.completedAt).toISOString().split('T')[0];
        return resultDate === dateStr;
      });

      days.push({
        date: date.toLocaleDateString('tr-TR', { weekday: 'short' }),
        quizCount: dayResults.length,
        avgScore: dayResults.length > 0 
          ? Math.round(dayResults.reduce((sum, r) => sum + r.score, 0) / dayResults.length)
          : 0,
      });
    }
    return days;
  };

  const chartData = getLast7DaysData();

  if (quizResults.length === 0) {
    return (
      <div className="analytics-container">
        <h1 style={{ marginBottom: '30px' }}>📈 İstatistikler</h1>
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <p>Henüz istatistik yok.</p>
          <p style={{ fontSize: '0.9rem', marginBottom: '20px' }}>
            Quiz tamamladıkça performansınız burada görünecek.
          </p>
          <Link to="/quiz" className="btn btn-primary">
            İlk Quiz'i Başlat
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-container">
      <h1 style={{ marginBottom: '30px' }}>📈 İstatistikler</h1>

      {/* Genel İstatistikler */}
      <div className="analytics-grid" style={{ marginBottom: '30px' }}>
        <div className="analytics-card">
          <h3 style={{ color: 'var(--primary-color)', marginBottom: '15px' }}>📊 Genel Performans</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.totalQuizzes}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Toplam Quiz</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>%{stats.averageScore}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Ortalama Skor</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success-color)' }}>
                %{stats.bestScore}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>En İyi Skor</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--warning-color)' }}>
                {stats.streakDays} 🔥
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Gün Serisi</div>
            </div>
          </div>
        </div>

        <div className="analytics-card">
          <h3 style={{ color: 'var(--secondary-color)', marginBottom: '15px' }}>📚 Kelime Havuzu</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{wordLists.length}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Liste Sayısı</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                {wordLists.reduce((sum, list) => sum + list.words.length, 0)}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Toplam Kelime</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.totalWords}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Çalışılan Kelime</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.totalStudyTime} dk</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Çalışma Süresi</div>
            </div>
          </div>
        </div>
      </div>

      {/* Haftalık Grafik */}
      <div className="analytics-card" style={{ marginBottom: '30px' }}>
        <h3 style={{ marginBottom: '20px' }}>📅 Son 7 Gün</h3>
        <ProgressChart data={chartData} />
      </div>
      
      {/* SM-2 Mastery Dağılımı */}
      {Object.keys(cardStates).length > 0 && (
        <div className="analytics-card" style={{ marginBottom: '30px' }}>
          <h3 style={{ marginBottom: '20px' }}>🧠 Öğrenme Seviyesi Dağılımı</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {([5, 4, 3, 2, 1, 0] as MasteryLevel[]).map(level => {
              const count = masteryDistribution[level];
              const total = Object.keys(cardStates).length;
              const percentage = total > 0 ? (count / total) * 100 : 0;
              
              return (
                <div key={level} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ 
                    width: '100px', 
                    fontSize: '0.85rem',
                    color: getMasteryColor(level),
                    fontWeight: '500'
                  }}>
                    {getMasteryLabel(level)}
                  </div>
                  <div style={{ 
                    flex: 1, 
                    height: '24px', 
                    backgroundColor: 'var(--background-color)', 
                    borderRadius: '12px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${percentage}%`,
                      height: '100%',
                      backgroundColor: getMasteryColor(level),
                      borderRadius: '12px',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                  <div style={{ width: '60px', textAlign: 'right', fontSize: '0.9rem', fontWeight: '600' }}>
                    {count} ({Math.round(percentage)}%)
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Due Kartlar Bilgisi */}
          {dueCardsCount > 0 && (
            <div style={{ 
              marginTop: '20px', 
              padding: '15px', 
              backgroundColor: 'rgba(251, 146, 60, 0.1)', 
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <span style={{ fontWeight: '600', color: 'var(--warning-color)' }}>
                  ⏰ {dueCardsCount} kart
                </span>
                <span style={{ color: 'var(--text-secondary)', marginLeft: '5px' }}>
                  tekrar edilmeyi bekliyor
                </span>
              </div>
              <Link to="/quiz" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>
                Şimdi Çalış
              </Link>
            </div>
          )}
        </div>
      )}
      
      {/* SM-2 Detaylı İstatistikler */}
      {sm2Stats.totalSessions > 0 && (
        <div className="analytics-card" style={{ marginBottom: '30px' }}>
          <h3 style={{ color: 'var(--primary-color)', marginBottom: '15px' }}>📊 Spaced Repetition İstatistikleri</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '15px' }}>
            <div style={{ textAlign: 'center', padding: '15px', backgroundColor: 'var(--background-color)', borderRadius: '12px' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                🔥 {streak}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Günlük Seri</div>
            </div>
            <div style={{ textAlign: 'center', padding: '15px', backgroundColor: 'var(--background-color)', borderRadius: '12px' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--success-color)' }}>
                {sm2Stats.totalCardsReviewed}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Toplam Review</div>
            </div>
            <div style={{ textAlign: 'center', padding: '15px', backgroundColor: 'var(--background-color)', borderRadius: '12px' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--warning-color)' }}>
                %{Math.round(sm2Stats.averageAccuracy)}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Doğruluk Oranı</div>
            </div>
            <div style={{ textAlign: 'center', padding: '15px', backgroundColor: 'var(--background-color)', borderRadius: '12px' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--secondary-color)' }}>
                {Math.round(sm2Stats.totalStudyTimeMinutes)}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Dakika Çalışma</div>
            </div>
          </div>
        </div>
      )}

      {/* Zayıf Kelimeler */}
      {weakWords.length > 0 && (
        <div className="analytics-card" style={{ marginBottom: '30px' }}>
          <h3 style={{ color: 'var(--danger-color)', marginBottom: '15px' }}>
            ⚠️ Dikkat Edilmesi Gereken Kelimeler
          </h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '15px', fontSize: '0.9rem' }}>
            Bu kelimeler en çok yanlış yapılanlar. Bunlara özel çalışmanızı öneriyoruz.
          </p>
          <div style={{ display: 'grid', gap: '10px' }}>
            {weakWords.slice(0, 10).map((word, idx) => (
              <div 
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '12px 15px',
                  background: 'var(--background-color)',
                  borderRadius: '8px',
                  borderLeft: '3px solid var(--warning-color)'
                }}
              >
                <strong>{word.english}</strong>
                <span style={{ color: 'var(--text-secondary)' }}>{word.turkish}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Son Quiz Sonuçları */}
      <div className="analytics-card">
        <h3 style={{ marginBottom: '15px' }}>🕐 Son Quiz Sonuçları</h3>
        <div style={{ display: 'grid', gap: '10px' }}>
          {quizResults.slice(0, 10).map((result, idx) => (
            <div 
              key={idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 15px',
                background: 'var(--background-color)',
                borderRadius: '8px',
              }}
            >
              <div>
                <div style={{ fontWeight: '500' }}>{result.wordListTitle}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {new Date(result.completedAt).toLocaleDateString('tr-TR')} • {result.quizType}
                </div>
              </div>
              <div style={{ 
                fontWeight: 'bold', 
                color: result.score >= 70 ? 'var(--success-color)' : 'var(--warning-color)' 
              }}>
                %{result.score}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Analytics;