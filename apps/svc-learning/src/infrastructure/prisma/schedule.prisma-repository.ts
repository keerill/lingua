import { Injectable } from '@nestjs/common';
import { ScheduleRepository } from '../../domain/ports/schedule.repository';
import { Schedule } from '../../domain/schedule.entity';
import { ScheduleSnapshot } from '../../domain/schedule-snapshot';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaScheduleRepository implements ScheduleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async saveInitial(schedule: Schedule): Promise<void> {
    const s = schedule.snapshot;
    await this.prisma.cardSchedule.upsert({
      where: {
        userId_cardId: { userId: schedule.userId, cardId: schedule.cardId },
      },
      create: {
        userId: schedule.userId,
        cardId: schedule.cardId,
        stability: s.stability,
        difficulty: s.difficulty,
        due: s.due,
        reps: s.reps,
        lapses: s.lapses,
        state: s.state,
        lastReview: s.lastReview,
        learningSteps: s.learningSteps,
      },
      update: {},
    });
  }

  async upsertDueNow(
    userId: string,
    cardId: string,
    initial: ScheduleSnapshot,
    now: Date,
  ): Promise<void> {
    await this.prisma.cardSchedule.upsert({
      where: { userId_cardId: { userId, cardId } },
      create: {
        userId,
        cardId,
        stability: initial.stability,
        difficulty: initial.difficulty,
        due: now,
        reps: initial.reps,
        lapses: initial.lapses,
        state: initial.state,
        lastReview: initial.lastReview,
        learningSteps: initial.learningSteps,
      },
      update: { due: now },
    });
  }

  async findByUserAndCard(
    userId: string,
    cardId: string,
  ): Promise<Schedule | null> {
    const row = await this.prisma.cardSchedule.findUnique({
      where: { userId_cardId: { userId, cardId } },
    });
    return row
      ? Schedule.fromSnapshot(userId, cardId, this.toSnapshot(row))
      : null;
  }

  async findDue(userId: string, limit: number): Promise<Schedule[]> {
    const rows = await this.prisma.cardSchedule.findMany({
      where: { userId, due: { lte: new Date() } },
      orderBy: { due: 'asc' },
      take: limit,
    });
    return rows.map((r) =>
      Schedule.fromSnapshot(userId, r.cardId, this.toSnapshot(r)),
    );
  }

  private toSnapshot(row: {
    stability: number;
    difficulty: number;
    due: Date;
    reps: number;
    lapses: number;
    state: number;
    lastReview: Date | null;
    learningSteps: number;
  }): ScheduleSnapshot {
    return {
      stability: row.stability,
      difficulty: row.difficulty,
      due: row.due,
      reps: row.reps,
      lapses: row.lapses,
      state: row.state,
      lastReview: row.lastReview,
      learningSteps: row.learningSteps,
    };
  }
}
