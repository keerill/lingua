import { Injectable } from '@nestjs/common';
import { NotificationSentEvent } from '@lingua/contracts';
import { traceHeaders } from '@lingua/observability';
import {
  ReminderStore,
  SentNotificationRecord,
} from '../../domain/ports/reminder.store';
import { UserActivity } from '../../domain/reminders';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaReminderStore implements ReminderStore {
  constructor(private readonly prisma: PrismaService) {}

  async recordReview(userId: string, day: string): Promise<void> {
    const existing = await this.prisma.userActivity.findUnique({
      where: { userId },
    });
    const lastReviewedDay =
      existing?.lastReviewedDay && existing.lastReviewedDay > day
        ? existing.lastReviewedDay
        : day;
    await this.prisma.userActivity.upsert({
      where: { userId },
      create: { userId, lastReviewedDay: day, hasDue: false },
      update: { lastReviewedDay },
    });
  }

  async flagDue(userId: string): Promise<void> {
    await this.prisma.userActivity.upsert({
      where: { userId },
      create: { userId, hasDue: true },
      update: { hasDue: true },
    });
  }

  async listUsers(): Promise<UserActivity[]> {
    const rows = await this.prisma.userActivity.findMany();
    return rows.map((r) => ({
      userId: r.userId,
      lastReviewedDay: r.lastReviewedDay,
      hasDue: r.hasDue,
      lastReminderDay: r.lastReminderDay,
    }));
  }

  async markReminded(userId: string, day: string): Promise<void> {
    await this.prisma.userActivity.update({
      where: { userId },
      data: { lastReminderDay: day },
    });
  }

  async saveNotification(
    record: SentNotificationRecord,
    event: NotificationSentEvent,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.notification.create({
        data: {
          userId: record.userId,
          kind: record.kind,
          channel: record.channel,
          sentAt: record.sentAt,
        },
      });
      await tx.outbox.create({
        data: {
          topic: event.type,
          key: record.userId,
          payload: event as unknown as object,
          headers: traceHeaders(),
        },
      });
    });
  }
}
