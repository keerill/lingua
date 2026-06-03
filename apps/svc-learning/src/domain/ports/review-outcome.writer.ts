import { ReviewCompletedEvent, ReviewGrade } from '@lingua/contracts';
import { Schedule } from '../schedule.entity';

export const REVIEW_OUTCOME_WRITER = Symbol('ReviewOutcomeWriter');

export interface ReviewLogEntry {
  userId: string;
  cardId: string;
  grade: ReviewGrade;
  reviewedAt: Date;
}

export interface ReviewOutcomeWriter {
  commit(
    next: Schedule,
    log: ReviewLogEntry,
    event: ReviewCompletedEvent,
  ): Promise<void>;
}
