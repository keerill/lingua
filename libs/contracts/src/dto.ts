export type ReviewGrade = 1 | 2 | 3 | 4;

export type ScheduleState = 'New' | 'Learning' | 'Review' | 'Relearning';

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
  createdAt: string;
}

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
  createdAt: string;
}

export interface DueCard {
  cardId: string;
  deckId: string;
  term: string;
  translation: string;
  example: string | null;
  due: string;
  state: ScheduleState;
  reps: number;
  lapses: number;
}

export interface SubmitReviewDto {
  grade: ReviewGrade;
}

export interface NextSchedule {
  cardId: string;
  due: string;
  stability: number;
  difficulty: number;
  state: ScheduleState;
  reps: number;
  lapses: number;
  lastReview: string;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  createdAt: string;
}
