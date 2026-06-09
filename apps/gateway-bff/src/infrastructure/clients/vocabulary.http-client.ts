import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { Card, CreateCardDto, CreateDeckDto, Deck } from '@lingua/contracts';
import { VocabularyPort } from '../../application/ports/vocabulary.port';

/** HTTP adapter implementing {@link VocabularyPort} against svc-vocabulary. */
@Injectable()
export class VocabularyHttpClient implements VocabularyPort {
  private readonly http: AxiosInstance = axios.create({
    baseURL: process.env.SVC_VOCABULARY_URL ?? 'http://localhost:3102',
    timeout: 5000,
  });

  private headers(ownerId: string) {
    return { headers: { 'x-owner-id': ownerId } };
  }

  async createDeck(ownerId: string, dto: CreateDeckDto): Promise<Deck> {
    const { data } = await this.http.post<Deck>('/internal/decks', dto, this.headers(ownerId));
    return data;
  }

  async listDecks(ownerId: string): Promise<Deck[]> {
    const { data } = await this.http.get<Deck[]>('/internal/decks', this.headers(ownerId));
    return data;
  }

  async createCard(ownerId: string, deckId: string, dto: CreateCardDto): Promise<Card> {
    const { data } = await this.http.post<Card>(
      `/internal/decks/${deckId}/cards`,
      dto,
      this.headers(ownerId),
    );
    return data;
  }

  async getCards(ownerId: string, cardIds: string[]): Promise<Card[]> {
    if (cardIds.length === 0) return [];
    const { data } = await this.http.get<Card[]>('/internal/cards', {
      ...this.headers(ownerId),
      params: { ids: cardIds.join(',') },
    });
    return data;
  }
}
