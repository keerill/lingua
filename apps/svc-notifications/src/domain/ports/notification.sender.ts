import { NotificationKind } from '@lingua/contracts';

export const NOTIFICATION_SENDER = Symbol('NotificationSender');

export interface NotificationSender {
  send(userId: string, kind: NotificationKind): Promise<void>;
}
