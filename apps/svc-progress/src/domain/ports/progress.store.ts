export const PROGRESS_STORE = Symbol('ProgressStore');

export interface CardStateRow {
  cardId: string;
  state: string;
  due: Date;
  learnedAt: Date | null;
}

export interface DailyActivityRow {
  day: string;
  reviews: number;
  learned: number;
}

export interface PronunciationRow {
  day: string;
  mistakes: number;
}

export interface RecordReviewInput {
  eventId: string;
  userId: string;
  cardId: string;
  day: string;
  state: string;
  due: Date;
  reviewedAt: Date;

  newlyLearned: boolean;
}

export interface RecordPronunciationInput {
  eventId: string;
  userId: string;
  day: string;
  mistakes: number;
}

export interface ProgressStore {
  hasProcessed(eventId: string): Promise<boolean>;
  recordReview(input: RecordReviewInput): Promise<void>;
  recordPronunciation(input: RecordPronunciationInput): Promise<void>;
  findCardState(userId: string, cardId: string): Promise<CardStateRow | null>;
  listCardStates(userId: string): Promise<CardStateRow[]>;
  listDailyActivity(userId: string): Promise<DailyActivityRow[]>;
  listPronunciationDaily(userId: string): Promise<PronunciationRow[]>;
}
