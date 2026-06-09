import { NextSchedule, ReviewGrade } from '@lingua/contracts';

/** DI token for the {@link LearningPort} (downstream svc-learning). */
export const LEARNING_PORT = Symbol('LearningPort');

/** A due schedule row as returned by svc-learning's internal queue. */
export interface DueScheduleRow {
  cardId: string;
  due: string;
  state: string;
  reps: number;
  lapses: number;
}

/** Outbound port: the BFF's view of svc-learning. */
export interface LearningPort {
  getQueue(userId: string, limit: number): Promise<DueScheduleRow[]>;
  submitReview(userId: string, cardId: string, grade: ReviewGrade): Promise<NextSchedule>;
}
