import { Inject, Injectable } from '@nestjs/common';
import { ReviewCompletedEvent } from '@lingua/contracts';
import { localDay } from '../domain/progress.calculations';
import { PROGRESS_STORE, ProgressStore } from '../domain/ports/progress.store';

@Injectable()
export class ApplyReviewCompletedUseCase {
  constructor(@Inject(PROGRESS_STORE) private readonly store: ProgressStore) {}

  async execute(event: ReviewCompletedEvent): Promise<void> {
    if (await this.store.hasProcessed(event.eventId)) return;

    const p = event.payload;
    const reviewedAt = new Date(p.reviewedAt);
    const existing = await this.store.findCardState(p.userId, p.cardId);
    const newlyLearned = p.state === 'Review' && !existing?.learnedAt;

    await this.store.recordReview({
      eventId: event.eventId,
      userId: p.userId,
      cardId: p.cardId,
      day: localDay(reviewedAt),
      state: p.state ?? existing?.state ?? 'New',
      due: p.due ? new Date(p.due) : (existing?.due ?? reviewedAt),
      reviewedAt,
      newlyLearned,
    });
  }
}
