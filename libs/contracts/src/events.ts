/**
 * Kafka event contracts — the single source of truth for asynchronous
 * messages flowing through the bus. Every event is published via the
 * transactional outbox (see libs/kafka) wrapped in a {@link DomainEvent}
 * envelope.
 *
 * NOTE (Slice 1): event payload shapes are defined here as TypeScript types.
 * Slice 4 replaces this hand-written source of truth with Avro/Protobuf code
 * generation for both TS and Python; the topic constants and envelope stay.
 */

/** Kafka topic names. Use these constants — never inline string literals. */
export const Topics = {
  VocabularyCardCreated: 'vocabulary.card.created',
  LearningReviewCompleted: 'learning.review.completed',
} as const;

export type TopicName = (typeof Topics)[keyof typeof Topics];

/**
 * Common event envelope. Carries metadata for idempotent, at-least-once
 * consumers: `eventId` is the dedup key, `type` the topic, `occurredAt` the
 * domain timestamp.
 */
export interface DomainEvent<TType extends TopicName, TPayload> {
  eventId: string; // uuid — dedup key for idempotent consumers
  type: TType;
  occurredAt: string; // ISO-8601
  payload: TPayload;
}

// ---------------------------------------------------------------------------
// vocabulary.card.created
//   Emitted by svc-vocabulary when a card is added. svc-learning consumes it
//   to create the initial FSRS schedule for the card's owner.
// ---------------------------------------------------------------------------

export interface CardCreatedPayload {
  cardId: string;
  deckId: string;
  ownerId: string;
  term: string;
}

export type CardCreatedEvent = DomainEvent<
  typeof Topics.VocabularyCardCreated,
  CardCreatedPayload
>;

// ---------------------------------------------------------------------------
// learning.review.completed
//   Emitted by svc-learning after a review. Slice 1: a logger consumer only
//   (foundation for the future feedback loop).
// ---------------------------------------------------------------------------

export interface ReviewCompletedPayload {
  userId: string;
  cardId: string;
  grade: 1 | 2 | 3 | 4;
  reviewedAt: string; // ISO-8601
}

export type ReviewCompletedEvent = DomainEvent<
  typeof Topics.LearningReviewCompleted,
  ReviewCompletedPayload
>;

/** Discriminated union of all known domain events. */
export type AnyDomainEvent = CardCreatedEvent | ReviewCompletedEvent;
