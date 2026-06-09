import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextSchedule, ReviewCompletedEvent, ReviewGrade, Topics } from '@lingua/contracts';
import { FsrsService } from '../domain/fsrs.domain-service';
import {
  SCHEDULE_REPOSITORY,
  ScheduleRepository,
} from '../domain/ports/schedule.repository';
import {
  REVIEW_OUTCOME_WRITER,
  ReviewOutcomeWriter,
} from '../domain/ports/review-outcome.writer';

/**
 * Use case: recompute a schedule via FSRS after a review, then atomically
 * persist the new schedule + review log + `learning.review.completed` outbox
 * event (via the {@link ReviewOutcomeWriter} port — transaction lives in the
 * adapter, not here).
 */
@Injectable()
export class SubmitReviewUseCase {
  constructor(
    @Inject(SCHEDULE_REPOSITORY) private readonly schedules: ScheduleRepository,
    @Inject(REVIEW_OUTCOME_WRITER) private readonly writer: ReviewOutcomeWriter,
    private readonly fsrs: FsrsService,
  ) {}

  async execute(userId: string, cardId: string, grade: ReviewGrade): Promise<NextSchedule> {
    const current = await this.schedules.findByUserAndCard(userId, cardId);
    if (!current) {
      throw new NotFoundException(`No schedule for user=${userId} card=${cardId}`);
    }

    const now = new Date();
    const next = current.applyReview(grade, this.fsrs, now);

    const event: ReviewCompletedEvent = {
      eventId: randomUUID(),
      type: Topics.LearningReviewCompleted,
      occurredAt: now.toISOString(),
      payload: { userId, cardId, grade, reviewedAt: now.toISOString() },
    };

    await this.writer.commit(next, { userId, cardId, grade, reviewedAt: now }, event);

    const s = next.snapshot;
    return {
      cardId,
      due: s.due.toISOString(),
      stability: s.stability,
      difficulty: s.difficulty,
      state: this.fsrs.stateName(s.state),
      reps: s.reps,
      lapses: s.lapses,
      lastReview: (s.lastReview ?? now).toISOString(),
    };
  }
}
