import { Inject, Injectable } from '@nestjs/common';
import { TTS_PROVIDER, TtsProvider } from '../domain/ports/tts.provider';
import { AUDIO_STORE, AudioStore } from '../domain/ports/audio.store';

export interface SynthesizeResult {
  url: string;
  objectKey: string;
  mime: string;
}

@Injectable()
export class SynthesizeUseCase {
  constructor(
    @Inject(TTS_PROVIDER) private readonly tts: TtsProvider,
    @Inject(AUDIO_STORE) private readonly store: AudioStore,
  ) {}

  async execute(text: string, voice?: string): Promise<SynthesizeResult> {
    const wav = await this.tts.synthesize(text, voice);
    const { objectKey, url } = await this.store.putWav(wav, 'tts');
    return { url, objectKey, mime: 'audio/wav' };
  }
}
