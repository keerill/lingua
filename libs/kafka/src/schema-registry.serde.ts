import {
  ProtobufDeserializer,
  ProtobufSerializer,
  SchemaRegistryClient,
  SerdeType,
} from '@confluentinc/schemaregistry';
import {
  create,
  createMutableRegistry,
  type DescMessage,
  type MessageInitShape,
} from '@bufbuild/protobuf';
import { Topics } from '@lingua/contracts';
import { eventsV1 } from '@lingua/contracts/proto';
import type { KafkaSerde } from './serde';

export interface SchemaRegistrySerdeConfig {
  baseUrl: string;

  basicAuth?: { username: string; password: string };
}

const TOPIC_SCHEMA: Record<string, DescMessage> = {
  [Topics.VocabularyCardCreated]: eventsV1.CardCreatedEventSchema,
  [Topics.LearningReviewCompleted]: eventsV1.ReviewCompletedEventSchema,
  [Topics.SpeakingMistakeDetected]: eventsV1.SpeakingMistakeDetectedEventSchema,
  [Topics.VocabularyCardsFlagged]: eventsV1.CardsFlaggedEventSchema,
  [Topics.ContentScenarioUpdated]: eventsV1.ScenarioUpdatedEventSchema,
  [Topics.NotificationSent]: eventsV1.NotificationSentEventSchema,
};

export function createSchemaRegistrySerde(
  cfg: SchemaRegistrySerdeConfig,
): KafkaSerde {
  const client = new SchemaRegistryClient({
    baseURLs: [cfg.baseUrl],
    ...(cfg.basicAuth && {
      basicAuthCredentials: {
        credentialsSource: 'USER_INFO',
        userInfo: `${cfg.basicAuth.username}:${cfg.basicAuth.password}`,
      },
    }),
  });
  const registry = createMutableRegistry(eventsV1.file_lingua_events_v1_events);
  const serializer = new ProtobufSerializer(client, SerdeType.VALUE, {
    autoRegisterSchemas: true,
    useLatestVersion: false,
    registry,
  });
  const deserializer = new ProtobufDeserializer(client, SerdeType.VALUE, {});

  return {
    async serialize(topic, value) {
      const schema = TOPIC_SCHEMA[topic];
      if (!schema) {
        throw new Error(
          `[kafka-serde] no Protobuf schema registered for topic "${topic}"`,
        );
      }
      const message = create(schema, value as MessageInitShape<DescMessage>);
      return serializer.serialize(topic, message);
    },
    async deserialize(topic, data) {
      return deserializer.deserialize(topic, data);
    },
  };
}
