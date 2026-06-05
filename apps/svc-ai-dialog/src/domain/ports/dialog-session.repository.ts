import { SpeakingMistakeDetectedEvent } from '@lingua/contracts';

export const DIALOG_SESSION_REPOSITORY = Symbol('DialogSessionRepository');

export interface DialogTurnHistory {
  userText: string;
  aiText: string;
}

export interface AppendTurnInput {
  sessionId: string;
  userId: string;
  scenario: string;
  userText: string;
  aiText: string;

  event: SpeakingMistakeDetectedEvent | null;
}

export interface DialogSessionRepository {
  history(sessionId: string): Promise<DialogTurnHistory[]>;
  appendTurn(input: AppendTurnInput): Promise<void>;
}
