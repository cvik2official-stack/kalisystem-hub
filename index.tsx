import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './src/App';
import { AppProvider } from './src/context/AppContext';
import { ToastProvider } from './src/context/ToastContext';
import ErrorBoundary from './src/components/ErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>
);