import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUserProgressStore } from '../stores/userProgressStore';
import { useWordListStore } from '../stores/wordListStore';
import { useCardStore } from '../stores/cardStore';
import { useReviewSessionStore } from '../stores/reviewSessionStore';
import { getMasteryLabel, getMasteryColor } from '../services/sm2Algorithm';
import { MasteryLevel } from '../types';
import ProgressChart from '../components/ProgressChart';

const Analytics: React.FC = () => {
  const navigate = useNavigate();
  const { stats, quizResults, getWeakWords, resetStats } = useUserProgressStore();
  const { wordLists } = useWordListStore();
  const { cardStates, getMasteryDistribution, cards, resetAllCardStates, getDifficultCards } = useCardStore();
  const { getTotalStats, clearHistory } = useReviewSessionStore();

  const [showDueCardsModal, setShowDueCardsModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const weakWords = getWeakWords();
  const masteryDistribution = getMasteryDistribution();
  const sm2Stats = getTotalStats();
  getDifficultCards(undefined, 0.6); // warm up

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueCardsWithDetails = Object.entries(cardStates)
    .filter(([_, state]) => {
      const nextReview = new Date(state.nextReviewDate);
      nextReview.setHours(0, 0, 0, 0);
      return nextReview <= today;
    })
    .map(([cardId, state]) => {
      const card = cards.find((c) => c.id === cardId);
      return {
        cardId,
        state,
        card,
        english: card?.frontContent || '',
        turkish: card?.backContent || '',
        masteryLevel: state.masteryLevel,
        dueDate: new Date(state.nextReviewDate)
      };
    })
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  const dueCardsCount = dueCardsWithDetails.length;

  const handleResetAllStats = () => {
    resetAllCardStates();
    clearHistory();
    resetStats();
    setShowResetConfirm(false);
    alert('Tum istatistikler sifirlandi!');
  };

  const handleStartDueCardsQuiz = () => {
    const dueWordIds = dueCardsWithDetails.map((d) => d.card?.wordId).filter(Boolean) as string[];
    navigate('/quiz', { state: { dueWordIds, mode: 'due-review' } });
    setShowDueCardsModal(false);
  };

  const getLast7DaysData = () => {
    const days: { date: string; quizCount: number; avgScore: number }[] = [];
    const toKey = (d: Date) => {
      const copy = new Date(d);
      copy.setHours(0, 0, 0, 0);
      return copy.toLocaleDateString('tr-TR');
    };

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - i);
      const dateKey = toKey(date);

      const dayResults = quizResults.filter((r) => toKey(new Date(r.completedAt)) === dateKey);

      days.push({
        date: date.toLocaleDateString('tr-TR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
        quizCount: dayResults.length,
        avgScore:
          dayResults.length > 0
            ? Math.round(dayResults.reduce((sum, r) => sum + r.score, 0) / dayResults.length)
            : 0
      });
    }
    return days;
  };

  const chartData = getLast7DaysData();

  if (quizResults.length === 0) {
    return (
      <div className="analytics-container">
        <h1 style={{ marginBottom: '30px' }}>Istatistikler</h1>
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <p>Henuz istatistik yok.</p>
          <p style={{ fontSize: '0.9rem', marginBottom: '20px' }}>
            Quiz tamamladikca performans burada gorunecek.
          </p>
          <Link to="/quiz" className="btn btn-primary">
            Quiz Baslat
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-container">
      <h1 style={{ marginBottom: '30px' }}>Istatistikler</h1>

      <div className="analytics-grid" style={{ marginBottom: '24px' }}>
        <div className="analytics-card">
          <h3 style={{ color: 'var(--primary)', marginBottom: '15px' }}>Genel Performans</h3>
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
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>%{stats.bestScore}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>En Iyi Skor</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.totalStudyTime} dk</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Toplam Calisma</div>
            </div>
          </div>
        </div>

        <div className="analytics-card">
          <h3 style={{ color: 'var(--accent)', marginBottom: '15px' }}>Kelime Havuzu</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{wordLists.length}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Liste Sayisi</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                {wordLists.reduce((sum, list) => sum + list.words.length, 0)}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Toplam Kelime</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.totalWords}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Calisilan Kelime</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.totalStudyTime} dk</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Calisma Suresi</div>
            </div>
          </div>
        </div>
      </div>

      <div className="analytics-card" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px' }}>Son 7 Gun</h3>
        <ProgressChart data={chartData} />
      </div>

      {Object.keys(cardStates).length > 0 && (
        <div className="analytics-card" style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '16px' }}>Ogrenme Seviyesi Dagilimi</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {([5, 4, 3, 2, 1, 0] as MasteryLevel[]).map((level) => {
              const count = masteryDistribution[level];
              const total = Object.keys(cardStates).length;
              const percentage = total > 0 ? (count / total) * 100 : 0;

              return (
                <div key={level} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '110px',
                      fontSize: '0.9rem',
                      color: getMasteryColor(level),
                      fontWeight: '600'
                    }}
                  >
                    {getMasteryLabel(level)}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      height: '22px',
                      backgroundColor: '#f1f5f9',
                      borderRadius: '11px',
                      overflow: 'hidden'
                    }}
                  >
                    <div
                      style={{
                        width: `${percentage}%`,
                        height: '100%',
                        backgroundColor: getMasteryColor(level),
                        borderRadius: '11px',
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                  <div style={{ width: '70px', textAlign: 'right', fontSize: '0.9rem', fontWeight: '700' }}>
                    {count} ({Math.round(percentage)}%)
                  </div>
                </div>
              );
            })}
          </div>

          {dueCardsCount > 0 && (
            <div
              style={{
                marginTop: '18px',
                padding: '14px',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                borderRadius: '10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <span style={{ fontWeight: '700', color: 'var(--warning)' }}>{dueCardsCount} kart</span>
                <span style={{ color: 'var(--text-secondary)', marginLeft: '6px' }}>tekrar bekliyor</span>
              </div>
              <button
                onClick={() => setShowDueCardsModal(true)}
                className="btn btn-primary"
                style={{ padding: '8px 14px', fontSize: '0.9rem' }}
              >
                Simdi Calis
              </button>
            </div>
          )}
        </div>
      )}

      {sm2Stats.totalSessions > 0 && (
        <div className="analytics-card" style={{ marginBottom: '24px' }}>
          <h3 style={{ color: 'var(--primary)', marginBottom: '12px' }}>Spaced Repetition Ozeti</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
            <div style={{ textAlign: 'center', padding: '14px', background: 'rgba(41, 182, 246, 0.1)', borderRadius: '12px' }}>
              <div style={{ fontSize: '1.7rem', fontWeight: 'bold', color: 'var(--success)' }}>
                {sm2Stats.totalCardsReviewed}
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Toplam Review</div>
            </div>
            <div style={{ textAlign: 'center', padding: '14px', background: 'rgba(41, 182, 246, 0.1)', borderRadius: '12px' }}>
              <div style={{ fontSize: '1.7rem', fontWeight: 'bold', color: 'var(--warning)' }}>
                %{Math.round(sm2Stats.averageAccuracy)}
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Dogruluk</div>
            </div>
            <div style={{ textAlign: 'center', padding: '14px', background: 'rgba(41, 182, 246, 0.1)', borderRadius: '12px' }}>
              <div style={{ fontSize: '1.7rem', fontWeight: 'bold', color: 'var(--accent)' }}>
                {Math.round(sm2Stats.totalStudyTimeMinutes)}
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Dakika Calisma</div>
            </div>
          </div>
        </div>
      )}

      {weakWords.length > 0 && (
        <div className="analytics-card" style={{ marginBottom: '24px' }}>
          <h3 style={{ color: 'var(--danger)', marginBottom: '12px' }}>Dikkat Edilmesi Gereken Kelimeler</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: '0.95rem' }}>
            Bu kelimeler en cok hata yaptiklarin. Oncelikli calisman onerilir.
          </p>
          <div style={{ display: 'grid', gap: '10px' }}>
            {weakWords.slice(0, 10).map((word, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: 'rgba(41, 182, 246, 0.1)',
                  borderRadius: '10px',
                  borderLeft: '4px solid var(--danger)'
                }}
              >
                <strong>{word.english}</strong>
                <span style={{ color: 'var(--text-secondary)' }}>{word.turkish}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="analytics-card" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '12px' }}>Son Quiz Sonuclari</h3>
        <div style={{ display: 'grid', gap: '10px' }}>
          {quizResults.slice(0, 10).map((result, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 14px',
                background: 'rgba(41, 182, 246, 0.1)',
                borderRadius: '10px'
              }}
            >
              <div>
                <div style={{ fontWeight: '600' }}>{result.wordListTitle}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {new Date(result.completedAt).toLocaleDateString('tr-TR')} · {result.quizType}
                </div>
              </div>
              <div
                style={{
                  fontWeight: 'bold',
                  color: result.score >= 70 ? 'var(--success)' : 'var(--warning)'
                }}
              >
                %{result.score}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="analytics-card" style={{ marginTop: '24px', textAlign: 'center' }}>
        <h3 style={{ marginBottom: '12px', color: 'var(--danger)' }}>Tehlikeli Bolge</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '14px', fontSize: '0.95rem' }}>
          Tum SM-2 ogrenme verilerini, quiz gecmisini ve istatistikleri sifirlar. Kelime listeleri silinmez.
        </p>
        <button
          onClick={() => setShowResetConfirm(true)}
          className="btn btn-danger"
          style={{ padding: '10px 18px' }}
        >
          Her seyi sifirla
        </button>
      </div>

      {showDueCardsModal && (
        <div className="modal-overlay" onClick={() => setShowDueCardsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '80vh' }}>
            <h2 style={{ marginBottom: '16px' }}>Tekrar Edilecek Kelimeler ({dueCardsCount})</h2>

            <div
              style={{
                maxHeight: '400px',
                overflowY: 'auto',
                marginBottom: '20px',
                border: '1px solid var(--border)',
                borderRadius: '12px'
              }}
            >
              {dueCardsWithDetails.slice(0, 50).map((item, idx) => (
                <div
                  key={item.cardId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 14px',
                    borderBottom: idx < dueCardsWithDetails.length - 1 ? '1px solid var(--border)' : 'none',
                    background: idx % 2 === 0 ? 'transparent' : '#f8fafc'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', color: '#000' }}>{item.english}</div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{item.turkish}</div>
                  </div>
                  <div
                    style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      backgroundColor: getMasteryColor(item.masteryLevel) + '20',
                      color: getMasteryColor(item.masteryLevel)
                    }}
                  >
                    {getMasteryLabel(item.masteryLevel)}
                  </div>
                </div>
              ))}
              {dueCardsWithDetails.length > 50 && (
                <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  ... ve {dueCardsWithDetails.length - 50} kelime daha
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setShowDueCardsModal(false)}>
                Kapat
              </button>
              <button className="btn btn-primary" onClick={handleStartDueCardsQuiz}>
                Simdi Calis
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div className="modal-overlay" onClick={() => setShowResetConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <h2 style={{ marginBottom: '12px', color: 'var(--danger)' }}>Emin misin?</h2>
            <p style={{ marginBottom: '18px', color: 'var(--text-secondary)' }}>
              Bu islem tum SM-2 verilerini, kart durumlarini, quiz gecmisini ve istatistikleri kalici olarak silecek.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setShowResetConfirm(false)}>
                Iptal
              </button>
              <button className="btn btn-danger" onClick={handleResetAllStats}>
                Evet, sifirla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
