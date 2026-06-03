import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { NextSchedule, ReviewGrade, SubmitReviewDto } from '@lingua/contracts';
import { GetReviewQueueUseCase } from '../../application/get-review-queue.usecase';
import { SubmitReviewUseCase } from '../../application/submit-review.usecase';
import { DueScheduleRow } from '../../application/dto';
import { OwnerId } from './owner-id.decorator';

@Controller('internal/reviews')
export class LearningController {
  constructor(
    private readonly getReviewQueue: GetReviewQueueUseCase,
    private readonly submitReview: SubmitReviewUseCase,
  ) {}

  @Get('queue')
  getQueue(
    @OwnerId() userId: string,
    @Query('limit') limit?: string,
  ): Promise<DueScheduleRow[]> {
    const n = Math.min(Math.max(Number(limit) || 20, 1), 100);
    return this.getReviewQueue.execute(userId, n);
  }

  @Post(':cardId')
  submit(
    @OwnerId() userId: string,
    @Param('cardId') cardId: string,
    @Body() dto: SubmitReviewDto,
  ): Promise<NextSchedule> {
    if (![1, 2, 3, 4].includes(dto?.grade)) {
      throw new BadRequestException('grade must be 1|2|3|4');
    }
    return this.submitReview.execute(userId, cardId, dto.grade as ReviewGrade);
  }
}
