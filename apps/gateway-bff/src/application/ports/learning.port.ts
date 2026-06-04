import { NextSchedule, ReviewGrade } from '@lingua/contracts';

export const LEARNING_PORT = Symbol('LearningPort');

export interface DueScheduleRow {
  cardId: string;
  due: string;
  state: string;
  reps: number;
  lapses: number;
}

export interface LearningPort {
  getQueue(userId: string, limit: number): Promise<DueScheduleRow[]>;
  submitReview(
    userId: string,
    cardId: string,
    grade: ReviewGrade,
  ): Promise<NextSchedule>;
}
