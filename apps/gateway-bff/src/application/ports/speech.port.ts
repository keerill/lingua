export const SPEECH_PORT = Symbol('SpeechPort');

export interface WordScore {
  word: string;
  score: number;
}

export interface PronunciationResult {
  score: number;
  words: WordScore[];
}

export interface SttResult {
  transcript: string;
  confidence: number;
  pronunciation: PronunciationResult;
}

export interface TtsResult {
  url: string;
  objectKey: string;
  mime: string;
}

export interface SpeechPort {
  transcribe(audio: Buffer, mime: string): Promise<SttResult>;
  synthesize(text: string): Promise<TtsResult>;
}
