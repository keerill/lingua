import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Card, CreateCardDto, CreateDeckDto, Deck } from '@lingua/contracts';
import { CreateDeckUseCase } from '../../application/create-deck.usecase';
import { ListDecksUseCase } from '../../application/list-decks.usecase';
import { CreateCardUseCase } from '../../application/create-card.usecase';
import { GetCardsByIdsUseCase } from '../../application/get-cards-by-ids.usecase';
import { OwnerId } from './owner-id.decorator';

@Controller('internal')
export class VocabularyController {
  constructor(
    private readonly createDeck: CreateDeckUseCase,
    private readonly listDecks: ListDecksUseCase,
    private readonly createCard: CreateCardUseCase,
    private readonly getCardsByIds: GetCardsByIdsUseCase,
  ) {}

  @Post('decks')
  createDeckHandler(
    @OwnerId() ownerId: string,
    @Body() dto: CreateDeckDto,
  ): Promise<Deck> {
    return this.createDeck.execute(ownerId, dto);
  }

  @Get('decks')
  listDecksHandler(@OwnerId() ownerId: string): Promise<Deck[]> {
    return this.listDecks.execute(ownerId);
  }

  @Get('cards')
  getCardsHandler(
    @OwnerId() ownerId: string,
    @Query('ids') ids?: string,
  ): Promise<Card[]> {
    const cardIds = (ids ?? '').split(',').filter(Boolean);
    return this.getCardsByIds.execute(ownerId, cardIds);
  }

  @Post('decks/:deckId/cards')
  createCardHandler(
    @OwnerId() ownerId: string,
    @Param('deckId') deckId: string,
    @Body() dto: CreateCardDto,
  ): Promise<Card> {
    return this.createCard.execute(ownerId, deckId, dto);
  }
}
