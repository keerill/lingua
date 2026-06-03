export interface ScheduleSnapshot {
  stability: number;
  difficulty: number;
  due: Date;
  reps: number;
  lapses: number;
  state: number;
  lastReview: Date | null;
  learningSteps: number;
}
