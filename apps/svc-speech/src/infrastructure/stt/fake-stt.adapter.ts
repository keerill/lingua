import { SttProvider } from '../../domain/ports/stt.provider';
import { Transcript } from '../../domain/value-objects';

const UTTERANCES = [
  'Yesterday I go to the airport and I miss my fly.',
  'I am very nervous about my job interview tomorrow.',
  'Can I have a glass of wine and the chicken, please?',
  'I think the meeting was productive but I forgetted the agenda.',
  "She don't like to travel by train because it is slow.",
];

export class FakeSttAdapter implements SttProvider {
  async transcribe(audio: Buffer, _mime: string): Promise<Transcript> {
    const idx = Math.floor(audio.length / 7) % UTTERANCES.length;
    return { text: UTTERANCES[idx], confidence: 0.82 };
  }
}
