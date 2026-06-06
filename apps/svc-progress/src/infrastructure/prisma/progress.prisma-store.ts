import { Injectable } from '@nestjs/common';
import {
  CardStateRow,
  DailyActivityRow,
  ProgressStore,
  PronunciationRow,
  RecordPronunciationInput,
  RecordReviewInput,
} from '../../domain/ports/progress.store';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaProgressStore implements ProgressStore {
  constructor(private readonly prisma: PrismaService) {}

  async hasProcessed(eventId: string): Promise<boolean> {
    const row = await this.prisma.processedEvent.findUnique({
      where: { eventId },
    });
    return row !== null;
  }

  async recordReview(i: RecordReviewInput): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.processedEvent.create({ data: { eventId: i.eventId } });
      await tx.dailyActivity.upsert({
        where: { userId_day: { userId: i.userId, day: i.day } },
        create: {
          userId: i.userId,
          day: i.day,
          reviews: 1,
          learned: i.newlyLearned ? 1 : 0,
        },
        update: {
          reviews: { increment: 1 },
          learned: { increment: i.newlyLearned ? 1 : 0 },
        },
      });
      await tx.cardState.upsert({
        where: { userId_cardId: { userId: i.userId, cardId: i.cardId } },
        create: {
          userId: i.userId,
          cardId: i.cardId,
          state: i.state,
          due: i.due,
          learnedAt: i.newlyLearned ? i.reviewedAt : null,
        },
        update: {
          state: i.state,
          due: i.due,
          ...(i.newlyLearned ? { learnedAt: i.reviewedAt } : {}),
        },
      });
    });
  }

  async recordPronunciation(i: RecordPronunciationInput): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.processedEvent.create({ data: { eventId: i.eventId } });
      await tx.pronunciationDaily.upsert({
        where: { userId_day: { userId: i.userId, day: i.day } },
        create: { userId: i.userId, day: i.day, mistakes: i.mistakes },
        update: { mistakes: { increment: i.mistakes } },
      });
    });
  }

  async findCardState(
    userId: string,
    cardId: string,
  ): Promise<CardStateRow | null> {
    const row = await this.prisma.cardState.findUnique({
      where: { userId_cardId: { userId, cardId } },
    });
    return row
      ? {
          cardId: row.cardId,
          state: row.state,
          due: row.due,
          learnedAt: row.learnedAt,
        }
      : null;
  }

  async listCardStates(userId: string): Promise<CardStateRow[]> {
    const rows = await this.prisma.cardState.findMany({ where: { userId } });
    return rows.map((r) => ({
      cardId: r.cardId,
      state: r.state,
      due: r.due,
      learnedAt: r.learnedAt,
    }));
  }

  async listDailyActivity(userId: string): Promise<DailyActivityRow[]> {
    const rows = await this.prisma.dailyActivity.findMany({
      where: { userId },
      orderBy: { day: 'asc' },
    });
    return rows.map((r) => ({
      day: r.day,
      reviews: r.reviews,
      learned: r.learned,
    }));
  }

  async listPronunciationDaily(userId: string): Promise<PronunciationRow[]> {
    const rows = await this.prisma.pronunciationDaily.findMany({
      where: { userId },
      orderBy: { day: 'asc' },
    });
    return rows.map((r) => ({ day: r.day, mistakes: r.mistakes }));
  }
}
