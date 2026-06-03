import { FsrsService } from '../domain/fsrs.domain-service';
import { Schedule } from '../domain/schedule.entity';
import { ScheduleSnapshot } from '../domain/schedule-snapshot';
import { ScheduleRepository } from '../domain/ports/schedule.repository';
import { FlagCardsDueUseCase } from './flag-cards-due.usecase';

class InMemoryScheduleRepository implements ScheduleRepository {
  store = new Map<string, Schedule>();
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
    if (existing) {
      this.store.set(
        this.key(u, c),
        Schedule.fromSnapshot(u, c, { ...existing.snapshot, due: now }),
      );
    } else {
      this.store.set(
        this.key(u, c),
        Schedule.fromSnapshot(u, c, { ...initial, due: now }),
      );
    }
  }
}

describe('FlagCardsDueUseCase', () => {
  const fsrs = new FsrsService();
  let repo: InMemoryScheduleRepository;
  let useCase: FlagCardsDueUseCase;

  beforeEach(() => {
    repo = new InMemoryScheduleRepository();
    useCase = new FlagCardsDueUseCase(repo, fsrs);
  });

  it('creates an initial schedule due now for a card with no schedule', async () => {
    const before = Date.now();
    await useCase.execute('u1', ['new-card']);

    const s = await repo.findByUserAndCard('u1', 'new-card');
    expect(s).not.toBeNull();
    expect(s!.snapshot.due.getTime()).toBeLessThanOrEqual(Date.now());
    expect(s!.snapshot.due.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it('resurfaces a previously-learned card by resetting due to now (keeps FSRS state)', async () => {
    const future = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    repo.seed(
      Schedule.fromSnapshot('u1', 'known', {
        stability: 50,
        difficulty: 5,
        due: future,
        reps: 9,
        lapses: 1,
        state: 2,
        lastReview: new Date(),
        learningSteps: 0,
      }),
    );

    await useCase.execute('u1', ['known']);

    const s = await repo.findByUserAndCard('u1', 'known');
    expect(s!.snapshot.due.getTime()).toBeLessThanOrEqual(Date.now());
    expect(s!.snapshot.reps).toBe(9);
    expect(s!.snapshot.stability).toBe(50);
  });

  it('does nothing for an empty list', async () => {
    await useCase.execute('u1', []);
    expect(repo.store.size).toBe(0);
  });
});
