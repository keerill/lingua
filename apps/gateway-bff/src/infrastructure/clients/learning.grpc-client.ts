import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { NextSchedule, ReviewGrade } from '@lingua/contracts';
import { learningV1 } from '@lingua/contracts/proto';
import {
  DueScheduleRow,
  LearningPort,
} from '../../application/ports/learning.port';
import { LEARNING_GRPC } from './grpc.tokens';

@Injectable()
export class LearningGrpcClient implements LearningPort, OnModuleInit {
  private svc!: learningV1.LearningServiceClient;

  constructor(@Inject(LEARNING_GRPC) private readonly client: ClientGrpc) {}

  onModuleInit(): void {
    this.svc = this.client.getService<learningV1.LearningServiceClient>(
      learningV1.LEARNING_SERVICE_NAME,
    );
  }

  async getQueue(userId: string, limit: number): Promise<DueScheduleRow[]> {
    const res = await firstValueFrom(
      this.svc.getQueue({ ownerId: userId, limit }),
    );
    return res.rows ?? [];
  }

  async submitReview(
    userId: string,
    cardId: string,
    grade: ReviewGrade,
  ): Promise<NextSchedule> {
    const r = await firstValueFrom(
      this.svc.submitReview({ ownerId: userId, cardId, grade }),
    );
    return {
      cardId: r.cardId,
      due: r.due,
      stability: r.stability,
      difficulty: r.difficulty,
      state: r.state as NextSchedule['state'],
      reps: r.reps,
      lapses: r.lapses,
      lastReview: r.lastReview,
    };
  }
}
