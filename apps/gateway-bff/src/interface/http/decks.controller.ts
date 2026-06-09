import { Body, Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { Card, CreateCardDto, CreateDeckDto, Deck } from '@lingua/contracts';
import { CurrentUser, JwtAuthGuard } from '@lingua/auth';
import { VOCABULARY_PORT, VocabularyPort } from '../../application/ports/vocabulary.port';

/**
 * Public deck/card API for the SPA. Protected by Keycloak JWT; the owner id is
 * the token `sub`. Thin proxies onto the vocabulary port (BFF = orchestrator).
 */
@Controller('decks')
@UseGuards(JwtAuthGuard)
export class DecksController {
  constructor(@Inject(VOCABULARY_PORT) private readonly vocabulary: VocabularyPort) {}

  @Post()
  createDeck(@CurrentUser('sub') sub: string, @Body() dto: CreateDeckDto): Promise<Deck> {
    return this.vocabulary.createDeck(sub, dto);
  }

  @Get()
  listDecks(@CurrentUser('sub') sub: string): Promise<Deck[]> {
    return this.vocabulary.listDecks(sub);
  }

  @Post(':deckId/cards')
  createCard(
    @CurrentUser('sub') sub: string,
    @Param('deckId') deckId: string,
    @Body() dto: CreateCardDto,
  ): Promise<Card> {
    return this.vocabulary.createCard(sub, deckId, dto);
  }
}
