import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Debug helpers to confirm bundle execution and catch runtime errors
console.log('index.tsx loaded');
window.addEventListener('error', (e) => {
  console.error('Unhandled error event:', e.error || e.message || e);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled rejection:', e.reason || e);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);