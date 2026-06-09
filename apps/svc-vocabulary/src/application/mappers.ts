import { Card as CardDto, Deck as DeckDto } from '@lingua/contracts';
import { Deck } from '../domain/deck.entity';
import { Card } from '../domain/card.entity';

/** Map domain entities to the published contract DTOs (Date → ISO string). */
export const toDeckDto = (d: Deck): DeckDto => ({
  id: d.id,
  ownerId: d.ownerId,
  title: d.title,
  langFrom: d.langFrom,
  langTo: d.langTo,
  createdAt: d.createdAt.toISOString(),
});

export const toCardDto = (c: Card): CardDto => ({
  id: c.id,
  deckId: c.deckId,
  term: c.term,
  translation: c.translation,
  example: c.example,
  createdAt: c.createdAt.toISOString(),
});
