import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { KafkaConsumer } from '@lingua/kafka';
import { CardsFlaggedEvent, Topics } from '@lingua/contracts';
import { FlagCardsDueUseCase } from '../../application/flag-cards-due.usecase';

@Injectable()
export class CardsFlaggedConsumer
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(CardsFlaggedConsumer.name);
  private readonly consumer: KafkaConsumer;

  constructor(private readonly flagCardsDue: FlagCardsDueUseCase) {
    this.consumer = new KafkaConsumer({
      brokers: process.env.KAFKA_BROKERS ?? 'localhost:9092',
      clientId: 'svc-learning-cards-flagged',
      groupId: 'svc-learning-cards-flagged',
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe(
      [Topics.VocabularyCardsFlagged],
      async ({ value }) => {
        const event = value as CardsFlaggedEvent;
        if (event?.type !== Topics.VocabularyCardsFlagged) return;
        await this.flagCardsDue.execute(
          event.payload.userId,
          event.payload.cardIds,
        );
      },
    );
    this.logger.log(`subscribed to ${Topics.VocabularyCardsFlagged}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer.disconnect();
  }
}
