import { randomUUID } from 'node:crypto';
import { SpeakingMistakeDetectedEvent, Topics } from '@lingua/contracts';
import { Mistake } from './mistake';

export function speakingMistakeDetectedEvent(
  userId: string,
  sessionId: string,
  scenario: string,
  mistakes: Mistake[],
): SpeakingMistakeDetectedEvent {
  return {
    eventId: randomUUID(),
    type: Topics.SpeakingMistakeDetected,
    occurredAt: new Date().toISOString(),
    payload: {
      userId,
      sessionId,
      scenario,
      mistakes: mistakes.map((m) => ({
        term: m.term,
        translation: m.translation,
        kind: m.kind,
        context: m.context,
      })),
    },
  };
}
