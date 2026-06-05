import { FakeSttAdapter } from './fake-stt.adapter';

describe('FakeSttAdapter', () => {
  const stt = new FakeSttAdapter();

  it('is deterministic for the same audio', async () => {
    const audio = Buffer.alloc(1000);
    const a = await stt.transcribe(audio, 'audio/webm');
    const b = await stt.transcribe(audio, 'audio/webm');
    expect(a.text).toBe(b.text);
    expect(a.confidence).toBeGreaterThan(0);
    expect(a.confidence).toBeLessThanOrEqual(1);
  });

  it('returns a learner utterance containing a mistake', async () => {
    const result = await stt.transcribe(Buffer.alloc(0), 'audio/webm');
    expect(result.text).toBe('Yesterday I go to the airport and I miss my fly.');
  });

  it('varies with audio length', async () => {
    const texts = new Set<string>();
    for (let i = 0; i < 5; i++) {
      texts.add((await stt.transcribe(Buffer.alloc(i * 7), 'audio/webm')).text);
    }
    expect(texts.size).toBeGreaterThan(1);
  });
});
