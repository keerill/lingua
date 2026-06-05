import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { KafkaConsumer } from '@lingua/kafka';
import { ScenarioUpdatedEvent, Topics } from '@lingua/contracts';
import { ContentScenarioGrpcClient } from '../content/content-scenario.grpc-client';

@Injectable()
export class ScenarioUpdatedConsumer
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(ScenarioUpdatedConsumer.name);
  private readonly consumer: KafkaConsumer;

  constructor(private readonly scenarios: ContentScenarioGrpcClient) {
    this.consumer = new KafkaConsumer({
      brokers: process.env.KAFKA_BROKERS ?? 'localhost:9092',
      clientId: 'svc-ai-dialog-scenario-cache',
      groupId: 'svc-ai-dialog-scenario-cache',
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe(
      [Topics.ContentScenarioUpdated],
      async ({ value }) => {
        const event = value as ScenarioUpdatedEvent;
        if (event?.type !== Topics.ContentScenarioUpdated) return;
        this.scenarios.invalidate(event.payload.scenarioId);
        this.logger.log(
          `scenario cache invalidated for ${event.payload.scenarioId}`,
        );
      },
    );
    this.logger.log(`subscribed to ${Topics.ContentScenarioUpdated}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer.disconnect();
  }
}
