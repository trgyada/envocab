import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { ensureSession } from './services/authSession';

const rootEl = document.getElementById('root');

const renderApp = () => {
  if (!rootEl) return;
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

// Ensure Firebase session, then render
ensureSession()
  .catch(() => {
    // Already logged in or credentials missing; app can still render for public data
  })
  .finally(renderApp);
