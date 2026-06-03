import { Schedule } from '../schedule.entity';
import { ScheduleSnapshot } from '../schedule-snapshot';

export const SCHEDULE_REPOSITORY = Symbol('ScheduleRepository');

export interface ScheduleRepository {
  saveInitial(schedule: Schedule): Promise<void>;

  findByUserAndCard(userId: string, cardId: string): Promise<Schedule | null>;

  findDue(userId: string, limit: number): Promise<Schedule[]>;

  upsertDueNow(
    userId: string,
    cardId: string,
    initial: ScheduleSnapshot,
    now: Date,
  ): Promise<void>;
}
