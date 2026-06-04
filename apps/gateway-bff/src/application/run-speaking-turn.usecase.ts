import { Inject, Injectable } from '@nestjs/common';
import { DIALOG_PORT, DialogPort } from './ports/dialog.port';
import { SPEECH_PORT, SpeechPort } from './ports/speech.port';

export type RealtimeFrame =
  | { type: 'transcript'; text: string; confidence: number }
  | {
      type: 'pronunciation';
      score: number;
      words: { word: string; score: number }[];
    }
  | { type: 'ai-token'; delta: string }
  | { type: 'ai-done'; text: string }
  | { type: 'ai-audio'; url: string; mime: string }
  | { type: 'error'; message: string };

export interface SpeakingTurnInput {
  userId: string;
  sessionId: string;
  scenario: string;
  audio: Buffer;
  mime: string;
}

@Injectable()
export class RunSpeakingTurnUseCase {
  constructor(
    @Inject(SPEECH_PORT) private readonly speech: SpeechPort,
    @Inject(DIALOG_PORT) private readonly dialog: DialogPort,
  ) {}

  async execute(
    input: SpeakingTurnInput,
    emit: (frame: RealtimeFrame) => void,
  ): Promise<void> {
    const stt = await this.speech.transcribe(input.audio, input.mime);
    emit({
      type: 'transcript',
      text: stt.transcript,
      confidence: stt.confidence,
    });
    emit({
      type: 'pronunciation',
      score: stt.pronunciation.score,
      words: stt.pronunciation.words,
    });

    const aiText = await this.dialog.streamTurn(
      {
        sessionId: input.sessionId,
        userId: input.userId,
        scenario: input.scenario,
        userText: stt.transcript,
      },
      (token) => emit({ type: 'ai-token', delta: token }),
    );
    emit({ type: 'ai-done', text: aiText });

    if (aiText.trim().length > 0) {
      const tts = await this.speech.synthesize(aiText);
      emit({ type: 'ai-audio', url: tts.url, mime: tts.mime });
    }
  }
}
