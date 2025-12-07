import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Quiz from './pages/Quiz';
import Results from './pages/Results';
import Analytics from './pages/Analytics';
import WordLists from './pages/WordLists';
import { useWordListStore } from './stores/wordListStore';

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

const Navigation: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <Link to="/" className="navbar-brand">
          <span aria-hidden="true" className="brand-icon">🔥</span> VocabMaster
        </Link>
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
      </div>
    </nav>
  );
};

const App: React.FC = () => {
  const { hydrateFromCloud } = useWordListStore();

  useEffect(() => {
    hydrateFromCloud();
  }, [hydrateFromCloud]);

  return (
    <Router>
      <Navigation />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/results" element={<Results />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/word-lists" element={<WordLists />} />
        </Routes>
      </main>
    </Router>
  );
};

export default App;
