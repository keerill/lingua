import { NotificationKind } from '@lingua/contracts';

export function localDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export interface UserActivity {
  userId: string;
  lastReviewedDay: string | null;
  hasDue: boolean;
  lastReminderDay: string | null;
}

export interface ReminderSelection {
  userId: string;
  kind: NotificationKind;
}

export function selectReminders(
  users: UserActivity[],
  today: string,
): ReminderSelection[] {
  const yesterday = addDays(today, -1);
  const selections: ReminderSelection[] = [];

  for (const u of users) {
    if (u.lastReminderDay === today) continue;
    if (u.lastReviewedDay === today) continue;

    if (u.lastReviewedDay === yesterday) {
      selections.push({ userId: u.userId, kind: 'streak-at-risk' });
    } else if (u.hasDue) {
      selections.push({ userId: u.userId, kind: 'daily-reminder' });
    }
  }

  return selections;
}
