import { NotificationKind, NotificationSentEvent } from '@lingua/contracts';
import { UserActivity } from '../reminders';

export const REMINDER_STORE = Symbol('ReminderStore');

export interface SentNotificationRecord {
  userId: string;
  kind: NotificationKind;
  channel: string;
  sentAt: Date;
}

export interface ReminderStore {
  recordReview(userId: string, day: string): Promise<void>;

  flagDue(userId: string): Promise<void>;
  listUsers(): Promise<UserActivity[]>;

  markReminded(userId: string, day: string): Promise<void>;

  saveNotification(
    record: SentNotificationRecord,
    event: NotificationSentEvent,
  ): Promise<void>;
}
