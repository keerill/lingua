import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { KafkaModule, OutboxRelayService, OUTBOX_STORE } from '@lingua/kafka';

import { REMINDER_STORE } from './domain/ports/reminder.store';
import { NOTIFICATION_SENDER } from './domain/ports/notification.sender';
import { CLOCK } from './domain/ports/clock';
import { RunRemindersUseCase } from './application/run-reminders.usecase';
import {
  FlagDueUseCase,
  RecordReviewUseCase,
} from './application/record-activity.usecases';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { PrismaReminderStore } from './infrastructure/prisma/reminder.prisma-store';
import { LoggingNotificationSender } from './infrastructure/notify/logging-notification-sender';
import { SystemClock } from './infrastructure/clock/system-clock';
import { PrismaOutboxStore } from './infrastructure/kafka/prisma-outbox.store';
import { ReviewCompletedConsumer } from './infrastructure/kafka/review-completed.consumer';
import { CardsFlaggedConsumer } from './infrastructure/kafka/cards-flagged.consumer';
import { ReminderScheduler } from './infrastructure/schedule/reminder.scheduler';
import { RemindersController } from './interface/http/reminders.controller';
import { HealthController } from './interface/http/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    KafkaModule.forRoot({
      brokers: process.env.KAFKA_BROKERS ?? 'localhost:9092',
      clientId: 'svc-notifications',
    }),
  ],
  controllers: [RemindersController, HealthController],
  providers: [
    RunRemindersUseCase,
    RecordReviewUseCase,
    FlagDueUseCase,
    PrismaService,
    { provide: REMINDER_STORE, useClass: PrismaReminderStore },
    { provide: NOTIFICATION_SENDER, useClass: LoggingNotificationSender },
    { provide: CLOCK, useClass: SystemClock },
    PrismaOutboxStore,
    { provide: OUTBOX_STORE, useExisting: PrismaOutboxStore },
    OutboxRelayService,
    ReviewCompletedConsumer,
    CardsFlaggedConsumer,
    ReminderScheduler,
  ],
})
export class NotificationsModule {}
