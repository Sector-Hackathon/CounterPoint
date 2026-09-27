import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { z } from 'zod/v4';

export type Effort = 'low' | 'medium' | 'high';
type Provider = 'anthropic' | 'openai';

interface ParseOptions {
  system: string;
  user: string;
  effort?: Effort;
  maxTokens?: number;
  label: string;
}

type Attempt<T> = { ok: true; value: T } | { ok: false; reason: string };

/**
 * Structured-output wrapper over the configured provider (LLM_PROVIDER). Every call is
 * schema-validated; one bounded retry on invalid output, then a truthful failure (PRD 20.2).
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly provider: Provider;
  private readonly modelId: string;
  private readonly anthropic: Anthropic | null = null;
  private readonly openai: OpenAI | null = null;

  constructor() {
    const configured = process.env.LLM_PROVIDER?.toLowerCase();
    this.provider = configured === 'openai' || configured === 'anthropic'
      ? configured
      : process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY ? 'openai' : 'anthropic';

    if (this.provider === 'openai') {
      this.modelId = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
      if (process.env.OPENAI_API_KEY) this.openai = new OpenAI();
    } else {
      this.modelId = process.env.ANTHROPIC_MODEL || process.env.LLM_MODEL || 'claude-opus-5';
      if (process.env.ANTHROPIC_API_KEY) this.anthropic = new Anthropic();
    }
  }

  get available(): boolean {
    return this.anthropic !== null || this.openai !== null;
  }

  /** Provider-qualified model id, persisted with reports for reproducibility. */
  get model(): string {
    return `${this.provider}/${this.modelId}`;
  }

  async parse<T extends z.ZodType>(schema: T, opts: ParseOptions): Promise<z.infer<T>> {
    if (!this.available) throw new Error(`LLM is not configured (${this.provider} API key unset)`);
    let lastError = 'unknown';
    for (let attempt = 1; attempt <= 2; attempt++) {
      const started = Date.now();
      try {
        const result = this.openai
          ? await this.parseOpenAI(this.openai, schema, opts)
          : await this.parseAnthropic(this.anthropic!, schema, opts);
        this.logger.log(
          JSON.stringify({ event: 'llm_call', model: this.model, label: opts.label, attempt, ok: result.ok, ms: Date.now() - started }),
        );
        if (result.ok) return result.value;
        lastError = result.reason;
      } catch (err) {
        if (
          err instanceof Anthropic.AuthenticationError ||
          err instanceof Anthropic.BadRequestError ||
          err instanceof OpenAI.AuthenticationError ||
          err instanceof OpenAI.BadRequestError
        ) {
          throw err;
        }
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
    throw new Error(`${opts.label}: structured output failed after retry: ${lastError}`);
  }

  private async parseAnthropic<T extends z.ZodType>(client: Anthropic, schema: T, opts: ParseOptions): Promise<Attempt<z.infer<T>>> {
    const res = await client.messages.parse({
      model: this.modelId,
      max_tokens: opts.maxTokens ?? 8000,
      system: opts.system,
      messages: [{ role: 'user', content: opts.user }],
      output_config: { format: zodOutputFormat(schema), effort: opts.effort ?? 'medium' },
    });
    if (res.stop_reason === 'refusal') return { ok: false, reason: 'model declined the request' };
    if (res.parsed_output != null) return { ok: true, value: res.parsed_output as z.infer<T> };
    return { ok: false, reason: `no parsed output (stop_reason=${res.stop_reason})` };
  }

  private async parseOpenAI<T extends z.ZodType>(client: OpenAI, schema: T, opts: ParseOptions): Promise<Attempt<z.infer<T>>> {
    const res = await client.chat.completions.parse({
      model: this.modelId,
      max_completion_tokens: opts.maxTokens ?? 8000,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
      response_format: zodResponseFormat(schema, opts.label),
    });
    const choice = res.choices[0];
    if (choice?.message.refusal) return { ok: false, reason: `model declined: ${choice.message.refusal}` };
    if (choice?.message.parsed != null) return { ok: true, value: choice.message.parsed as z.infer<T> };
    return { ok: false, reason: `no parsed output (finish_reason=${choice?.finish_reason ?? 'none'})` };
  }
}
