import { Pronunciation, Transcript } from '../value-objects';

export const PRONUNCIATION_SCORER = Symbol('PronunciationScorer');

export interface PronunciationScorer {
  score(transcript: Transcript, reference?: string): Pronunciation;
}
