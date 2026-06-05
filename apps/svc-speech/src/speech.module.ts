import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { STT_PROVIDER, SttProvider } from './domain/ports/stt.provider';
import { TTS_PROVIDER, TtsProvider } from './domain/ports/tts.provider';
import { PRONUNCIATION_SCORER } from './domain/ports/pronunciation.scorer';
import { AUDIO_STORE } from './domain/ports/audio.store';
import { TranscribeUseCase } from './application/transcribe.usecase';
import { SynthesizeUseCase } from './application/synthesize.usecase';
import { FakeSttAdapter } from './infrastructure/stt/fake-stt.adapter';
import { FakeTtsAdapter } from './infrastructure/tts/fake-tts.adapter';
import { HeuristicScorer } from './infrastructure/score/heuristic-scorer';
import { MinioAudioStore } from './infrastructure/store/minio-audio.store';
import { SpeechController } from './interface/http/speech.controller';
import { HealthController } from './interface/http/health.controller';

function sttFactory(): SttProvider {
  if ((process.env.STT_PROVIDER ?? 'fake').toLowerCase() === 'transformers') {
    const {
      TransformersSttAdapter,
    } = require('./infrastructure/stt/transformers-stt.adapter');
    return new TransformersSttAdapter();
  }
  return new FakeSttAdapter();
}

function ttsFactory(): TtsProvider {
  if ((process.env.TTS_PROVIDER ?? 'fake').toLowerCase() === 'piper') {
    const {
      PiperTtsAdapter,
    } = require('./infrastructure/tts/piper-tts.adapter');
    return new PiperTtsAdapter();
  }
  return new FakeTtsAdapter();
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [SpeechController, HealthController],
  providers: [
    TranscribeUseCase,
    SynthesizeUseCase,
    { provide: STT_PROVIDER, useFactory: sttFactory },
    { provide: TTS_PROVIDER, useFactory: ttsFactory },
    { provide: PRONUNCIATION_SCORER, useClass: HeuristicScorer },
    { provide: AUDIO_STORE, useClass: MinioAudioStore },
  ],
})
export class SpeechModule {}
