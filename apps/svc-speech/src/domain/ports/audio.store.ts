export const AUDIO_STORE = Symbol('AudioStore');

export interface StoredAudio {
  objectKey: string;
  url: string;
}

export interface AudioStore {
  putWav(data: Buffer, keyHint?: string): Promise<StoredAudio>;
}
