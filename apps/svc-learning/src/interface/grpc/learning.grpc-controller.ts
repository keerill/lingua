import { Controller } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { learningV1 } from '@lingua/contracts/proto';
import { ReviewGrade } from '@lingua/contracts';
import { GetReviewQueueUseCase } from '../../application/get-review-queue.usecase';
import { SubmitReviewUseCase } from '../../application/submit-review.usecase';

@Controller()
@learningV1.LearningServiceControllerMethods()
export class LearningGrpcController
  implements learningV1.LearningServiceController
{
  constructor(
    private readonly getReviewQueue: GetReviewQueueUseCase,
    private readonly submitReviewUseCase: SubmitReviewUseCase,
  ) {}

  async getQueue(
    request: learningV1.GetQueueRequest,
  ): Promise<learningV1.GetQueueResponse> {
    const n = Math.min(Math.max(request.limit || 20, 1), 100);
    const rows = await this.getReviewQueue.execute(request.ownerId, n);
    return { rows };
  }

  async submitReview(
    request: learningV1.SubmitReviewRequest,
  ): Promise<learningV1.NextSchedule> {
    if (![1, 2, 3, 4].includes(request.grade)) {
      throw new RpcException('grade must be 1|2|3|4');
    }
    return this.submitReviewUseCase.execute(
      request.ownerId,
      request.cardId,
      request.grade as ReviewGrade,
    );
  }
}
