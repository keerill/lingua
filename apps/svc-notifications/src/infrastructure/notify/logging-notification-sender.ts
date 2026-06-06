import { Injectable, Logger } from '@nestjs/common';
import { NotificationKind } from '@lingua/contracts';
import { NotificationSender } from '../../domain/ports/notification.sender';

@Injectable()
export class LoggingNotificationSender implements NotificationSender {
  private readonly logger = new Logger('NotificationSender');

  async send(userId: string, kind: NotificationKind): Promise<void> {
    const message =
      kind === 'streak-at-risk'
        ? 'Your streak is at risk — do a quick review to keep it alive!'
        : 'You have cards due for review today.';
    this.logger.log(`[stub:${kind}] → ${userId}: ${message}`);
  }
}
