import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { applyStoredTheme } from './theme.js';
import './styles/global.css';
import './styles/cms.css';

applyStoredTheme();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
