import { StrictMode } from 'react';
import { hydrateRoot, createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';
import { SSRData } from './types';

// Disable browser auto-scroll restoration for reliable navigation
if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

declare global {
  interface Window {
    __INITIAL_DATA__?: SSRData;
  }
}

const rootElement = document.getElementById('root')!;
const initialData = typeof window !== 'undefined' ? window.__INITIAL_DATA__ : undefined;

if (initialData && rootElement.hasChildNodes()) {
  hydrateRoot(
    rootElement,
    <StrictMode>
      <ErrorBoundary>
        <App ssrRoute={initialData.route} ssrData={initialData} />
      </ErrorBoundary>
    </StrictMode>
  );
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App ssrRoute={initialData?.route} ssrData={initialData} />
      </ErrorBoundary>
    </StrictMode>
  );
}

