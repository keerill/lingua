import { NotFoundException } from '@nestjs/common';
import { ReviewCompletedEvent } from '@lingua/contracts';
import { FsrsService } from '../domain/fsrs.domain-service';
import { Schedule } from '../domain/schedule.entity';
import { ScheduleSnapshot } from '../domain/schedule-snapshot';
import { ScheduleRepository } from '../domain/ports/schedule.repository';
import {
  ReviewLogEntry,
  ReviewOutcomeWriter,
} from '../domain/ports/review-outcome.writer';
import { SubmitReviewUseCase } from './submit-review.usecase';

class InMemoryScheduleRepository implements ScheduleRepository {
  private store = new Map<string, Schedule>();
  private key = (u: string, c: string) => `${u}:${c}`;

  seed(s: Schedule) {
    this.store.set(this.key(s.userId, s.cardId), s);
  }
  async saveInitial(s: Schedule) {
    if (!this.store.has(this.key(s.userId, s.cardId))) this.seed(s);
  }
  async findByUserAndCard(u: string, c: string) {
    return this.store.get(this.key(u, c)) ?? null;
  }
  async findDue(u: string, limit: number) {
    return [...this.store.values()]
      .filter((s) => s.userId === u && s.snapshot.due <= new Date())
      .slice(0, limit);
  }
  async upsertDueNow(
    u: string,
    c: string,
    initial: ScheduleSnapshot,
    now: Date,
  ) {
    const existing = this.store.get(this.key(u, c));
    const snapshot = existing
      ? { ...existing.snapshot, due: now }
      : { ...initial, due: now };
    this.store.set(this.key(u, c), Schedule.fromSnapshot(u, c, snapshot));
  }
}

class RecordingWriter implements ReviewOutcomeWriter {
  committed: {
    next: Schedule;
    log: ReviewLogEntry;
    event: ReviewCompletedEvent;
  }[] = [];
  async commit(
    next: Schedule,
    log: ReviewLogEntry,
    event: ReviewCompletedEvent,
  ) {
    this.committed.push({ next, log, event });
  }
}

describe('SubmitReviewUseCase', () => {
  const fsrs = new FsrsService();
  let repo: InMemoryScheduleRepository;
  let writer: RecordingWriter;
  let useCase: SubmitReviewUseCase;

  beforeEach(() => {
    repo = new InMemoryScheduleRepository();
    writer = new RecordingWriter();
    useCase = new SubmitReviewUseCase(repo, writer, fsrs);
  });

  it('throws NotFound when no schedule exists', async () => {
    await expect(useCase.execute('u1', 'missing', 3)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('recomputes via FSRS, commits the outcome, and returns the next schedule', async () => {
    repo.seed(
      Schedule.createInitial(
        'u1',
        'c1',
        fsrs,
        new Date('2026-06-09T12:00:00Z'),
      ),
    );

    const before = Date.now();
    const result = await useCase.execute('u1', 'c1', 3);

    expect(new Date(result.due).getTime()).toBeGreaterThan(before);
    expect(result.reps).toBe(1);
    expect(result.cardId).toBe('c1');

    expect(writer.committed).toHaveLength(1);
    const { log, event } = writer.committed[0];
    expect(log).toMatchObject({ userId: 'u1', cardId: 'c1', grade: 3 });
    expect(event.type).toBe('learning.review.completed');
    expect(event.payload).toMatchObject({
      userId: 'u1',
      cardId: 'c1',
      grade: 3,
    });
    expect(event.eventId).toBeDefined();
    expect(['Learning', 'Review']).toContain(event.payload.state);
    expect(event.payload.reps).toBe(1);
    expect(typeof event.payload.due).toBe('string');
  });
});
