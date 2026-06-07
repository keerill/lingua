import type { ScenarioSummary } from '@lingua/contracts';

const API = process.env.CONTENT_PUBLIC_API_URL ?? 'http://localhost:3106';

async function safeGet<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API}${path}`, { cache: 'no-store' });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export const getScenarios = (): Promise<ScenarioSummary[]> =>
  safeGet<ScenarioSummary[]>('/public/scenarios', []);

export const getScenario = (slug: string): Promise<ScenarioSummary | null> =>
  safeGet<ScenarioSummary | null>(`/public/scenarios/${slug}`, null);
