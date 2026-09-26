import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod/v4';

export type Effort = 'low' | 'medium' | 'high';

/**
 * Structured-output wrapper. Every call is schema-validated; one bounded retry on invalid output,
 * then a truthful failure (PRD 20.2).
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly client: Anthropic | null;
  readonly model = process.env.LLM_MODEL || 'claude-opus-5';

  constructor() {
    this.client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
  }

  get available(): boolean {
    return this.client !== null;
  }

  async parse<T extends z.ZodType>(
    schema: T,
    opts: { system: string; user: string; effort?: Effort; maxTokens?: number; label: string },
  ): Promise<z.infer<T>> {
    if (!this.client) throw new Error('LLM is not configured (ANTHROPIC_API_KEY unset)');
    let lastError = 'unknown';
    for (let attempt = 1; attempt <= 2; attempt++) {
      const started = Date.now();
      try {
        const res = await this.client.messages.parse({
          model: this.model,
          max_tokens: opts.maxTokens ?? 8000,
          system: opts.system,
          messages: [{ role: 'user', content: opts.user }],
          output_config: { format: zodOutputFormat(schema), effort: opts.effort ?? 'medium' },
        });
        this.logger.log(
          JSON.stringify({ event: 'llm_call', label: opts.label, attempt, stop: res.stop_reason, ms: Date.now() - started, usage: res.usage }),
        );
        if (res.stop_reason === 'refusal') {
          lastError = 'model declined the request';
          continue;
        }
        if (res.parsed_output != null) return res.parsed_output as z.infer<T>;
        lastError = `no parsed output (stop_reason=${res.stop_reason})`;
      } catch (err) {
        if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.BadRequestError) throw err;
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
    throw new Error(`${opts.label}: structured output failed after retry: ${lastError}`);
  }
}
