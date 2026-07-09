import React, { useEffect, Suspense, lazy, memo, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useWordListStore } from './stores/wordListStore';
import { STUDY_LANGUAGES, StudyLanguage, getStudyLanguageConfig } from './utils/languages';

// Lazy load pages for better initial load performance
const Home = lazy(() => import('./pages/Home'));
const Quiz = lazy(() => import('./pages/Quiz'));
const Results = lazy(() => import('./pages/Results'));
const Analytics = lazy(() => import('./pages/Analytics'));
const WordLists = lazy(() => import('./pages/WordLists'));

// Loading fallback component
const PageLoader = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    minHeight: '50vh',
    color: 'var(--text-secondary)'
  }}>
    <div className="loading-spinner">Yükleniyor...</div>
  </div>
);

const IconHome = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 10.5 12 4l9 6.5" />
    <path d="M5 10v10h14V10" />
    <path d="M9 20v-6h6v6" />
  </svg>
);

const IconFolder = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 6h6l2 2h10v10a2 2 0 0 1-2 2H3Z" />
    <path d="M3 6v12a2 2 0 0 0 2 2h14" />
  </svg>
);

const IconRocket = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 3c-2 0-4 .7-5.5 2.2L6 7.7 9.3 11l2.5-2.5A6 6 0 0 0 14 3Z" />
    <path d="M13 11 7 17l4 4 6-6" />
    <path d="M9 19s-3 1-5-1 1-5 1-5" />
    <circle cx="15" cy="9" r="1.3" fill="currentColor" />
  </svg>
);

const IconChart = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="10" width="4" height="10" rx="1" />
    <rect x="10" y="6" width="4" height="14" rx="1" />
    <rect x="17" y="3" width="4" height="17" rx="1" />
  </svg>
);

const LanguageGate: React.FC<{ onSelect: (language: StudyLanguage) => void }> = ({ onSelect }) => (
  <main className="language-gate">
    <section className="language-gate-panel">
      <div className="language-gate-mark">V</div>
      <h1>Çalışmak istediğin dili seç</h1>
      <p>Listeler, quizler ve bulut kayıtları seçilen dile göre ayrı tutulur.</p>
      <div className="language-gate-options">
        {STUDY_LANGUAGES.map((language) => (
          <button key={language.id} className="language-gate-option" onClick={() => onSelect(language.id)}>
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

const Navigation: React.FC = memo(() => {
  const location = useLocation();
  const activeLanguage = useWordListStore((state) => state.activeLanguage);
  const setActiveLanguage = useWordListStore((state) => state.setActiveLanguage);
  const languageConfig = getStudyLanguageConfig(activeLanguage);

  const isActive = useCallback((path: string) => location.pathname === path, [location.pathname]);

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <div className="navbar-center">
          <Link to="/" aria-label="Ana sayfa" className="logo-text">
            V
          </Link>
        </div>
        <div className="navbar-links">
          <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>
            <span className="nav-icon"><IconHome /></span> Ana Sayfa
          </Link>
          <Link to="/word-lists" className={`nav-link ${isActive('/word-lists') ? 'active' : ''}`}>
            <span className="nav-icon accent"><IconFolder /></span> Listeler
          </Link>
          <Link to="/quiz" className={`nav-link ${isActive('/quiz') ? 'active' : ''}`}>
            <span className="nav-icon primary"><IconRocket /></span> Quiz
          </Link>
          <Link to="/analytics" className={`nav-link ${isActive('/analytics') ? 'active' : ''}`}>
            <span className="nav-icon accent"><IconChart /></span> İstatistik
          </Link>
        </div>
        <div className="language-switcher" aria-label="Çalışma dili">
          {STUDY_LANGUAGES.map((language) => (
            <button
              key={language.id}
              className={`language-switcher-btn ${languageConfig.id === language.id ? 'active' : ''}`}
              onClick={() => {
                if (languageConfig.id !== language.id) setActiveLanguage(language.id);
              }}
              title={`${language.name} çalış`}
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
    <Router>
      <Navigation />
      <main>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/quiz" element={<Quiz />} />
            <Route path="/results" element={<Results />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/word-lists" element={<WordLists />} />
          </Routes>
        </Suspense>
      </main>
    </Router>
  );
};

export default App;
