import React from 'react';
import { createRoot } from 'react-dom/client';
import App, { registerTools } from './App.jsx';
import { loadContent, EXTRA_TOOLS } from './game/content.js';
import { initSaves } from './game/saves.js';
import './styles.css';
try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* not supported in this webview */ }
Promise.all([initSaves().catch(() => {}), loadContent().catch(() => {})]).then(() => { registerTools(EXTRA_TOOLS); createRoot(document.getElementById('root')).render(<App />); });
