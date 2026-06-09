import { Inject, Injectable, Logger } from '@nestjs/common';
import { FsrsService } from '../domain/fsrs.domain-service';
import { Schedule } from '../domain/schedule.entity';
import {
  SCHEDULE_REPOSITORY,
  ScheduleRepository,
} from '../domain/ports/schedule.repository';

/**
 * Use case: create the initial FSRS schedule for (user, card). Triggered by the
 * `vocabulary.card.created` consumer. Idempotent — a duplicate event (at-least-once
 * delivery) is a no-op via the repository's `saveInitial` upsert.
 */
@Injectable()
export class CreateInitialScheduleUseCase {
  private readonly logger = new Logger(CreateInitialScheduleUseCase.name);

  constructor(
    @Inject(SCHEDULE_REPOSITORY) private readonly schedules: ScheduleRepository,
    private readonly fsrs: FsrsService,
  ) {}

  async execute(userId: string, cardId: string): Promise<void> {
    const schedule = Schedule.createInitial(userId, cardId, this.fsrs);
    await this.schedules.saveInitial(schedule);
    this.logger.log(`schedule ready for user=${userId} card=${cardId}`);
  }
}
