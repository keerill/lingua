import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DueCard, NextSchedule, ReviewGrade, SubmitReviewDto } from '@lingua/contracts';
import { CurrentUser, JwtAuthGuard } from '@lingua/auth';
import { GetReviewQueueUseCase } from '../../application/get-review-queue.usecase';
import { LEARNING_PORT, LearningPort } from '../../application/ports/learning.port';

/**
 * Public review API for the SPA. `/queue` is the aggregation use case;
 * submitting a review is a thin proxy onto the learning port.
 */
@Controller('reviews')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(
    private readonly getReviewQueue: GetReviewQueueUseCase,
    @Inject(LEARNING_PORT) private readonly learning: LearningPort,
  ) {}

  @Get('queue')
  queue(@CurrentUser('sub') sub: string, @Query('limit') limit?: string): Promise<DueCard[]> {
    const n = Math.min(Math.max(Number(limit) || 20, 1), 100);
    return this.getReviewQueue.execute(sub, n);
  }

  @Post(':cardId')
  submit(
    @CurrentUser('sub') sub: string,
    @Param('cardId') cardId: string,
    @Body() dto: SubmitReviewDto,
  ): Promise<NextSchedule> {
    if (![1, 2, 3, 4].includes(dto?.grade)) {
      throw new BadRequestException('grade must be 1|2|3|4');
    }
    return this.learning.submitReview(sub, cardId, dto.grade as ReviewGrade);
  }
}
