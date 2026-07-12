import React, { useEffect, Suspense, lazy, memo } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, NavLink, Navigate } from 'react-router-dom';
import { BarChart3, BookOpen, Home as HomeIcon, Library, Play, Sparkles } from 'lucide-react';
import { useWordListStore } from './stores/wordListStore';
import { STUDY_LANGUAGES, StudyLanguage, getStudyLanguageConfig } from './utils/languages';

// Lazy load pages for better initial load performance
const Home = lazy(() => import('./pages/Home'));
const Quiz = lazy(() => import('./pages/Quiz'));
const Results = lazy(() => import('./pages/Results'));
const Analytics = lazy(() => import('./pages/Analytics'));
const WordLists = lazy(() => import('./pages/WordLists'));

const PageLoader = () => (
  <div className="page-loader" role="status" aria-live="polite">
    <div className="loading-spinner">Yükleniyor...</div>
  </div>
);

const LanguageGate: React.FC<{ onSelect: (language: StudyLanguage) => void }> = ({ onSelect }) => (
  <main className="language-gate">
    <section className="language-gate-panel">
      <div className="language-gate-mark" aria-hidden="true">
        <Sparkles size={24} />
      </div>
      <span className="language-gate-eyebrow">VocabMaster</span>
      <h1>Çalışmak istediğin dili seç</h1>
      <p>Listeler, quizler ve bulut kayıtları seçilen dile göre ayrı tutulur.</p>
      <div className="language-gate-options">
        {STUDY_LANGUAGES.map((language) => (
          <button
            key={language.id}
            type="button"
            className="language-gate-option"
            onClick={() => onSelect(language.id)}
          >
            <span className="language-gate-flag">{language.flag}</span>
            <span>
              <strong>{language.name}</strong>
              <small>{language.nativeName}</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  </main>
);

const navItems = [
  { to: '/', label: 'Ana Sayfa', icon: HomeIcon, end: true },
  { to: '/word-lists', label: 'Listeler', icon: Library },
  { to: '/quiz', label: 'Quiz', icon: Play },
  { to: '/analytics', label: 'İstatistik', icon: BarChart3 },
];

const Navigation: React.FC = memo(() => {
  const activeLanguage = useWordListStore((state) => state.activeLanguage);
  const setActiveLanguage = useWordListStore((state) => state.setActiveLanguage);
  const languageConfig = getStudyLanguageConfig(activeLanguage);

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <div className="navbar-center">
          <Link to="/" aria-label="VocabMaster ana sayfa" className="logo-text">
            <span className="logo-mark" aria-hidden="true">
              <BookOpen size={19} strokeWidth={2.4} />
            </span>
            <span className="logo-wordmark">VocabMaster</span>
          </Link>
        </div>
        <div className="navbar-links" aria-label="Ana menü">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon" aria-hidden="true">
                <Icon size={18} strokeWidth={2.2} />
              </span>
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
        <div className="language-switcher" aria-label="Çalışma dili">
          {STUDY_LANGUAGES.map((language) => (
            <button
              key={language.id}
              type="button"
              className={`language-switcher-btn ${languageConfig.id === language.id ? 'active' : ''}`}
              onClick={() => {
                if (languageConfig.id !== language.id) setActiveLanguage(language.id);
              }}
              aria-label={`${language.name} çalış`}
              aria-pressed={languageConfig.id === language.id}
            >
              <span>{language.flag}</span>
              <span>{language.sourceShortLabel}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
});

Navigation.displayName = 'Navigation';

const App: React.FC = () => {
  // Use shallow selector to avoid unnecessary re-renders
  const activeLanguage = useWordListStore((state) => state.activeLanguage);
  const setActiveLanguage = useWordListStore((state) => state.setActiveLanguage);
  const hydrateFromCloud = useWordListStore((state) => state.hydrateFromCloud);

  useEffect(() => {
    if (activeLanguage) {
      hydrateFromCloud(activeLanguage);
    }
  }, [activeLanguage, hydrateFromCloud]);

  if (!activeLanguage) {
    return <LanguageGate onSelect={setActiveLanguage} />;
  }

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Navigation />
      <main>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/quiz" element={<Quiz />} />
            <Route path="/results" element={<Results />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/word-lists" element={<WordLists />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </Router>
  );
};

export default App;
