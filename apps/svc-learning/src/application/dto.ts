/** A due schedule row enriched with the FSRS state name (application output). */
export interface DueScheduleRow {
  cardId: string;
  due: string;
  state: string;
  reps: number;
  lapses: number;
}
