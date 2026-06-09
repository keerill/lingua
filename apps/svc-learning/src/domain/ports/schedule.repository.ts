import { Schedule } from '../schedule.entity';

/** DI token for the {@link ScheduleRepository} outbound port. */
export const SCHEDULE_REPOSITORY = Symbol('ScheduleRepository');

/**
 * Outbound port: persistence of card schedules. Implemented by an infrastructure
 * adapter (Prisma). The domain/application layers depend only on this interface.
 */
export interface ScheduleRepository {
  /** Idempotently create the initial schedule (no-op if it already exists). */
  saveInitial(schedule: Schedule): Promise<void>;
  /** Load a schedule by its (userId, cardId) identity, or null. */
  findByUserAndCard(userId: string, cardId: string): Promise<Schedule | null>;
  /** Schedules due for review now (oldest due first). */
  findDue(userId: string, limit: number): Promise<Schedule[]>;
}
