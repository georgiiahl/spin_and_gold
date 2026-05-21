import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

if (window.location.pathname === '/spin_and_gold') {
  window.history.replaceState(null, '', '/spin_and_gold/');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename="/spin_and_gold">
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
