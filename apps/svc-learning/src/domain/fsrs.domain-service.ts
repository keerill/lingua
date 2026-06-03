import { Injectable } from '@nestjs/common';
import {
  createEmptyCard,
  fsrs,
  FSRS,
  type Card as FsrsCard,
  type Grade,
} from 'ts-fsrs';
import { ReviewGrade, ScheduleState } from '@lingua/contracts';
import { ScheduleSnapshot } from './schedule-snapshot';

const STATE_NAMES: ScheduleState[] = [
  'New',
  'Learning',
  'Review',
  'Relearning',
];

@Injectable()
export class FsrsService {
  private readonly scheduler: FSRS = fsrs();

  initial(now: Date = new Date()): ScheduleSnapshot {
    return this.fromCard(createEmptyCard(now));
  }

  review(
    current: ScheduleSnapshot,
    grade: ReviewGrade,
    now: Date = new Date(),
  ): ScheduleSnapshot {
    const card: FsrsCard = this.toCard(current);
    const { card: next } = this.scheduler.next(
      card,
      now,
      grade as unknown as Grade,
    );
    return this.fromCard(next);
  }

  stateName(state: number): ScheduleState {
    return STATE_NAMES[state] ?? 'New';
  }

  private toCard(s: ScheduleSnapshot): FsrsCard {
    return {
      due: s.due,
      stability: s.stability,
      difficulty: s.difficulty,
      elapsed_days: 0,
      scheduled_days: 0,
      learning_steps: s.learningSteps,
      reps: s.reps,
      lapses: s.lapses,
      state: s.state,
      last_review: s.lastReview ?? undefined,
    };
  }

  private fromCard(c: FsrsCard): ScheduleSnapshot {
    return {
      stability: c.stability,
      difficulty: c.difficulty,
      due: c.due,
      reps: c.reps,
      lapses: c.lapses,
      state: c.state,
      lastReview: c.last_review ?? null,
      learningSteps: c.learning_steps,
    };
  }
}
