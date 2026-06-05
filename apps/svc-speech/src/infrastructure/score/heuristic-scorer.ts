import { PronunciationScorer } from '../../domain/ports/pronunciation.scorer';
import {
  Pronunciation,
  Transcript,
  WordScore,
} from '../../domain/value-objects';

export class HeuristicScorer implements PronunciationScorer {
  score(transcript: Transcript, _reference?: string): Pronunciation {
    const conf = Math.max(0, Math.min(1, transcript.confidence));
    const overall = Math.round(conf * 100 * 10) / 10;

    const words: WordScore[] = [];
    for (const raw of transcript.text.split(/\s+/)) {
      const word = raw.replace(/[.,!?;:]/g, '').toLowerCase();
      if (!word) continue;
      const spread =
        ([...word].reduce((a, c) => a + c.charCodeAt(0), 0) % 21) - 10;
      const s = Math.max(0, Math.min(100, overall + spread));
      words.push({ word, score: Math.round(s * 10) / 10 });
    }
    return { score: overall, words };
  }
}
