import { createContext, useContext, useMemo, type ReactNode } from 'react';

export type ApiFetch = (path: string, init?: RequestInit) => Promise<Response>;

export interface ScenarioInfo {
  id: string;
  title: string;
  description: string;
}

export interface SpeakingApi {
  listScenarios(): Promise<ScenarioInfo[]>;
}

const ApiContext = createContext<SpeakingApi | null>(null);

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
  const client = useMemo<SpeakingApi>(
    () => ({
      listScenarios: () =>
        api('/speaking/scenarios').then(json<ScenarioInfo[]>),
    }),
    [api],
  );
  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApi(): SpeakingApi {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error('useApi must be used within ApiProvider');
  return ctx;
}
