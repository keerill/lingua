import { Inject, Injectable } from '@nestjs/common';
import { STT_PROVIDER, SttProvider } from '../domain/ports/stt.provider';
import {
  PRONUNCIATION_SCORER,
  PronunciationScorer,
} from '../domain/ports/pronunciation.scorer';
import { Pronunciation } from '../domain/value-objects';

export interface TranscribeResult {
  transcript: string;
  confidence: number;
  pronunciation: Pronunciation;
}

@Injectable()
export class TranscribeUseCase {
  constructor(
    @Inject(STT_PROVIDER) private readonly stt: SttProvider,
    @Inject(PRONUNCIATION_SCORER) private readonly scorer: PronunciationScorer,
  ) {}

  async execute(
    audio: Buffer,
    mime: string,
    reference?: string,
  ): Promise<TranscribeResult> {
    const transcript = await this.stt.transcribe(audio, mime);
    const pronunciation = this.scorer.score(transcript, reference);
    return {
      transcript: transcript.text,
      confidence: Math.round(transcript.confidence * 1000) / 1000,
      pronunciation,
    };
  }
}
