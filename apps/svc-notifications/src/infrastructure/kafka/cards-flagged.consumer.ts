import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { KafkaConsumer } from '@lingua/kafka';
import { CardsFlaggedEvent, Topics } from '@lingua/contracts';
import { FlagDueUseCase } from '../../application/record-activity.usecases';

@Injectable()
export class CardsFlaggedConsumer
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(CardsFlaggedConsumer.name);
  private readonly consumer: KafkaConsumer;

  constructor(private readonly flagDue: FlagDueUseCase) {
    this.consumer = new KafkaConsumer({
      brokers: process.env.KAFKA_BROKERS ?? 'localhost:9092',
      clientId: 'svc-notifications-flagged',
      groupId: 'svc-notifications-flagged',
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe(
      [Topics.VocabularyCardsFlagged],
      async ({ value }) => {
        const event = value as CardsFlaggedEvent;
        if (event?.type !== Topics.VocabularyCardsFlagged) return;
        await this.flagDue.execute(event);
      },
    );
    this.logger.log(`subscribed to ${Topics.VocabularyCardsFlagged}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer.disconnect();
  }
}
