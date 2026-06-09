import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LearnerApp from './LearnerApp';

// Standalone dev harness (port 4201). In production the shell host renders
// <LearnerApp> with an authenticated `api`. Here we provide a thin fetch that
// relies on the BFF refresh cookie — handy for isolated UI work.
const BFF_URL = 'http://localhost:3000';
const api = (path: string, init: RequestInit = {}) =>
  fetch(`${BFF_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });

const queryClient = new QueryClient();
const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/app">
        <LearnerApp api={api} />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
