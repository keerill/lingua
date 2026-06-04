import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import { AuthUser, KEYCLOAK_VERIFIER, KeycloakJwtVerifier } from '@lingua/auth';
import { startActiveRootSpan } from '@lingua/observability';
import {
  RealtimeFrame,
  RunSpeakingTurnUseCase,
} from '../../application/run-speaking-turn.usecase';

const WS_PATH = '/realtime/speaking';

interface SpeakingSession {
  user: AuthUser;
  scenario: string;
  sessionId: string;
  busy: boolean;
}

@Injectable()
export class RealtimeGateway
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(RealtimeGateway.name);
  private wss: WebSocketServer | null = null;
  private upgradeHandler:
    | ((req: IncomingMessage, socket: Duplex, head: Buffer) => void)
    | null = null;

  constructor(
    @Inject(KEYCLOAK_VERIFIER) private readonly verifier: KeycloakJwtVerifier,
    private readonly runTurn: RunSpeakingTurnUseCase,
    private readonly httpAdapterHost: HttpAdapterHost,
  ) {}

  onApplicationBootstrap(): void {
    const server = this.httpAdapterHost.httpAdapter.getHttpServer() as Server;
    this.wss = new WebSocketServer({ noServer: true });

    this.upgradeHandler = (req, socket, head) => {
      if (!this.matchesPath(req.url)) return;

      void this.authenticate(req)
        .then((user) => {
          this.wss!.handleUpgrade(req, socket, head, (ws) =>
            this.onConnection(ws, user),
          );
        })
        .catch(() => {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
        });
    };

    server.on('upgrade', this.upgradeHandler);
    this.logger.log(`realtime websocket listening on ${WS_PATH}`);
  }

  onModuleDestroy(): void {
    if (this.upgradeHandler) {
      const server = this.httpAdapterHost.httpAdapter?.getHttpServer() as
        | Server
        | undefined;
      server?.off('upgrade', this.upgradeHandler);
      this.upgradeHandler = null;
    }
    this.wss?.close();
    this.wss = null;
  }

  private matchesPath(url: string | undefined): boolean {
    return !!url && new URL(url, 'http://localhost').pathname === WS_PATH;
  }

  private async authenticate(req: IncomingMessage): Promise<AuthUser> {
    const url = new URL(req.url ?? '', 'http://localhost');
    const fromQuery = url.searchParams.get('token');
    const proto = req.headers['sec-websocket-protocol'];
    const fromProto = Array.isArray(proto)
      ? proto[0]
      : proto?.split(',').pop()?.trim();
    const token = fromQuery ?? fromProto;
    if (!token) throw new Error('missing token');
    return this.verifier.verify(token);
  }

  private onConnection(ws: WebSocket, user: AuthUser): void {
    const session: SpeakingSession = {
      user,
      scenario: 'small_talk',
      sessionId: `${user.sub}:${Date.now()}`,
      busy: false,
    };
    const send = (frame: RealtimeFrame) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(frame));
    };
    ws.send(JSON.stringify({ type: 'ready', sessionId: session.sessionId }));

    ws.on('message', (data: Buffer, isBinary: boolean) => {
      if (isBinary) {
        void this.handleUtterance(ws, session, data, send);
      } else {
        this.handleControl(session, data.toString('utf8'), send);
      }
    });

    ws.on('error', (err) => this.logger.warn(`ws error: ${String(err)}`));
  }

  private handleControl(
    session: SpeakingSession,
    raw: string,
    send: (frame: RealtimeFrame) => void,
  ): void {
    try {
      const msg = JSON.parse(raw) as {
        type?: string;
        scenario?: string;
        sessionId?: string;
      };
      if (msg.type === 'start') {
        if (msg.scenario) session.scenario = msg.scenario;
        if (msg.sessionId) session.sessionId = msg.sessionId;
      }
    } catch {
      send({ type: 'error', message: 'invalid control frame' });
    }
  }

  private async handleUtterance(
    ws: WebSocket,
    session: SpeakingSession,
    audio: Buffer,
    send: (frame: RealtimeFrame) => void,
  ): Promise<void> {
    if (session.busy) {
      send({
        type: 'error',
        message: 'still processing the previous utterance',
      });
      return;
    }
    session.busy = true;
    try {
      await startActiveRootSpan(
        'speaking.turn',
        () =>
          this.runTurn.execute(
            {
              userId: session.user.sub,
              sessionId: session.sessionId,
              scenario: session.scenario,
              audio,
              mime: 'audio/webm',
            },
            send,
          ),
        {
          'lingua.scenario': session.scenario,
          'lingua.session_id': session.sessionId,
          'enduser.id': session.user.sub,
        },
      );
    } catch (err) {
      this.logger.error('speaking turn failed', err as Error);
      send({ type: 'error', message: 'speaking turn failed' });
    } finally {
      session.busy = false;
    }
  }
}
