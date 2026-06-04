import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type {
  Card,
  CreateCardDto,
  CreateDeckDto,
  Deck,
  DueCard,
  NextSchedule,
  ReviewGrade,
} from '@lingua/contracts';

export type ApiFetch = (path: string, init?: RequestInit) => Promise<Response>;

export interface LinguaApi {
  listDecks(): Promise<Deck[]>;
  createDeck(dto: CreateDeckDto): Promise<Deck>;
  createCard(deckId: string, dto: CreateCardDto): Promise<Card>;
  getQueue(limit?: number): Promise<DueCard[]>;
  submitReview(cardId: string, grade: ReviewGrade): Promise<NextSchedule>;
}

const ApiContext = createContext<LinguaApi | null>(null);

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export function ApiProvider({
  api,
  children,
}: {
  api: ApiFetch;
  children: ReactNode;
}) {
  const client = useMemo<LinguaApi>(
    () => ({
      listDecks: () => api('/decks').then(json<Deck[]>),
      createDeck: (dto) =>
        api('/decks', { method: 'POST', body: JSON.stringify(dto) }).then(
          json<Deck>,
        ),
      createCard: (deckId, dto) =>
        api(`/decks/${deckId}/cards`, {
          method: 'POST',
          body: JSON.stringify(dto),
        }).then(json<Card>),
      getQueue: (limit = 20) =>
        api(`/reviews/queue?limit=${limit}`).then(json<DueCard[]>),
      submitReview: (cardId, grade) =>
        api(`/reviews/${cardId}`, {
          method: 'POST',
          body: JSON.stringify({ grade }),
        }).then(json<NextSchedule>),
    }),
    [api],
  );
  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApi(): LinguaApi {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error('useApi must be used within ApiProvider');
  return ctx;
}
