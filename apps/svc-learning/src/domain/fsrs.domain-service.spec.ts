import { FsrsService } from './fsrs.domain-service';

describe('FsrsService (domain)', () => {
  const svc = new FsrsService();
  const now = new Date('2026-06-09T12:00:00.000Z');

  it('creates an initial schedule in the New state due ~now', () => {
    const s = svc.initial(now);
    expect(s.state).toBe(0); // New
    expect(s.reps).toBe(0);
    expect(s.lapses).toBe(0);
    expect(s.due.getTime()).toBe(now.getTime());
    expect(svc.stateName(s.state)).toBe('New');
  });

  it('advances due into the future and increments reps on review', () => {
    const initial = svc.initial(now);
    const reviewed = svc.review(initial, 3 /* Good */, now);
    expect(reviewed.due.getTime()).toBeGreaterThan(now.getTime());
    expect(reviewed.reps).toBe(1);
    expect(reviewed.lastReview?.getTime()).toBe(now.getTime());
  });

  it('schedules Easy further out than Again for a new card', () => {
    const initial = svc.initial(now);
    const again = svc.review(initial, 1, now); // Again
    const easy = svc.review(initial, 4, now); // Easy
    expect(easy.due.getTime()).toBeGreaterThan(again.due.getTime());
  });

  it('maps numeric states to contract names', () => {
    expect(svc.stateName(0)).toBe('New');
    expect(svc.stateName(1)).toBe('Learning');
    expect(svc.stateName(2)).toBe('Review');
    expect(svc.stateName(3)).toBe('Relearning');
  });
});
