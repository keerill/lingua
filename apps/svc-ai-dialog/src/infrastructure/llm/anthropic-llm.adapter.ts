import Anthropic from '@anthropic-ai/sdk';
import { LlmProvider, LlmTurn } from '../../domain/ports/llm.provider';

export class AnthropicLlmAdapter implements LlmProvider {
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async *streamReply(turn: LlmTurn): AsyncIterable<string> {
    const messages: Anthropic.MessageParam[] = [];
    for (const t of turn.history) {
      messages.push({ role: 'user', content: t.userText });
      messages.push({ role: 'assistant', content: t.aiText });
    }
    messages.push({ role: 'user', content: turn.userText });

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: 512,
      system: turn.systemPrompt,
      messages,
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text;
      }
    }
  }
}
