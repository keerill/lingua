import { SpeakingMistakeKind } from '@lingua/contracts';

export interface Mistake {
  term: string;
  kind: SpeakingMistakeKind;

  context: string;

  translation?: string;
}
