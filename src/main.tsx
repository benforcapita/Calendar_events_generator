import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import './index.css';

// Initialize theme from storage
const settings = JSON.parse(localStorage.getItem('app_settings') || '{"theme":"light"}');
document.documentElement.classList.toggle('dark', settings.theme === 'dark');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
);