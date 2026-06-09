import { Injectable } from '@nestjs/common';
import { ReviewCompletedEvent } from '@lingua/contracts';
import {
  ReviewLogEntry,
  ReviewOutcomeWriter,
} from '../../domain/ports/review-outcome.writer';
import { Schedule } from '../../domain/schedule.entity';
import { PrismaService } from './prisma.service';

/**
 * Prisma adapter for {@link ReviewOutcomeWriter}: persists schedule update +
 * review log + outbox event in ONE transaction (transactional outbox).
 */
@Injectable()
export class PrismaReviewOutcomeWriter implements ReviewOutcomeWriter {
  constructor(private readonly prisma: PrismaService) {}

  async commit(
    next: Schedule,
    log: ReviewLogEntry,
    event: ReviewCompletedEvent,
  ): Promise<void> {
    const s = next.snapshot;
    await this.prisma.$transaction(async (tx) => {
      await tx.cardSchedule.update({
        where: { userId_cardId: { userId: next.userId, cardId: next.cardId } },
        data: {
          stability: s.stability,
          difficulty: s.difficulty,
          due: s.due,
          reps: s.reps,
          lapses: s.lapses,
          state: s.state,
          lastReview: s.lastReview,
          learningSteps: s.learningSteps,
        },
      });

      await tx.reviewLog.create({
        data: {
          userId: log.userId,
          cardId: log.cardId,
          grade: log.grade,
          reviewedAt: log.reviewedAt,
        },
      });

      await tx.outbox.create({
        data: { topic: event.type, key: event.payload.cardId, payload: event as unknown as object },
      });
    });
  }
}
