import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { KafkaConsumer } from '@lingua/kafka';
import { ReviewCompletedEvent, Topics } from '@lingua/contracts';
import { RecordReviewUseCase } from '../../application/record-activity.usecases';

@Injectable()
export class ReviewCompletedConsumer
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(ReviewCompletedConsumer.name);
  private readonly consumer: KafkaConsumer;

  constructor(private readonly recordReview: RecordReviewUseCase) {
    this.consumer = new KafkaConsumer({
      brokers: process.env.KAFKA_BROKERS ?? 'localhost:9092',
      clientId: 'svc-notifications-review',
      groupId: 'svc-notifications-review',
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe(
      [Topics.LearningReviewCompleted],
      async ({ value }) => {
        const event = value as ReviewCompletedEvent;
        if (event?.type !== Topics.LearningReviewCompleted) return;
        await this.recordReview.execute(event);
      },
    );
    this.logger.log(`subscribed to ${Topics.LearningReviewCompleted}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer.disconnect();
  }
}
