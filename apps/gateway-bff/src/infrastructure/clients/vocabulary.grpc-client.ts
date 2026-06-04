import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { Card, CreateCardDto, CreateDeckDto, Deck } from '@lingua/contracts';
import { vocabularyV1 } from '@lingua/contracts/proto';
import { VocabularyPort } from '../../application/ports/vocabulary.port';
import { VOCABULARY_GRPC } from './grpc.tokens';

function toCard(c: vocabularyV1.Card): Card {
  return {
    id: c.id,
    deckId: c.deckId,
    term: c.term,
    translation: c.translation,
    example: c.example ?? null,
    createdAt: c.createdAt,
  };
}

@Injectable()
export class VocabularyGrpcClient implements VocabularyPort, OnModuleInit {
  private svc!: vocabularyV1.VocabularyServiceClient;

  constructor(@Inject(VOCABULARY_GRPC) private readonly client: ClientGrpc) {}

  onModuleInit(): void {
    this.svc = this.client.getService<vocabularyV1.VocabularyServiceClient>(
      vocabularyV1.VOCABULARY_SERVICE_NAME,
    );
  }

  async createDeck(ownerId: string, dto: CreateDeckDto): Promise<Deck> {
    return firstValueFrom(
      this.svc.createDeck({
        ownerId,
        title: dto.title,
        langFrom: dto.langFrom,
        langTo: dto.langTo,
      }),
    );
  }

  async listDecks(ownerId: string): Promise<Deck[]> {
    const res = await firstValueFrom(this.svc.listDecks({ ownerId }));
    return res.decks ?? [];
  }

  async createCard(
    ownerId: string,
    deckId: string,
    dto: CreateCardDto,
  ): Promise<Card> {
    const card = await firstValueFrom(
      this.svc.createCard({
        ownerId,
        deckId,
        term: dto.term,
        translation: dto.translation,
        example: dto.example,
      }),
    );
    return toCard(card);
  }

  async getCards(ownerId: string, cardIds: string[]): Promise<Card[]> {
    if (cardIds.length === 0) return [];
    const res = await firstValueFrom(this.svc.getCards({ ownerId, cardIds }));
    return (res.cards ?? []).map(toCard);
  }
}
