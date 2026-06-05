export type ServerFrame =
  | { type: 'ready'; sessionId: string }
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

export type SocketStatus = 'connecting' | 'open' | 'closed';

export class SpeakingSocket {
  private ws: WebSocket | null = null;

  constructor(
    private readonly url: string,
    private readonly onFrame: (frame: ServerFrame) => void,
    private readonly onStatus: (status: SocketStatus) => void,
  ) {}

  connect(): void {
    this.onStatus('connecting');
    const ws = new WebSocket(this.url);
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => this.onStatus('open');
    ws.onclose = () => this.onStatus('closed');
    ws.onmessage = (e) => {
      try {
        this.onFrame(JSON.parse(String(e.data)) as ServerFrame);
      } catch {}
    };
    this.ws = ws;
  }

  start(scenario: string, sessionId: string): void {
    this.send(JSON.stringify({ type: 'start', scenario, sessionId }));
  }

  sendAudio(blob: Blob): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(blob);
  }

  private send(text: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(text);
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }
}
