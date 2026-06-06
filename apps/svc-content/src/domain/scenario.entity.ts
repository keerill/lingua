import { randomUUID } from 'node:crypto';
import {
  ContentLevel,
  CreateScenarioDto,
  UpdateScenarioDto,
} from '@lingua/contracts';

export class Scenario {
  constructor(
    public readonly id: string,
    public readonly slug: string,
    public readonly title: string,
    public readonly description: string,
    public readonly systemPrompt: string,
    public readonly level: ContentLevel,
    public readonly published: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static create(dto: CreateScenarioDto, now: Date = new Date()): Scenario {
    return new Scenario(
      randomUUID(),
      dto.slug,
      dto.title,
      dto.description,
      dto.systemPrompt,
      dto.level,
      dto.published ?? false,
      now,
      now,
    );
  }

  withUpdate(dto: UpdateScenarioDto, now: Date = new Date()): Scenario {
    return new Scenario(
      this.id,
      this.slug,
      dto.title ?? this.title,
      dto.description ?? this.description,
      dto.systemPrompt ?? this.systemPrompt,
      dto.level ?? this.level,
      dto.published ?? this.published,
      this.createdAt,
      now,
    );
  }
}
