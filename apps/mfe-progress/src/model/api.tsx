import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ProgressDashboard } from '@lingua/contracts';

export type ApiFetch = (path: string, init?: RequestInit) => Promise<Response>;

export interface ProgressApi {
  getDashboard(): Promise<ProgressDashboard>;
}

const ApiContext = createContext<ProgressApi | null>(null);

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export function ApiProvider({
  api,
  children,
}: {
  api: ApiFetch;
  children: ReactNode;
}) {
  const client = useMemo<ProgressApi>(
    () => ({
      getDashboard: () =>
        api('/progress/dashboard').then(json<ProgressDashboard>),
    }),
    [api],
  );
  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApi(): ProgressApi {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error('useApi must be used within ApiProvider');
  return ctx;
}
