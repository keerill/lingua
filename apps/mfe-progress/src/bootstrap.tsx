import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProgressApp from './ProgressApp';

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
      <BrowserRouter basename="/progress">
        <ProgressApp api={api} />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
