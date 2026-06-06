import { DeckTemplate } from '../deck-template.entity';

export const DECK_TEMPLATE_REPOSITORY = Symbol('DeckTemplateRepository');

export interface DeckTemplateRepository {
  create(template: DeckTemplate): Promise<void>;
  update(template: DeckTemplate): Promise<void>;
  remove(id: string): Promise<void>;
  findById(id: string): Promise<DeckTemplate | null>;
  findBySlug(slug: string): Promise<DeckTemplate | null>;
  list(): Promise<DeckTemplate[]>;
}
