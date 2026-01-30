import React, { useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import { useWordListStore } from '../stores/wordListStore';
import { useUserProgressStore } from '../stores/userProgressStore';

const Home: React.FC = memo(() => {
  // Use shallow selectors to prevent unnecessary re-renders
  const wordLists = useWordListStore((state) => state.wordLists);
  const stats = useUserProgressStore((state) => state.stats);

  // Memoize computed value
  const totalWords = useMemo(
    () => wordLists.reduce((acc, list) => acc + list.words.length, 0),
    [wordLists]
  );

  return (
    <div className="home-container">
      <h1>VocabMaster</h1>
      <p>
        Excel dosyalarından kelime listeleri yükle, farklı quiz modlarıyla pratik yap ve ilerlemeni takip et!
      </p>

      <div className="stats-overview">
        <div className="stat-box">
          <div className="stat-icon" aria-hidden>
            📑
          </div>
          <div className="stat-value">{wordLists.length}</div>
          <div className="stat-label">Kelime Listesi</div>
        </div>
        <div className="stat-box">
          <div className="stat-icon" aria-hidden>
            🧠
          </div>
          <div className="stat-value">{totalWords}</div>
          <div className="stat-label">Toplam Kelime</div>
        </div>
        <div className="stat-box">
          <div className="stat-icon" aria-hidden>
            ✅
          </div>
          <div className="stat-value">{stats.totalQuizzes}</div>
          <div className="stat-label">Quiz Tamamlandı</div>
          <div className="stat-label">Gün Serisi: {stats.streakDays}</div>
        </div>
      </div>

      <div className="navigation">
        <Link to="/word-lists" className="nav-card">
          <span className="nav-card-icon" aria-hidden>
            📂
          </span>
          <h3 className="nav-card-title">Kelime Listeleri</h3>
          <p className="nav-card-description">
            Excel veya CSV dosyalarından kelime listeleri yükle ve düzenle
          </p>
          {wordLists.length > 0 && <span className="nav-card-badge">{wordLists.length} Liste</span>}
        </Link>

        <Link to="/quiz" className="nav-card">
          <span className="nav-card-icon" aria-hidden>
            🚀
          </span>
          <h3 className="nav-card-title">Quiz Başlat</h3>
          <p className="nav-card-description">Çoktan seçmeli, flashcard veya eşleştirme oyunuyla pratik yap</p>
          <span className="nav-card-badge">3 Mod</span>
        </Link>

        <Link to="/analytics" className="nav-card">
          <span className="nav-card-icon" aria-hidden>
            📊
          </span>
          <h3 className="nav-card-title">İstatistikler</h3>
          <p className="nav-card-description">Performansını analiz et, güçlü ve zayıf yönlerini keşfet</p>
          {stats.averageScore > 0 && <span className="nav-card-badge">%{stats.averageScore} Ortalama</span>}
        </Link>
      </div>

      {wordLists.length === 0 && (
        <div className="getting-started">
          <h3>Nasıl Başlarım?</h3>
          <ol>
            <li>Excel veya CSV dosyanı hazırla (1. sütun: İngilizce, 2. sütun: Türkçe)</li>
            <li>"Kelime Listeleri" sayfasından dosyanı yükle</li>
            <li>Quiz modunu seç ve öğrenmeye başla!</li>
          </ol>
        </div>
      )}
    </div>
  );
});

Home.displayName = 'Home';

export default Home;
