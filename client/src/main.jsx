import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

// StrictMode disabled — the animation engine uses time-based RAF loops
// and mutable cursor state; double-invoke in dev causes timing artifacts.
const root = createRoot(document.getElementById('root'));
root.render(<App />);
