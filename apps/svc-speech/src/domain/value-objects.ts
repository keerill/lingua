export interface Transcript {
  text: string;
  confidence: number;
}

export interface WordScore {
  word: string;
  score: number;
}

export interface Pronunciation {
  score: number;
  words: WordScore[];
}
