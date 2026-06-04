import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import {
  SpeechPort,
  SttResult,
  TtsResult,
} from '../../application/ports/speech.port';

@Injectable()
export class SpeechHttpClient implements SpeechPort {
  private readonly http: AxiosInstance = axios.create({
    baseURL: process.env.SVC_SPEECH_URL ?? 'http://localhost:3105',
    timeout: 30_000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  async transcribe(audio: Buffer, mime: string): Promise<SttResult> {
    const form = new FormData();
    const ext = mime.includes('wav')
      ? 'wav'
      : mime.includes('ogg')
        ? 'ogg'
        : 'webm';
    form.append(
      'audio',
      new Blob([new Uint8Array(audio)], { type: mime }),
      `utterance.${ext}`,
    );
    const { data } = await this.http.post<SttResult>('/stt', form);
    return data;
  }

  async synthesize(text: string): Promise<TtsResult> {
    const { data } = await this.http.post<TtsResult>('/tts', { text });
    return data;
  }
}
