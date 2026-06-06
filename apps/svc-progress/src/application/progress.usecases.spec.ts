import {
  ReviewCompletedEvent,
  ScheduleState,
  SpeakingMistakeDetectedEvent,
} from '@lingua/contracts';
import { Clock } from '../domain/ports/clock';
import {
  CardStateRow,
  DailyActivityRow,
  PronunciationRow,
  ProgressStore,
  RecordPronunciationInput,
  RecordReviewInput,
} from '../domain/ports/progress.store';
import { ApplyReviewCompletedUseCase } from './apply-review-completed.usecase';
import { ApplySpeakingMistakeUseCase } from './apply-speaking-mistake.usecase';
import { GetProgressUseCase } from './get-progress.usecase';

class InMemoryProgressStore implements ProgressStore {
  processed = new Set<string>();
  cards = new Map<string, CardStateRow & { userId: string }>();
  daily = new Map<string, DailyActivityRow & { userId: string }>();
  pron = new Map<string, PronunciationRow & { userId: string }>();

  async hasProcessed(eventId: string) {
    return this.processed.has(eventId);
  }
  async recordReview(i: RecordReviewInput) {
    this.processed.add(i.eventId);
    const dk = `${i.userId}:${i.day}`;
    const d = this.daily.get(dk) ?? {
      userId: i.userId,
      day: i.day,
      reviews: 0,
      learned: 0,
    };
    d.reviews += 1;
    d.learned += i.newlyLearned ? 1 : 0;
    this.daily.set(dk, d);
    const ck = `${i.userId}:${i.cardId}`;
    const prev = this.cards.get(ck);
    this.cards.set(ck, {
      userId: i.userId,
      cardId: i.cardId,
      state: i.state,
      due: i.due,
      learnedAt: i.newlyLearned ? i.reviewedAt : (prev?.learnedAt ?? null),
    });
  }
  async recordPronunciation(i: RecordPronunciationInput) {
    this.processed.add(i.eventId);
    const pk = `${i.userId}:${i.day}`;
    const p = this.pron.get(pk) ?? {
      userId: i.userId,
      day: i.day,
      mistakes: 0,
    };
    p.mistakes += i.mistakes;
    this.pron.set(pk, p);
  }
  async findCardState(userId: string, cardId: string) {
    return this.cards.get(`${userId}:${cardId}`) ?? null;
  }
  async listCardStates(userId: string) {
    return [...this.cards.values()].filter((c) => c.userId === userId);
  }
  async listDailyActivity(userId: string) {
    return [...this.daily.values()].filter((d) => d.userId === userId);
  }
  async listPronunciationDaily(userId: string) {
    return [...this.pron.values()].filter((p) => p.userId === userId);
  }
}

class FakeClock implements Clock {
  constructor(private current: Date) {}
  now() {
    return this.current;
  }
}

let seq = 0;
function reviewEvent(
  userId: string,
  cardId: string,
  reviewedAt: string,
  state: ScheduleState,
  due: string,
): ReviewCompletedEvent {
  return {
    eventId: `evt-${seq++}`,
    type: 'learning.review.completed',
    occurredAt: reviewedAt,
    payload: {
      userId,
      cardId,
      grade: 3,
      reviewedAt,
      state,
      due,
      reps: 1,
      lapses: 0,
    },
  };
}

function speakingEvent(
  userId: string,
  occurredAt: string,
  pronunciationCount: number,
): SpeakingMistakeDetectedEvent {
  return {
    eventId: `evt-${seq++}`,
    type: 'speaking.mistake.detected',
    occurredAt,
    payload: {
      userId,
      sessionId: 's',
      scenario: 'interview',
      mistakes: Array.from({ length: pronunciationCount }, (_, i) => ({
        term: `w${i}`,
        kind: 'pronunciation' as const,
        context: 'x',
      })),
    },
  };
}

