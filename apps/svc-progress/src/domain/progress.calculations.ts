import { ProgressOverview } from '@lingua/contracts';

export function localDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function computeStreak(
  activeDays: string[],
  today: string,
): { currentStreak: number; longestStreak: number } {
  if (activeDays.length === 0) return { currentStreak: 0, longestStreak: 0 };

  const set = new Set(activeDays);
  const sorted = [...set].sort();

  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = sorted[i] === addDays(sorted[i - 1], 1) ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  let cursor: string | null = set.has(today)
    ? today
    : set.has(addDays(today, -1))
      ? addDays(today, -1)
      : null;
  let current = 0;
  while (cursor && set.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  return { currentStreak: current, longestStreak: longest };
}

export interface CardStateView {
  due: Date;
  learnedAt: Date | null;
}

export interface DailyActivityView {
  day: string;
  reviews: number;
  learned: number;
}

export function buildOverview(
  userId: string,
  cardStates: CardStateView[],
  dailies: DailyActivityView[],
  now: Date,
): ProgressOverview {
  const dueCount = cardStates.filter(
    (c) => c.due.getTime() <= now.getTime(),
  ).length;
  const learnedWords = cardStates.filter((c) => c.learnedAt !== null).length;
  const totalReviews = dailies.reduce((sum, d) => sum + d.reviews, 0);
  const activeDays = dailies.filter((d) => d.reviews > 0).map((d) => d.day);
  const lastActiveDay = activeDays.length
    ? activeDays.slice().sort().at(-1)!
    : null;
  const { currentStreak, longestStreak } = computeStreak(
    activeDays,
    localDay(now),
  );

  return {
    userId,
    currentStreak,
    longestStreak,
    dueCount,
    learnedWords,
    totalReviews,
    lastActiveDay,
  };
}
