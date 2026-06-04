import { RealtimeFrame, RunSpeakingTurnUseCase } from './run-speaking-turn.usecase';
import { SpeechPort } from './ports/speech.port';
import { DialogPort } from './ports/dialog.port';

const speech: SpeechPort = {
  transcribe: async () => ({
    transcript: 'hello world',
    confidence: 0.9,
    pronunciation: { score: 90, words: [{ word: 'hello', score: 88 }] },
  }),
  synthesize: async () => ({ url: 'http://x/audio.wav', objectKey: 'audio.wav', mime: 'audio/wav' }),
};

const dialog: DialogPort = {
  listScenarios: async () => [],
  streamTurn: async (_req, onToken) => {
    onToken('Hi ');
    onToken('there');
    return 'Hi there';
  },
};

describe('RunSpeakingTurnUseCase', () => {
  it('emits transcript → pronunciation → ai-token(s) → ai-done → ai-audio in order', async () => {
    const useCase = new RunSpeakingTurnUseCase(speech, dialog);
    const frames: RealtimeFrame[] = [];

    await useCase.execute(
      { userId: 'u1', sessionId: 's1', scenario: 'interview', audio: Buffer.from([1]), mime: 'audio/webm' },
      (f) => frames.push(f),
    );

    expect(frames.map((f) => f.type)).toEqual([
      'transcript',
      'pronunciation',
      'ai-token',
      'ai-token',
      'ai-done',
      'ai-audio',
    ]);
    const done = frames.find((f) => f.type === 'ai-done') as Extract<RealtimeFrame, { type: 'ai-done' }>;
    expect(done.text).toBe('Hi there');
  });

  it('skips TTS when the assistant produced no text', async () => {
    const emptyDialog: DialogPort = { ...dialog, streamTurn: async () => '' };
    const useCase = new RunSpeakingTurnUseCase(speech, emptyDialog);
    const frames: RealtimeFrame[] = [];
    await useCase.execute(
      { userId: 'u1', sessionId: 's1', scenario: 'interview', audio: Buffer.from([1]), mime: 'audio/webm' },
      (f) => frames.push(f),
    );
    expect(frames.map((f) => f.type)).not.toContain('ai-audio');
  });
});
