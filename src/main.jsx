import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth';
import { InstallProvider } from './pwa';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <HashRouter>
    <InstallProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </InstallProvider>
  </HashRouter>
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
