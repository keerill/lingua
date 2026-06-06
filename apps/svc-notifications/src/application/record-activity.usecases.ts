import { Inject, Injectable } from '@nestjs/common';
import { ReviewCompletedEvent, CardsFlaggedEvent } from '@lingua/contracts';
import { localDay } from '../domain/reminders';
import { REMINDER_STORE, ReminderStore } from '../domain/ports/reminder.store';

@Injectable()
export class RecordReviewUseCase {
  constructor(@Inject(REMINDER_STORE) private readonly store: ReminderStore) {}

  async execute(event: ReviewCompletedEvent): Promise<void> {
    await this.store.recordReview(
      event.payload.userId,
      localDay(new Date(event.payload.reviewedAt)),
    );
  }
}

@Injectable()
export class FlagDueUseCase {
  constructor(@Inject(REMINDER_STORE) private readonly store: ReminderStore) {}

  async execute(event: CardsFlaggedEvent): Promise<void> {
    await this.store.flagDue(event.payload.userId);
  }
}
