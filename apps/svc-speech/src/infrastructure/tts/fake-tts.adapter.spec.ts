import { FakeTtsAdapter } from './fake-tts.adapter';

describe('FakeTtsAdapter', () => {
  const tts = new FakeTtsAdapter();

  it('produces a valid playable WAV (RIFF/WAVE, mono 16-bit @16kHz)', async () => {
    const wav = await tts.synthesize('Hello, how are you today?');
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
    expect(wav.readUInt16LE(22)).toBe(1);
    expect(wav.readUInt32LE(24)).toBe(16_000);
    expect(wav.readUInt16LE(34)).toBe(16);
    expect(wav.length).toBeGreaterThan(44);
  });

  it('longer text yields longer audio', async () => {
    const short = await tts.synthesize('hi');
    const long = await tts.synthesize('hi '.repeat(200));
    expect(long.length).toBeGreaterThan(short.length);
  });

  it('is deterministic', async () => {
    const a = await tts.synthesize('same text');
    const b = await tts.synthesize('same text');
    expect(a.equals(b)).toBe(true);
  });
});
