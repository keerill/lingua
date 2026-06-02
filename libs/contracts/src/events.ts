import type { ScheduleState } from './dto';

export const Topics = {
  VocabularyCardCreated: 'vocabulary.card.created',
  LearningReviewCompleted: 'learning.review.completed',
  SpeakingMistakeDetected: 'speaking.mistake.detected',
  VocabularyCardsFlagged: 'vocabulary.cards.flagged',
  ContentScenarioUpdated: 'content.scenario.updated',
  NotificationSent: 'notification.sent',
} as const;

export type TopicName = (typeof Topics)[keyof typeof Topics];

export interface DomainEvent<TType extends TopicName, TPayload> {
  eventId: string;
  type: TType;
  occurredAt: string;
  payload: TPayload;
}

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

export interface ReviewCompletedPayload {
  userId: string;
  cardId: string;
  grade: 1 | 2 | 3 | 4;
  reviewedAt: string;
  state?: ScheduleState;
  due?: string;
  reps?: number;
  lapses?: number;
}

export type ReviewCompletedEvent = DomainEvent<
  typeof Topics.LearningReviewCompleted,
  ReviewCompletedPayload
>;

export type SpeakingMistakeKind = 'vocabulary' | 'grammar' | 'pronunciation';

export interface SpeakingMistake {
  term: string;

  translation?: string;
  kind: SpeakingMistakeKind;

  context: string;
}

export interface SpeakingMistakeDetectedPayload {
  userId: string;
  sessionId: string;
  scenario: string;
  mistakes: SpeakingMistake[];
}

export type SpeakingMistakeDetectedEvent = DomainEvent<
  typeof Topics.SpeakingMistakeDetected,
  SpeakingMistakeDetectedPayload
>;

export interface CardsFlaggedPayload {
  userId: string;

  cardIds: string[];
  reason: 'speaking-mistake';
}

export type CardsFlaggedEvent = DomainEvent<
  typeof Topics.VocabularyCardsFlagged,
  CardsFlaggedPayload
>;

export interface ScenarioUpdatedPayload {
  scenarioId: string;
  slug: string;

  change: 'upserted' | 'deleted';
}

export type ScenarioUpdatedEvent = DomainEvent<
  typeof Topics.ContentScenarioUpdated,
  ScenarioUpdatedPayload
>;

export type NotificationKind = 'daily-reminder' | 'streak-at-risk';

export interface NotificationSentPayload {
  userId: string;
  kind: NotificationKind;
  channel: 'log' | 'email' | 'push';
  sentAt: string;
}

export type NotificationSentEvent = DomainEvent<
  typeof Topics.NotificationSent,
  NotificationSentPayload
>;

export type AnyDomainEvent =
  | CardCreatedEvent
  | ReviewCompletedEvent
  | SpeakingMistakeDetectedEvent
  | CardsFlaggedEvent
  | ScenarioUpdatedEvent
  | NotificationSentEvent;
