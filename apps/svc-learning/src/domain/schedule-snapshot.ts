/**
 * The persisted FSRS state of a card's schedule — a value record (subset of
 * the ts-fsrs `Card` we store). Pure domain type, no framework/Prisma coupling.
 */
export interface ScheduleSnapshot {
  stability: number;
  difficulty: number;
  due: Date;
  reps: number;
  lapses: number;
  state: number; // ts-fsrs State enum: 0=New 1=Learning 2=Review 3=Relearning
  lastReview: Date | null;
  learningSteps: number;
}
