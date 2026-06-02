export interface ProgressOverview {
  userId: string;

  currentStreak: number;
  longestStreak: number;

  dueCount: number;

  learnedWords: number;
  totalReviews: number;

  lastActiveDay: string | null;
}

export interface DailyPoint {
  day: string;
  count: number;
}

export interface PronunciationPoint {
  day: string;
  mistakes: number;
}

export interface ProgressDashboard {
  overview: ProgressOverview;
  reviewsByDay: DailyPoint[];
  learnedByDay: DailyPoint[];
  pronunciationTrend: PronunciationPoint[];
}
