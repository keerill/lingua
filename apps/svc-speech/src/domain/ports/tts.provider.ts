export const TTS_PROVIDER = Symbol('TtsProvider');

export interface TtsProvider {
  synthesize(text: string, voice?: string): Promise<Buffer>;
}
