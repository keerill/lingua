import { Inject, Injectable } from '@nestjs/common';
import { SpeakingMistakeDetectedEvent } from '@lingua/contracts';
import { localDay } from '../domain/progress.calculations';
import { PROGRESS_STORE, ProgressStore } from '../domain/ports/progress.store';

@Injectable()
export class ApplySpeakingMistakeUseCase {
  constructor(@Inject(PROGRESS_STORE) private readonly store: ProgressStore) {}

  async execute(event: SpeakingMistakeDetectedEvent): Promise<void> {
    if (await this.store.hasProcessed(event.eventId)) return;

    const pronunciation = event.payload.mistakes.filter(
      (m) => m.kind === 'pronunciation',
    ).length;

    await this.store.recordPronunciation({
      eventId: event.eventId,
      userId: event.payload.userId,
      day: localDay(new Date(event.occurredAt)),
      mistakes: pronunciation,
    });
  }
}
