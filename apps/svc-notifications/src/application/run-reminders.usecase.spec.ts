import { NotificationKind, NotificationSentEvent } from '@lingua/contracts';
import { Clock } from '../domain/ports/clock';
import { NotificationSender } from '../domain/ports/notification.sender';
import {
  ReminderStore,
  SentNotificationRecord,
} from '../domain/ports/reminder.store';
import { UserActivity } from '../domain/reminders';
import { RunRemindersUseCase } from './run-reminders.usecase';

class InMemoryReminderStore implements ReminderStore {
  users: UserActivity[] = [];
  saved: SentNotificationRecord[] = [];
  events: NotificationSentEvent[] = [];

  async recordReview(userId: string, day: string) {
    this.upsert(userId).lastReviewedDay = day;
  }
  async flagDue(userId: string) {
    this.upsert(userId).hasDue = true;
  }
  async listUsers() {
    return this.users;
  }
  async markReminded(userId: string, day: string) {
    this.upsert(userId).lastReminderDay = day;
  }
  async saveNotification(
    record: SentNotificationRecord,
    event: NotificationSentEvent,
  ) {
    this.saved.push(record);
    this.events.push(event);
  }
  private upsert(userId: string): UserActivity {
    let u = this.users.find((x) => x.userId === userId);
    if (!u) {
      u = {
        userId,
        lastReviewedDay: null,
        hasDue: false,
        lastReminderDay: null,
      };
      this.users.push(u);
    }
    return u;
  }
}

class RecordingSender implements NotificationSender {
  sent: { userId: string; kind: NotificationKind }[] = [];
  async send(userId: string, kind: NotificationKind) {
    this.sent.push({ userId, kind });
  }
}

class FakeClock implements Clock {
  constructor(private current: Date) {}
  now() {
    return this.current;
  }
}

describe('RunRemindersUseCase', () => {
  let store: InMemoryReminderStore;
  let sender: RecordingSender;
  let useCase: RunRemindersUseCase;

  const clock = new FakeClock(new Date('2026-06-10T09:00:00.000Z'));

  beforeEach(() => {
    store = new InMemoryReminderStore();
    sender = new RecordingSender();
    useCase = new RunRemindersUseCase(store, sender, clock);
  });

  it('sends streak-at-risk to a user who reviewed yesterday but not today', async () => {
    store.users.push({
      userId: 'u1',
      lastReviewedDay: '2026-06-09',
      hasDue: false,
      lastReminderDay: null,
    });

    const sent = await useCase.execute();

    expect(sent).toBe(1);
    expect(sender.sent).toEqual([{ userId: 'u1', kind: 'streak-at-risk' }]);
    expect(store.events[0].type).toBe('notification.sent');
    expect(store.users[0].lastReminderDay).toBe('2026-06-10');
  });

  it('sends a daily-reminder to a user with due cards and no recent activity', async () => {
    store.users.push({
      userId: 'u2',
      lastReviewedDay: '2026-06-01',
      hasDue: true,
      lastReminderDay: null,
    });

    await useCase.execute();

    expect(sender.sent).toEqual([{ userId: 'u2', kind: 'daily-reminder' }]);
  });

  it('does not nudge a user who already reviewed today', async () => {
    store.users.push({
      userId: 'u3',
      lastReviewedDay: '2026-06-10',
      hasDue: true,
      lastReminderDay: null,
    });

    expect(await useCase.execute()).toBe(0);
    expect(sender.sent).toHaveLength(0);
  });

  it('does not send twice in one day (idempotent per day)', async () => {
    store.users.push({
      userId: 'u4',
      lastReviewedDay: '2026-06-09',
      hasDue: false,
      lastReminderDay: null,
    });

    await useCase.execute();
    const secondRun = await useCase.execute();

    expect(secondRun).toBe(0);
    expect(sender.sent).toHaveLength(1);
  });

  it('ignores users with nothing due and no streak to protect', async () => {
    store.users.push({
      userId: 'u5',
      lastReviewedDay: '2026-06-01',
      hasDue: false,
      lastReminderDay: null,
    });

    expect(await useCase.execute()).toBe(0);
  });
});
