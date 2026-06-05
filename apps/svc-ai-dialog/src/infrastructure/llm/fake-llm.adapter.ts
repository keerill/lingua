import { LlmProvider, LlmTurn } from '../../domain/ports/llm.provider';

export class FakeLlmAdapter implements LlmProvider {
  async *streamReply(turn: LlmTurn): AsyncIterable<string> {
    const snippet = turn.userText
      .split(/\s+/)
      .slice(0, 6)
      .join(' ')
      .replace(/[.!?]+$/, '');
    const reply =
      `Thanks for telling me about "${snippet}". ` +
      `That's a good start! Could you say a little more about it?`;
    for (const word of reply.split(' ')) {
      yield word + ' ';
    }
  }
}
