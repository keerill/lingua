/**
 * REST DTO contracts shared between the gateway-bff, the product services and
 * the micro-frontends. This is the single source of truth for the shapes that
 * cross the wire — both the frontend (TanStack Query) and the NestJS services
 * import these exact types.
 */

/** FSRS grade as exposed to the client: 1=Again 2=Hard 3=Good 4=Easy. */
export type ReviewGrade = 1 | 2 | 3 | 4;

/** FSRS card lifecycle state, mirrors ts-fsrs `State`. */
export type ScheduleState = 'New' | 'Learning' | 'Review' | 'Relearning';

// ---------------------------------------------------------------------------
// Decks
// ---------------------------------------------------------------------------

export interface CreateDeckDto {
  title: string;
  langFrom: string;
  langTo: string;
}

export interface Deck {
  id: string;
  ownerId: string;
  title: string;
  langFrom: string;
  langTo: string;
  createdAt: string; // ISO-8601
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export interface CreateCardDto {
  term: string;
  translation: string;
  example?: string;
}

export interface Card {
  id: string;
  deckId: string;
  term: string;
  translation: string;
  example: string | null;
  createdAt: string; // ISO-8601
}

// ---------------------------------------------------------------------------
// Reviews (aggregated by the BFF: card data + due schedule)
// ---------------------------------------------------------------------------

/** A card that is due for review now, aggregated with its FSRS schedule. */
export interface DueCard {
  cardId: string;
  deckId: string;
  term: string;
  translation: string;
  example: string | null;
  due: string; // ISO-8601
  state: ScheduleState;
  reps: number;
  lapses: number;
}

export interface SubmitReviewDto {
  grade: ReviewGrade;
}

/** Result of an FSRS recalculation after a review. */
export interface NextSchedule {
  cardId: string;
  due: string; // ISO-8601
  stability: number;
  difficulty: number;
  state: ScheduleState;
  reps: number;
  lapses: number;
  lastReview: string; // ISO-8601
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export interface UserProfile {
  id: string; // Keycloak `sub`
  email: string;
  displayName: string;
  roles: string[];
  createdAt: string; // ISO-8601
}
