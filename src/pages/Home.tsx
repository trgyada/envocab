import React, { useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CalendarCheck2,
  CirclePlay,
  Flame,
  Layers3,
  Library,
  ListChecks,
  Trophy,
} from 'lucide-react';
import { useWordListStore } from '../stores/wordListStore';
import { useUserProgressStore } from '../stores/userProgressStore';
import { DEFAULT_STUDY_LANGUAGE, getStudyLanguageConfig } from '../utils/languages';

const toLocalDayKey = (date: Date) =>
  [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');

const Home: React.FC = memo(() => {
  const wordLists = useWordListStore((state) => state.wordLists);
  const activeLanguage = useWordListStore((state) => state.activeLanguage);
  const selectedListId = useWordListStore((state) => state.selectedListId);
  const selectWordList = useWordListStore((state) => state.selectWordList);
  const quizResults = useUserProgressStore((state) => state.quizResults);
  const studyLanguage = activeLanguage || DEFAULT_STUDY_LANGUAGE;
  const languageConfig = getStudyLanguageConfig(studyLanguage);
  const activeList = wordLists.find((list) => list.id === selectedListId) || wordLists[0] || null;
  const languageResults = useMemo(
    () => quizResults.filter((result) => (result.language || DEFAULT_STUDY_LANGUAGE) === studyLanguage),
    [quizResults, studyLanguage]
  );
  const stats = useMemo(() => {
    const totalScore = languageResults.reduce((sum, result) => sum + result.score, 0);
    const dayKeys = new Set(languageResults.map((result) => toLocalDayKey(new Date(result.completedAt))));
    let streakDays = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    while (dayKeys.has(toLocalDayKey(cursor))) {
      streakDays += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return {
      totalQuizzes: languageResults.length,
      averageScore: languageResults.length ? Math.round(totalScore / languageResults.length) : 0,
      streakDays,
    };
  }, [languageResults]);

  const totalWords = useMemo(
    () => wordLists.reduce((acc, list) => acc + list.words.length, 0),
    [wordLists]
  );
  const activeListMasteredWords = useMemo(
    () => activeList?.words.filter((word) => word.mastery >= 80).length || 0,
    [activeList]
  );

  const primaryTarget = activeList ? '/quiz' : '/word-lists';
  const primaryLabel = activeList ? 'Çalışmaya devam et' : 'İlk listeni oluştur';

  return (
    <div className="home-container">
      <section className="dashboard-intro">
        <div className="dashboard-intro-copy">
          <span className="dashboard-eyebrow">
            <span aria-hidden="true">{languageConfig.flag}</span>
            {languageConfig.sourceLabel} çalışma alanı
          </span>
          <h1>Bugünkü kelime çalışman hazır.</h1>
          <p>
            {activeList
              ? `${activeList.title} listesindeki ${activeList.words.length} kelimeyle kaldığın yerden devam et.`
              : `${languageConfig.sourceLabel} öğrenmeye başlamak için ilk kelime listeni ekle.`}
          </p>
          <div className="dashboard-actions">
            <Link
              to={primaryTarget}
              className="btn btn-primary"
              onClick={() => activeList && selectWordList(activeList.id)}
            >
              <CirclePlay size={19} aria-hidden="true" />
              {primaryLabel}
            </Link>
            <Link to="/word-lists" className="btn btn-outline">
              <Library size={18} aria-hidden="true" />
              Listeleri yönet
            </Link>
          </div>
        </div>

        <aside className="active-list-panel" aria-label="Aktif çalışma özeti">
          <div className="active-list-panel-header">
            <span>Aktif liste</span>
            <BookOpenCheck size={20} aria-hidden="true" />
          </div>
          {activeList ? (
            <>
              <strong>{activeList.title}</strong>
              <p>{activeList.words.length} kelime çalışmaya hazır</p>
              <div className="active-list-progress" aria-label={`${activeListMasteredWords} kelime öğrenildi`}>
                <span
                  style={{
                    width: `${activeList.words.length ? Math.round((activeListMasteredWords / activeList.words.length) * 100) : 0}%`,
                  }}
                />
              </div>
              <small>{activeListMasteredWords} / {activeList.words.length} kelime öğrenildi</small>
            </>
          ) : (
            <>
              <strong>Henüz liste yok</strong>
              <p>Excel, CSV veya manuel girişle ilk listen birkaç dakikada hazır olur.</p>
            </>
          )}
        </aside>
      </section>

      <section className="stats-overview" aria-label="Çalışma özeti">
        <div className="stat-box">
          <div className="stat-icon" aria-hidden="true"><Layers3 size={20} /></div>
          <div className="stat-value">{wordLists.length}</div>
          <div className="stat-label">Kelime Listesi</div>
        </div>
        <div className="stat-box">
          <div className="stat-icon" aria-hidden="true"><ListChecks size={20} /></div>
          <div className="stat-value">{totalWords}</div>
          <div className="stat-label">Toplam Kelime</div>
        </div>
        <div className="stat-box">
          <div className="stat-icon" aria-hidden="true"><Trophy size={20} /></div>
          <div className="stat-value">{stats.totalQuizzes}</div>
          <div className="stat-label">Tamamlanan Quiz</div>
        </div>
        <div className="stat-box">
          <div className="stat-icon" aria-hidden="true"><Flame size={20} /></div>
          <div className="stat-value">{stats.streakDays}</div>
          <div className="stat-label">Günlük Seri</div>
        </div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section-heading">
          <div>
            <span className="dashboard-eyebrow">Kısayollar</span>
            <h2>Ne çalışmak istiyorsun?</h2>
          </div>
          {stats.averageScore > 0 && (
            <span className="average-chip"><CalendarCheck2 size={16} /> Son ortalama %{stats.averageScore}</span>
          )}
        </div>

        <div className="navigation">
          <Link to="/word-lists" className="nav-card">
            <span className="nav-card-icon" aria-hidden="true"><Library size={23} /></span>
            <h3 className="nav-card-title">Kelime Listeleri</h3>
            <p className="nav-card-description">
              Excel veya CSV dosyalarından kelime listeleri yükle ve düzenle
            </p>
            <span className="nav-card-footer">
              <span>{wordLists.length > 0 ? `${wordLists.length} liste` : 'Liste oluştur'}</span>
              <ArrowRight size={18} aria-hidden="true" />
            </span>
          </Link>

          <Link to="/quiz" className="nav-card" onClick={() => activeList && selectWordList(activeList.id)}>
            <span className="nav-card-icon" aria-hidden="true"><CirclePlay size={23} /></span>
            <h3 className="nav-card-title">Quiz Başlat</h3>
            <p className="nav-card-description">Çoktan seçmeli, flashcard veya eşleştirme oyunuyla pratik yap</p>
            <span className="nav-card-footer">
              <span>5 çalışma modu</span>
              <ArrowRight size={18} aria-hidden="true" />
            </span>
          </Link>

          <Link to="/analytics" className="nav-card">
            <span className="nav-card-icon" aria-hidden="true"><BarChart3 size={23} /></span>
            <h3 className="nav-card-title">İstatistikler</h3>
            <p className="nav-card-description">Performansını analiz et, güçlü ve zayıf yönlerini keşfet</p>
            <span className="nav-card-footer">
              <span>{stats.averageScore > 0 ? `%${stats.averageScore} ortalama` : 'İlerlemeyi gör'}</span>
              <ArrowRight size={18} aria-hidden="true" />
            </span>
          </Link>
        </div>
      </section>

      {wordLists.length === 0 && (
        <div className="getting-started">
          <h3>Nasıl Başlarım?</h3>
          <ol>
            <li>Excel veya CSV dosyanı hazırla (1. sütun: {languageConfig.sourceLabel}, 2. sütun: Türkçe)</li>
            <li>"Kelime Listeleri" sayfasından dosyanı yükle</li>
            <li>Quiz modunu seç ve öğrenmeye başla</li>
          </ol>
        </div>
      )}
    </div>
  );
});

Home.displayName = 'Home';

export default Home;
