import type { AddressInfo } from 'node:net';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { WebSocket } from 'ws';
import { KEYCLOAK_VERIFIER } from '@lingua/auth';
import { GatewayModule } from '../../gateway.module';
import { SPEECH_PORT } from '../../application/ports/speech.port';
import { DIALOG_PORT } from '../../application/ports/dialog.port';

const fakeSpeech = {
  transcribe: jest.fn().mockResolvedValue({
    transcript: 'yesterday I go to the airport',
    confidence: 0.8,
    pronunciation: { score: 80, words: [{ word: 'go', score: 72 }] },
  }),
  synthesize: jest.fn().mockResolvedValue({
    url: 'http://localhost:9000/lingua-audio/tts/abc.wav',
    objectKey: 'tts/abc.wav',
    mime: 'audio/wav',
  }),
};

const fakeDialog = {
  listScenarios: jest.fn().mockResolvedValue([]),
  streamTurn: jest
    .fn()
    .mockImplementation(async (_req, onToken: (t: string) => void) => {
      onToken('Hello ');
      onToken('there');
      return 'Hello there';
    }),
};

const fakeVerifier = {
  verify: jest.fn().mockImplementation(async (token: string) => {
    if (token !== 'good') throw new Error('invalid token');
    return {
      sub: 'user-1',
      email: 'u@e.test',
      displayName: 'U',
      roles: ['learner'],
    };
  }),
};

describe('RealtimeGateway (WS speaking flow)', () => {
  let app: INestApplication;
  let port: number;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [GatewayModule],
    })
      .overrideProvider(KEYCLOAK_VERIFIER)
      .useValue(fakeVerifier)
      .overrideProvider(SPEECH_PORT)
      .useValue(fakeSpeech)
      .overrideProvider(DIALOG_PORT)
      .useValue(fakeDialog)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);
    port = (app.getHttpServer().address() as AddressInfo).port;
  });

  afterAll(async () => {
    await app.close();
  });

  it('validates the token on handshake and streams a full turn', async () => {
    const frames: any[] = [];
    const url = `ws://127.0.0.1:${port}/realtime/speaking?token=good`;
    const ws = new WebSocket(url);

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out')), 4000);
      ws.on('open', () => {
        ws.send(
          JSON.stringify({
            type: 'start',
            scenario: 'interview',
            sessionId: 'sess-1',
          }),
        );
        ws.send(Buffer.from([1, 2, 3, 4, 5, 6, 7]));
      });
      ws.on('message', (data) => {
        const frame = JSON.parse(data.toString());
        frames.push(frame);
        if (frame.type === 'ai-audio') {
          clearTimeout(timer);
          ws.close();
          resolve();
        }
      });
      ws.on('error', reject);
    });

    const types = frames.map((f) => f.type);
    expect(types).toContain('ready');
    expect(types).toContain('transcript');
    expect(types).toContain('pronunciation');
    expect(types).toContain('ai-token');
    expect(types).toContain('ai-done');
    expect(types).toContain('ai-audio');

    const transcript = frames.find((f) => f.type === 'transcript');
    expect(transcript.text).toBe('yesterday I go to the airport');
    const tokens = frames
      .filter((f) => f.type === 'ai-token')
      .map((f) => f.delta)
      .join('');
    expect(tokens).toBe('Hello there');
    const audio = frames.find((f) => f.type === 'ai-audio');
    expect(audio.url).toContain('lingua-audio');

    expect(fakeDialog.streamTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        userText: 'yesterday I go to the airport',
        scenario: 'interview',
      }),
      expect.any(Function),
    );
  });

  it('rejects the handshake when the token is invalid', async () => {
    const url = `ws://127.0.0.1:${port}/realtime/speaking?token=bad`;
    const ws = new WebSocket(url);

    const opened = await new Promise<boolean>((resolve) => {
      ws.on('open', () => {
        ws.close();
        resolve(true);
      });
      ws.on('error', () => resolve(false));
      ws.on('unexpected-response', () => resolve(false));
    });

    expect(opened).toBe(false);
  });
});
