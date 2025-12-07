import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Quiz from './pages/Quiz';
import Results from './pages/Results';
import Analytics from './pages/Analytics';
import WordLists from './pages/WordLists';
import { useWordListStore } from './stores/wordListStore';

const Navigation: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <Link to="/" className="navbar-brand">
          <span aria-hidden="true">🔥</span> VocabMaster
        </Link>
        <div className="navbar-links">
          <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>
            🏠 Ana Sayfa
          </Link>
          <Link to="/word-lists" className={`nav-link ${isActive('/word-lists') ? 'active' : ''}`}>
            📂 Listeler
          </Link>
          <Link to="/quiz" className={`nav-link ${isActive('/quiz') ? 'active' : ''}`}>
            🚀 Quiz
          </Link>
          <Link to="/analytics" className={`nav-link ${isActive('/analytics') ? 'active' : ''}`}>
            📊 İstatistik
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
