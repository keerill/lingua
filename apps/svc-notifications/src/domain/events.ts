import { randomUUID } from 'node:crypto';
import {
  NotificationKind,
  NotificationSentEvent,
  Topics,
} from '@lingua/contracts';

export function notificationSentEvent(
  userId: string,
  kind: NotificationKind,
  sentAt: Date,
): NotificationSentEvent {
  return {
    eventId: randomUUID(),
    type: Topics.NotificationSent,
    occurredAt: sentAt.toISOString(),
    payload: { userId, kind, channel: 'log', sentAt: sentAt.toISOString() },
  };
}
