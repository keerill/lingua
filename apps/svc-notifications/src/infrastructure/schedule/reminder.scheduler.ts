import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RunRemindersUseCase } from '../../application/run-reminders.usecase';

const CRON = process.env.NOTIFICATIONS_REMINDER_CRON ?? '0 9 * * *';

@Injectable()
export class ReminderScheduler {
  private readonly logger = new Logger(ReminderScheduler.name);

  constructor(private readonly runReminders: RunRemindersUseCase) {}

  @Cron(CRON, { name: 'reminders' })
  async handleCron(): Promise<void> {
    const sent = await this.runReminders.execute();
    this.logger.log(`scheduled reminder run sent ${sent} notification(s)`);
  }
}
