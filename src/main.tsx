import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Register service worker in production
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  if (window.location.protocol === 'https:' || window.location.hostname === 'localhost') {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // ignore
    });
  }
}