describe('svc-progress aggregation', () => {
  let store: InMemoryProgressStore;
  let applyReview: ApplyReviewCompletedUseCase;
  let applySpeaking: ApplySpeakingMistakeUseCase;

  beforeEach(() => {
    seq = 0;
    store = new InMemoryProgressStore();
    applyReview = new ApplyReviewCompletedUseCase(store);
    applySpeaking = new ApplySpeakingMistakeUseCase(store);
  });

  const get = (today: string) =>
    new GetProgressUseCase(
      store,
      new FakeClock(new Date(`${today}T12:00:00.000Z`)),
    );

  it('counts reviews per day and totals them', async () => {
    await applyReview.execute(
      reviewEvent(
        'u1',
        'c1',
        '2026-06-08T10:00:00Z',
        'Learning',
        '2026-06-09T10:00:00Z',
      ),
    );
    await applyReview.execute(
      reviewEvent(
        'u1',
        'c2',
        '2026-06-08T11:00:00Z',
        'Learning',
        '2026-06-09T11:00:00Z',
      ),
    );
    await applyReview.execute(
      reviewEvent(
        'u1',
        'c1',
        '2026-06-09T10:00:00Z',
        'Review',
        '2026-06-20T10:00:00Z',
      ),
    );

    const dash = await get('2026-06-09').dashboard('u1');
    expect(dash.overview.totalReviews).toBe(3);
    expect(dash.reviewsByDay).toEqual([
      { day: '2026-06-08', count: 2 },
      { day: '2026-06-09', count: 1 },
    ]);
  });

  it('counts a word as learned only the first time it reaches Review (idempotent)', async () => {
    await applyReview.execute(
      reviewEvent(
        'u1',
        'c1',
        '2026-06-08T10:00:00Z',
        'Learning',
        '2026-06-09T10:00:00Z',
      ),
    );
    await applyReview.execute(
      reviewEvent(
        'u1',
        'c1',
        '2026-06-09T10:00:00Z',
        'Review',
        '2026-06-20T10:00:00Z',
      ),
    );
    await applyReview.execute(
      reviewEvent(
        'u1',
        'c1',
        '2026-06-20T10:00:00Z',
        'Review',
        '2026-07-01T10:00:00Z',
      ),
    );

    const dash = await get('2026-06-20').dashboard('u1');
    expect(dash.overview.learnedWords).toBe(1);
    expect(dash.learnedByDay.find((d) => d.day === '2026-06-09')?.count).toBe(
      1,
    );
    expect(dash.learnedByDay.find((d) => d.day === '2026-06-20')?.count).toBe(
      0,
    );
  });

  it('ignores a redelivered event (dedup on eventId)', async () => {
    const e = reviewEvent(
      'u1',
      'c1',
      '2026-06-08T10:00:00Z',
      'Review',
      '2026-06-09T10:00:00Z',
    );
    await applyReview.execute(e);
    await applyReview.execute(e);

    const dash = await get('2026-06-08').dashboard('u1');
    expect(dash.overview.totalReviews).toBe(1);
    expect(dash.overview.learnedWords).toBe(1);
  });

  it('computes current and longest streaks; yesterday still counts today', async () => {
    for (const day of ['2026-06-05', '2026-06-06', '2026-06-07']) {
      await applyReview.execute(
        reviewEvent(
          'u1',
          'c1',
          `${day}T10:00:00Z`,
          'Learning',
          `${day}T20:00:00Z`,
        ),
      );
    }
    await applyReview.execute(
      reviewEvent(
        'u1',
        'c1',
        '2026-06-09T10:00:00Z',
        'Learning',
        '2026-06-09T20:00:00Z',
      ),
    );
    await applyReview.execute(
      reviewEvent(
        'u1',
        'c1',
        '2026-06-10T10:00:00Z',
        'Learning',
        '2026-06-10T20:00:00Z',
      ),
    );

    const o1 = await get('2026-06-11').overview('u1');
    expect(o1.currentStreak).toBe(2);
    expect(o1.longestStreak).toBe(3);

    const o2 = await get('2026-06-12').overview('u1');
    expect(o2.currentStreak).toBe(0);
    expect(o2.longestStreak).toBe(3);
  });

  it('counts due cards as of now', async () => {
    await applyReview.execute(
      reviewEvent(
        'u1',
        'c1',
        '2026-06-08T10:00:00Z',
        'Review',
        '2026-06-09T10:00:00Z',
      ),
    );
    await applyReview.execute(
      reviewEvent(
        'u1',
        'c2',
        '2026-06-08T10:00:00Z',
        'Review',
        '2026-06-30T10:00:00Z',
      ),
    );

    const o = await get('2026-06-15').overview('u1');
    expect(o.dueCount).toBe(1);
  });

  it('tracks the pronunciation trend per day', async () => {
    await applySpeaking.execute(speakingEvent('u1', '2026-06-08T10:00:00Z', 2));
    await applySpeaking.execute(speakingEvent('u1', '2026-06-08T12:00:00Z', 1));
    await applySpeaking.execute(speakingEvent('u1', '2026-06-09T10:00:00Z', 0));

    const dash = await get('2026-06-09').dashboard('u1');
    expect(dash.pronunciationTrend).toEqual([
      { day: '2026-06-08', mistakes: 3 },
      { day: '2026-06-09', mistakes: 0 },
    ]);
  });
});
