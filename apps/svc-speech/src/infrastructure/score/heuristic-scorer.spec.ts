import { HeuristicScorer } from './heuristic-scorer';

describe('HeuristicScorer', () => {
  const scorer = new HeuristicScorer();

  it('overall score tracks STT confidence', () => {
    const p = scorer.score({ text: 'hello world', confidence: 0.9 });
    expect(p.score).toBe(90);
  });

  it('per-word scores are present and bounded', () => {
    const p = scorer.score({ text: 'I miss my fly', confidence: 0.82 });
    expect(p.words.map((w) => w.word)).toEqual(['i', 'miss', 'my', 'fly']);
    expect(p.words.every((w) => w.score >= 0 && w.score <= 100)).toBe(true);
  });

  it('is deterministic', () => {
    const t = { text: 'the meeting was productive', confidence: 0.7 };
    const a = scorer.score(t);
    const b = scorer.score(t);
    expect(a.score).toBe(b.score);
    expect(a.words).toEqual(b.words);
  });
});
