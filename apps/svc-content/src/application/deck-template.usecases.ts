import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateDeckTemplateDto,
  DeckTemplate as DeckTemplateDto,
  UpdateDeckTemplateDto,
} from '@lingua/contracts';
import { DeckTemplate } from '../domain/deck-template.entity';
import {
  DECK_TEMPLATE_REPOSITORY,
  DeckTemplateRepository,
} from '../domain/ports/deck-template.repository';
import { toDeckTemplateDto } from './mappers';

@Injectable()
export class CreateDeckTemplateUseCase {
  constructor(
    @Inject(DECK_TEMPLATE_REPOSITORY) private readonly templates: DeckTemplateRepository,
  ) {}

  async execute(dto: CreateDeckTemplateDto): Promise<DeckTemplateDto> {
    const template = DeckTemplate.create(dto);
    await this.templates.create(template);
    return toDeckTemplateDto(template);
  }
}

@Injectable()
export class UpdateDeckTemplateUseCase {
  constructor(
    @Inject(DECK_TEMPLATE_REPOSITORY) private readonly templates: DeckTemplateRepository,
  ) {}

  async execute(id: string, dto: UpdateDeckTemplateDto): Promise<DeckTemplateDto> {
    const existing = await this.templates.findById(id);
    if (!existing) throw new NotFoundException(`Deck template ${id} not found`);
    const updated = existing.withUpdate(dto);
    await this.templates.update(updated);
    return toDeckTemplateDto(updated);
  }
}

@Injectable()
export class DeleteDeckTemplateUseCase {
  constructor(
    @Inject(DECK_TEMPLATE_REPOSITORY) private readonly templates: DeckTemplateRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const existing = await this.templates.findById(id);
    if (!existing) throw new NotFoundException(`Deck template ${id} not found`);
    await this.templates.remove(id);
  }
}

@Injectable()
export class ListDeckTemplatesUseCase {
  constructor(
    @Inject(DECK_TEMPLATE_REPOSITORY) private readonly templates: DeckTemplateRepository,
  ) {}

  async execute(): Promise<DeckTemplateDto[]> {
    const templates = await this.templates.list();
    return templates.map(toDeckTemplateDto);
  }
}
