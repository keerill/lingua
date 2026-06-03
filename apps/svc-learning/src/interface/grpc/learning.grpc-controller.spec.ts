import { INestApplication } from '@nestjs/common';
import {
  ClientGrpc,
  ClientsModule,
  type MicroserviceOptions,
  Transport,
} from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { firstValueFrom } from 'rxjs';
import { learningV1 } from '@lingua/contracts/proto';
import { resolveProtoPath } from '@lingua/grpc';
import { LearningGrpcController } from './learning.grpc-controller';
import { GetReviewQueueUseCase } from '../../application/get-review-queue.usecase';
import { SubmitReviewUseCase } from '../../application/submit-review.usecase';

const URL = '127.0.0.1:51777';
const PROTO = resolveProtoPath('lingua/learning/v1/learning.proto');
const grpcOptions = {
  package: learningV1.LINGUA_LEARNING_V1_PACKAGE_NAME,
  protoPath: PROTO,
  url: URL,
};

describe('LearningGrpcController (gRPC round-trip)', () => {
  let app: INestApplication;
  let svc: learningV1.LearningServiceClient;
  const getReviewQueue = { execute: jest.fn() };
  const submitReview = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [LearningGrpcController],
      providers: [
        { provide: GetReviewQueueUseCase, useValue: getReviewQueue },
        { provide: SubmitReviewUseCase, useValue: submitReview },
      ],
      imports: [
        ClientsModule.register([
          { name: 'LEARNING', transport: Transport.GRPC, options: grpcOptions },
        ]),
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.GRPC,
      options: grpcOptions,
    });
    await app.init();
    await app.startAllMicroservices();

    const client = app.get<ClientGrpc>('LEARNING');
    svc = client.getService<learningV1.LearningServiceClient>(
      learningV1.LEARNING_SERVICE_NAME,
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  it('getQueue clamps the limit and wraps rows', async () => {
    getReviewQueue.execute.mockResolvedValue([
      {
        cardId: 'c1',
        due: '2026-06-10T00:00:00.000Z',
        state: 'Review',
        reps: 2,
        lapses: 0,
      },
    ]);

    const res = await firstValueFrom(svc.getQueue({ ownerId: 'u1', limit: 5 }));

    expect(getReviewQueue.execute).toHaveBeenCalledWith('u1', 5);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]).toMatchObject({
      cardId: 'c1',
      state: 'Review',
      reps: 2,
    });
  });

  it('submitReview forwards the grade and returns the next schedule', async () => {
    submitReview.execute.mockResolvedValue({
      cardId: 'c1',
      due: '2026-06-11T00:00:00.000Z',
      stability: 3.2,
      difficulty: 5.1,
      state: 'Review',
      reps: 3,
      lapses: 0,
      lastReview: '2026-06-10T00:00:00.000Z',
    });

    const res = await firstValueFrom(
      svc.submitReview({ ownerId: 'u1', cardId: 'c1', grade: 3 }),
    );

    expect(submitReview.execute).toHaveBeenCalledWith('u1', 'c1', 3);
    expect(res).toMatchObject({ cardId: 'c1', reps: 3, state: 'Review' });
  });

  it('submitReview rejects an out-of-range grade', async () => {
    await expect(
      firstValueFrom(
        svc.submitReview({ ownerId: 'u1', cardId: 'c1', grade: 9 }),
      ),
    ).rejects.toBeDefined();
  });
});
