import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// React DevTools 경고 숨기기 (개발 환경에서만)
if (process.env.NODE_ENV === 'development') {
  // React DevTools 경고를 숨기기 위해 console.warn을 일시적으로 오버라이드
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (args[0] && args[0].includes('Download the React DevTools')) {
      return;
    }
    originalWarn.apply(console, args);
  };
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
