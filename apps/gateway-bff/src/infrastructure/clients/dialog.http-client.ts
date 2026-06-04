import { Injectable } from '@nestjs/common';
import type { Readable } from 'node:stream';
import axios, { AxiosInstance } from 'axios';
import {
  DialogPort,
  DialogTurnRequest,
  ScenarioInfo,
} from '../../application/ports/dialog.port';

@Injectable()
export class DialogHttpClient implements DialogPort {
  private readonly http: AxiosInstance = axios.create({
    baseURL: process.env.SVC_AI_DIALOG_URL ?? 'http://localhost:3104',
    timeout: 60_000,
  });

  async listScenarios(): Promise<ScenarioInfo[]> {
    const { data } = await this.http.get<ScenarioInfo[]>('/scenarios');
    return data;
  }

  async streamTurn(
    req: DialogTurnRequest,
    onToken: (token: string) => void,
  ): Promise<string> {
    const res = await this.http.post('/dialog/turn', req, {
      responseType: 'stream',
    });
    const stream = res.data as Readable;
    let full = '';
    for await (const chunk of stream) {
      const text = chunk.toString('utf8');
      full += text;
      onToken(text);
    }
    return full;
  }
}
