import { Inject, Injectable, Logger } from '@nestjs/common';
import { localDay, selectReminders } from '../domain/reminders';
import { notificationSentEvent } from '../domain/events';
import { CLOCK, Clock } from '../domain/ports/clock';
import { REMINDER_STORE, ReminderStore } from '../domain/ports/reminder.store';
import {
  NOTIFICATION_SENDER,
  NotificationSender,
} from '../domain/ports/notification.sender';

@Injectable()
export class RunRemindersUseCase {
  private readonly logger = new Logger(RunRemindersUseCase.name);

  constructor(
    @Inject(REMINDER_STORE) private readonly store: ReminderStore,
    @Inject(NOTIFICATION_SENDER) private readonly sender: NotificationSender,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(): Promise<number> {
    const now = this.clock.now();
    const today = localDay(now);
    const users = await this.store.listUsers();
    const selections = selectReminders(users, today);

    for (const sel of selections) {
      await this.sender.send(sel.userId, sel.kind);
      await this.store.saveNotification(
        { userId: sel.userId, kind: sel.kind, channel: 'log', sentAt: now },
        notificationSentEvent(sel.userId, sel.kind, now),
      );
      await this.store.markReminded(sel.userId, today);
    }

    this.logger.log(`reminder run: ${selections.length} sent for ${today}`);
    return selections.length;
  }
}
