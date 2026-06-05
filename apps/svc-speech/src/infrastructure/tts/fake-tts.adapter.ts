import { TtsProvider } from '../../domain/ports/tts.provider';

const SAMPLE_RATE = 16_000;
const FREQ_HZ = 220;
const SECONDS_PER_CHAR = 0.045;
const MAX_SECONDS = 6;

export class FakeTtsAdapter implements TtsProvider {
  async synthesize(text: string, _voice?: string): Promise<Buffer> {
    const seconds = Math.min(
      MAX_SECONDS,
      Math.max(0.4, text.length * SECONDS_PER_CHAR),
    );
    const n = Math.floor(SAMPLE_RATE * seconds);
    const amp = 0.18 * 32767;

    const dataSize = n * 2;
    const buf = Buffer.alloc(44 + dataSize);
    buf.write('RIFF', 0);
    buf.writeUInt32LE(36 + dataSize, 4);
    buf.write('WAVE', 8);
    buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);
    buf.writeUInt16LE(1, 22);
    buf.writeUInt32LE(SAMPLE_RATE, 24);
    buf.writeUInt32LE(SAMPLE_RATE * 2, 28);
    buf.writeUInt16LE(2, 32);
    buf.writeUInt16LE(16, 34);
    buf.write('data', 36);
    buf.writeUInt32LE(dataSize, 40);

    for (let i = 0; i < n; i++) {
      const fade = Math.min(1, i / 800, (n - i) / 800);
      const sample = Math.round(
        amp * fade * Math.sin((2 * Math.PI * FREQ_HZ * i) / SAMPLE_RATE),
      );
      buf.writeInt16LE(sample, 44 + i * 2);
    }
    return buf;
  }
}
