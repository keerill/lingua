import { Inject, Injectable, Logger } from '@nestjs/common';
import { FsrsService } from '../domain/fsrs.domain-service';
import {
  SCHEDULE_REPOSITORY,
  ScheduleRepository,
} from '../domain/ports/schedule.repository';

@Injectable()
export class FlagCardsDueUseCase {
  private readonly logger = new Logger(FlagCardsDueUseCase.name);

  constructor(
    @Inject(SCHEDULE_REPOSITORY) private readonly schedules: ScheduleRepository,
    private readonly fsrs: FsrsService,
  ) {}

  async execute(userId: string, cardIds: string[]): Promise<void> {
    if (cardIds.length === 0) return;
    const now = new Date();
    const initial = this.fsrs.initial(now);
    for (const cardId of cardIds) {
      await this.schedules.upsertDueNow(userId, cardId, initial, now);
    }
    this.logger.log(
      `forced ${cardIds.length} card(s) due now for user=${userId}`,
    );
  }
}
