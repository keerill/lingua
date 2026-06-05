import { spawn } from 'node:child_process';
import { TtsProvider } from '../../domain/ports/tts.provider';

export class PiperTtsAdapter implements TtsProvider {
  constructor(
    private readonly voice = process.env.PIPER_VOICE ?? 'en_US-lessac-medium',
  ) {}

  synthesize(text: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const proc = spawn(
        'piper',
        ['--model', this.voice, '--output_file', '-'],
        {
          stdio: ['pipe', 'pipe', 'inherit'],
        },
      );
      proc.stdout.on('data', (c: Buffer) => chunks.push(c));
      proc.on('error', reject);
      proc.on('close', (code) =>
        code === 0
          ? resolve(Buffer.concat(chunks))
          : reject(new Error(`piper exited ${code}`)),
      );
      proc.stdin.write(text);
      proc.stdin.end();
    });
  }
}
