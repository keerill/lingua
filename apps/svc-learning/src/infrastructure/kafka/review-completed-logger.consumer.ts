import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { KafkaConsumer } from '@lingua/kafka';
import { ReviewCompletedEvent, Topics } from '@lingua/contracts';

/**
 * Logger consumer for `learning.review.completed` (Slice 1 placeholder for the
 * future feedback loop). Runs in its OWN consumer group so it gets every event
 * independently of any other consumer. For now it just logs — later slices will
 * route review outcomes back into the repetition deck.
 */
@Injectable()
export class ReviewCompletedLoggerConsumer implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ReviewCompletedLoggerConsumer.name);
  private readonly consumer: KafkaConsumer;

  constructor() {
    this.consumer = new KafkaConsumer({
      brokers: process.env.KAFKA_BROKERS ?? 'localhost:9092',
      clientId: 'svc-learning-review-logger',
      groupId: 'svc-learning-review-logger',
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe([Topics.LearningReviewCompleted], async ({ value }) => {
      const event = value as ReviewCompletedEvent;
      if (event?.type !== Topics.LearningReviewCompleted) return;
      const { userId, cardId, grade, reviewedAt } = event.payload;
      this.logger.log(
        `review.completed: user=${userId} card=${cardId} grade=${grade} at=${reviewedAt}`,
      );
    });
    this.logger.log(`subscribed to ${Topics.LearningReviewCompleted}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer.disconnect();
  }
}
