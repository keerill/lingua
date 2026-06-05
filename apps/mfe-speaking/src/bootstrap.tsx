import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SpeakingApp from './SpeakingApp';

const BFF_URL = (process.env.BFF_URL as string) || 'http://localhost:3000';
const api = (path: string, init: RequestInit = {}) =>
  fetch(`${BFF_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });

const hash = window.location.hash;
const accessToken = hash.startsWith('#access_token=')
  ? decodeURIComponent(hash.slice('#access_token='.length))
  : '';

const queryClient = new QueryClient();
const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/speaking">
        <SpeakingApp api={api} accessToken={accessToken} />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
