import { Transcript } from '../value-objects';

export const STT_PROVIDER = Symbol('SttProvider');

export interface SttProvider {
  transcribe(audio: Buffer, mime: string): Promise<Transcript>;
}
