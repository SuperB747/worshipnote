import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// React DevTools 경고 완전 제거
const originalWarn = console.warn;
const originalLog = console.log;
const originalError = console.error;

// DevTools 관련 모든 메시지 차단
const blockDevToolsMessage = (message) => {
  if (typeof message === 'string') {
    return message.includes('Download the React DevTools') ||
           message.includes('React DevTools') ||
           message.includes('DevTools') ||
           message.includes('devtools://');
  }
  return false;
};

console.warn = (...args) => {
  if (args[0] && blockDevToolsMessage(args[0])) {
    return;
  }
  originalWarn.apply(console, args);
};

console.log = (...args) => {
  if (args[0] && blockDevToolsMessage(args[0])) {
    return;
  }
  originalLog.apply(console, args);
};

console.error = (...args) => {
  if (args[0] && blockDevToolsMessage(args[0])) {
    return;
  }
  originalError.apply(console, args);
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
