import { Controller } from '@nestjs/common';
import { vocabularyV1 } from '@lingua/contracts/proto';
import { Card } from '@lingua/contracts';
import { CreateDeckUseCase } from '../../application/create-deck.usecase';
import { ListDecksUseCase } from '../../application/list-decks.usecase';
import { CreateCardUseCase } from '../../application/create-card.usecase';
import { GetCardsByIdsUseCase } from '../../application/get-cards-by-ids.usecase';

function toProtoCard(c: Card): vocabularyV1.Card {
  return {
    id: c.id,
    deckId: c.deckId,
    term: c.term,
    translation: c.translation,
    example: c.example ?? undefined,
    createdAt: c.createdAt,
  };
}

@Controller()
@vocabularyV1.VocabularyServiceControllerMethods()
export class VocabularyGrpcController
  implements vocabularyV1.VocabularyServiceController
{
  constructor(
    private readonly createDeckUseCase: CreateDeckUseCase,
    private readonly listDecksUseCase: ListDecksUseCase,
    private readonly createCardUseCase: CreateCardUseCase,
    private readonly getCardsUseCase: GetCardsByIdsUseCase,
  ) {}

  createDeck(
    request: vocabularyV1.CreateDeckRequest,
  ): Promise<vocabularyV1.Deck> {
    return this.createDeckUseCase.execute(request.ownerId, {
      title: request.title,
      langFrom: request.langFrom,
      langTo: request.langTo,
    });
  }

  async listDecks(
    request: vocabularyV1.ListDecksRequest,
  ): Promise<vocabularyV1.ListDecksResponse> {
    const decks = await this.listDecksUseCase.execute(request.ownerId);
    return { decks };
  }

  async createCard(
    request: vocabularyV1.CreateCardRequest,
  ): Promise<vocabularyV1.Card> {
    const card = await this.createCardUseCase.execute(
      request.ownerId,
      request.deckId,
      {
        term: request.term,
        translation: request.translation,
        example: request.example,
      },
    );
    return toProtoCard(card);
  }

  async getCards(
    request: vocabularyV1.GetCardsRequest,
  ): Promise<vocabularyV1.GetCardsResponse> {
    const cards = await this.getCardsUseCase.execute(
      request.ownerId,
      request.cardIds ?? [],
    );
    return { cards: cards.map(toProtoCard) };
  }
}
