import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { KafkaConsumer } from '@lingua/kafka';
import { SpeakingMistakeDetectedEvent, Topics } from '@lingua/contracts';
import { IngestSpeakingMistakesUseCase } from '../../application/ingest-speaking-mistakes.usecase';

@Injectable()
export class SpeakingMistakeConsumer
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(SpeakingMistakeConsumer.name);
  private readonly consumer: KafkaConsumer;

  constructor(private readonly ingest: IngestSpeakingMistakesUseCase) {
    this.consumer = new KafkaConsumer({
      brokers: process.env.KAFKA_BROKERS ?? 'localhost:9092',
      clientId: 'svc-vocabulary',
      groupId: 'svc-vocabulary',
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe(
      [Topics.SpeakingMistakeDetected],
      async ({ value }) => {
        const event = value as SpeakingMistakeDetectedEvent;
        if (event?.type !== Topics.SpeakingMistakeDetected) return;
        await this.ingest.execute(event.payload);
      },
    );
    this.logger.log(`subscribed to ${Topics.SpeakingMistakeDetected}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer.disconnect();
  }
}
