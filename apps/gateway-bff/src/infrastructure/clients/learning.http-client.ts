import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { NextSchedule, ReviewGrade } from '@lingua/contracts';
import {
  DueScheduleRow,
  LearningPort,
} from '../../application/ports/learning.port';

@Injectable()
export class LearningHttpClient implements LearningPort {
  private readonly http: AxiosInstance = axios.create({
    baseURL: process.env.SVC_LEARNING_URL ?? 'http://localhost:3103',
    timeout: 5000,
  });

  private headers(userId: string) {
    return { headers: { 'x-owner-id': userId } };
  }

  async getQueue(userId: string, limit: number): Promise<DueScheduleRow[]> {
    const { data } = await this.http.get<DueScheduleRow[]>(
      '/internal/reviews/queue',
      {
        ...this.headers(userId),
        params: { limit },
      },
    );
    return data;
  }

  async submitReview(
    userId: string,
    cardId: string,
    grade: ReviewGrade,
  ): Promise<NextSchedule> {
    const { data } = await this.http.post<NextSchedule>(
      `/internal/reviews/${cardId}`,
      { grade },
      this.headers(userId),
    );
    return data;
  }
}
