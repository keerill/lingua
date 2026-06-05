export const LLM_PROVIDER = Symbol('LlmProvider');

export interface LlmTurn {
  systemPrompt: string;
  history: { userText: string; aiText: string }[];
  userText: string;
}

export interface LlmProvider {
  streamReply(turn: LlmTurn): AsyncIterable<string>;
}
