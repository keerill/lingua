import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { Scenario, ScenarioSummary } from '@lingua/contracts';
import { ScenarioProvider } from '../../domain/ports/scenario.provider';

@Injectable()
export class ContentScenarioHttpClient implements ScenarioProvider {
  private readonly http: AxiosInstance = axios.create({
    baseURL: process.env.SVC_CONTENT_URL ?? 'http://localhost:3106',
    timeout: 5000,
  });
  private readonly cache = new Map<
    string,
    { scenario: Scenario; expires: number }
  >();
  private readonly ttlMs = 60_000;

  async list(): Promise<ScenarioSummary[]> {
    const { data } =
      await this.http.get<ScenarioSummary[]>('/public/scenarios');
    return data;
  }

  async get(id: string): Promise<Scenario | null> {
    const hit = this.cache.get(id);
    if (hit && hit.expires > Date.now()) return hit.scenario;
    try {
      const { data } = await this.http.get<Scenario>(
        `/internal/scenarios/${id}`,
      );
      this.cache.set(id, { scenario: data, expires: Date.now() + this.ttlMs });
      return data;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) return null;
      throw err;
    }
  }

  invalidate(scenarioId?: string): void {
    if (scenarioId) this.cache.delete(scenarioId);
    else this.cache.clear();
  }
}
