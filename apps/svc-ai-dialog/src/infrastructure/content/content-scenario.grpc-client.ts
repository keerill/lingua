import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { ContentLevel, Scenario, ScenarioSummary } from '@lingua/contracts';
import { contentV1 } from '@lingua/contracts/proto';
import { ScenarioProvider } from '../../domain/ports/scenario.provider';

export const CONTENT_GRPC = 'CONTENT_GRPC';

function toScenario(s: contentV1.Scenario): Scenario {
  return {
    id: s.id,
    slug: s.slug,
    title: s.title,
    description: s.description,
    level: s.level as ContentLevel,
    systemPrompt: s.systemPrompt,
    published: s.published,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

function toSummary(s: contentV1.ScenarioSummary): ScenarioSummary {
  return {
    id: s.id,
    slug: s.slug,
    title: s.title,
    description: s.description,
    level: s.level as ContentLevel,
  };
}

@Injectable()
export class ContentScenarioGrpcClient
  implements ScenarioProvider, OnModuleInit
{
  private svc!: contentV1.ContentServiceClient;
  private readonly cache = new Map<
    string,
    { scenario: Scenario; expires: number }
  >();
  private readonly ttlMs = 60_000;

  constructor(@Inject(CONTENT_GRPC) private readonly client: ClientGrpc) {}

  onModuleInit(): void {
    this.svc = this.client.getService<contentV1.ContentServiceClient>(
      contentV1.CONTENT_SERVICE_NAME,
    );
  }

  async list(): Promise<ScenarioSummary[]> {
    const res = await firstValueFrom(this.svc.listScenarios({}));
    return (res.scenarios ?? []).map(toSummary);
  }

  async get(id: string): Promise<Scenario | null> {
    const hit = this.cache.get(id);
    if (hit && hit.expires > Date.now()) return hit.scenario;
    const res = await firstValueFrom(this.svc.getScenario({ id }));
    if (!res.scenario) return null;
    const scenario = toScenario(res.scenario);
    this.cache.set(id, { scenario, expires: Date.now() + this.ttlMs });
    return scenario;
  }

  invalidate(scenarioId?: string): void {
    if (scenarioId) this.cache.delete(scenarioId);
    else this.cache.clear();
  }
}
