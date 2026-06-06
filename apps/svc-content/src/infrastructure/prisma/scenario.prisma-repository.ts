import { Injectable } from '@nestjs/common';
import { ContentLevel, ScenarioUpdatedEvent } from '@lingua/contracts';
import { traceHeaders } from '@lingua/observability';
import { Scenario } from '../../domain/scenario.entity';
import {
  ListScenarioOptions,
  ScenarioRepository,
} from '../../domain/ports/scenario.repository';
import { PrismaService } from './prisma.service';

type ScenarioRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  systemPrompt: string;
  level: string;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PrismaScenarioRepository implements ScenarioRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(scenario: Scenario, event: ScenarioUpdatedEvent): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.scenario.create({ data: this.toData(scenario) });
      await tx.outbox.create({
        data: {
          topic: event.type,
          key: scenario.id,
          payload: event as unknown as object,
          headers: traceHeaders(),
        },
      });
    });
  }

  async update(scenario: Scenario, event: ScenarioUpdatedEvent): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.scenario.update({
        where: { id: scenario.id },
        data: {
          title: scenario.title,
          description: scenario.description,
          systemPrompt: scenario.systemPrompt,
          level: scenario.level,
          published: scenario.published,
          updatedAt: scenario.updatedAt,
        },
      });
      await tx.outbox.create({
        data: {
          topic: event.type,
          key: scenario.id,
          payload: event as unknown as object,
          headers: traceHeaders(),
        },
      });
    });
  }

  async remove(scenario: Scenario, event: ScenarioUpdatedEvent): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.scenario.delete({ where: { id: scenario.id } });
      await tx.outbox.create({
        data: {
          topic: event.type,
          key: scenario.id,
          payload: event as unknown as object,
          headers: traceHeaders(),
        },
      });
    });
  }

  async findById(id: string): Promise<Scenario | null> {
    const row = await this.prisma.scenario.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findBySlug(slug: string): Promise<Scenario | null> {
    const row = await this.prisma.scenario.findUnique({ where: { slug } });
    return row ? this.toDomain(row) : null;
  }

  async list(options?: ListScenarioOptions): Promise<Scenario[]> {
    const rows = await this.prisma.scenario.findMany({
      where: options?.publishedOnly ? { published: true } : undefined,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  private toData(s: Scenario) {
    return {
      id: s.id,
      slug: s.slug,
      title: s.title,
      description: s.description,
      systemPrompt: s.systemPrompt,
      level: s.level,
      published: s.published,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }

  private toDomain(r: ScenarioRow): Scenario {
    return new Scenario(
      r.id,
      r.slug,
      r.title,
      r.description,
      r.systemPrompt,
      r.level as ContentLevel,
      r.published,
      r.createdAt,
      r.updatedAt,
    );
  }
}
