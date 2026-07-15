import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { runClientInjectors } from './injectors.js';
import './styles.css';

// Injecte les payloads "cote client" (console, DOM offscreen, data-*, SVG)
// des le chargement, en fonction de la config serveur.
runClientInjectors();

createRoot(document.getElementById('root')).render(<App />);
