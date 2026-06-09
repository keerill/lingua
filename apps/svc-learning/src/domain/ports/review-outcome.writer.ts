import { ReviewCompletedEvent, ReviewGrade } from '@lingua/contracts';
import { Schedule } from '../schedule.entity';

/** DI token for the {@link ReviewOutcomeWriter} outbound port. */
export const REVIEW_OUTCOME_WRITER = Symbol('ReviewOutcomeWriter');

/** A single review fact to be logged alongside the schedule update. */
export interface ReviewLogEntry {
  userId: string;
  cardId: string;
  grade: ReviewGrade;
  reviewedAt: Date;
}

/**
 * Outbound port: atomically persists the outcome of a review — the updated
 * schedule, the review log, and the `learning.review.completed` outbox event,
 * all in ONE transaction. The Prisma adapter encapsulates the DB transaction so
 * the application layer stays free of persistence concerns.
 */
export interface ReviewOutcomeWriter {
  commit(next: Schedule, log: ReviewLogEntry, event: ReviewCompletedEvent): Promise<void>;
}
