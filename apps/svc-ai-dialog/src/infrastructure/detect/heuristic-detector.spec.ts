import { HeuristicDetector } from './heuristic-detector';

const terms = (ms: { term: string }[]) => new Set(ms.map((m) => m.term));

describe('HeuristicDetector', () => {
  const det = new HeuristicDetector();

  it('detects past-marker + base verb and vocabulary confusions', () => {
    const mistakes = det.detect('Yesterday I go to the airport and I miss my fly.');
    const t = terms(mistakes);
    expect(t.has('went')).toBe(true);
    expect(t.has('missed')).toBe(true);
    expect(t.has('flight')).toBe(true);
    const byTerm = Object.fromEntries(mistakes.map((m) => [m.term, m]));
    expect(byTerm['flight'].kind).toBe('vocabulary');
    expect(byTerm['went'].kind).toBe('grammar');
    expect(byTerm['went'].context).toContain('airport');
  });

  it('detects subject-verb agreement', () => {
    const mistakes = det.detect("She don't like to travel by train because it is slow.");
    expect(terms(mistakes).has("doesn't")).toBe(true);
  });

  it('detects invalid irregular past', () => {
    const mistakes = det.detect('I think the meeting was productive but I forgetted the agenda.');
    expect(terms(mistakes).has('forgot')).toBe(true);
  });

  it('returns nothing for a clean sentence', () => {
    expect(det.detect('I am very nervous about my job interview tomorrow.')).toEqual([]);
  });

  it('is deterministic and deduplicated', () => {
    const text = 'Yesterday I go and go to the airport.';
    expect(terms(det.detect(text))).toEqual(terms(det.detect(text)));
    expect(det.detect(text).filter((m) => m.term === 'went')).toHaveLength(1);
  });
});
