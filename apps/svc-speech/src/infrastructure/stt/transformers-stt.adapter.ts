import { SttProvider } from '../../domain/ports/stt.provider';
import { Transcript } from '../../domain/value-objects';

export class TransformersSttAdapter implements SttProvider {
  private pipe: unknown = null;

  constructor(
    private readonly model = process.env.WHISPER_MODEL ??
      'Xenova/whisper-tiny.en',
  ) {}

  private async ensurePipeline(): Promise<
    (input: Float32Array) => Promise<{ text?: string }>
  > {
    if (!this.pipe) {
      const mod = (await import('@huggingface/transformers' as string)) as {
        pipeline: (task: string, model: string) => Promise<unknown>;
      };
      this.pipe = await mod.pipeline(
        'automatic-speech-recognition',
        this.model,
      );
    }
    return this.pipe as (input: Float32Array) => Promise<{ text?: string }>;
  }

  async transcribe(audio: Buffer, _mime: string): Promise<Transcript> {
    const asr = await this.ensurePipeline();
    const samples = decodePcm16WavToFloat32(audio);
    const out = await asr(samples);
    const text = (typeof out?.text === 'string' ? out.text : '').trim();
    return { text, confidence: text ? 0.9 : 0 };
  }
}

function decodePcm16WavToFloat32(buf: Buffer): Float32Array {
  let offset = buf.indexOf('data', 12, 'ascii');
  offset = offset >= 0 ? offset + 8 : 44;
  const n = Math.floor((buf.length - offset) / 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = buf.readInt16LE(offset + i * 2) / 32768;
  return out;
}
