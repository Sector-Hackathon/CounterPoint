import { Injectable } from '@nestjs/common';
import { SUPPORTED_CLAIM_TYPES, contractForClaimType, type ClaimType, type Verifiability } from '@counterpoint/domain';
import { LlmService } from '../llm/llm.service';
import { EXTRACTION_SYSTEM, ExtractionSchema, extractionUser, type Extraction } from '../llm/prompts';

export interface ExtractionResult {
  extraction: Extraction;
  extractor: string;
}

const SCOPE_NOTES: Partial<Record<ClaimType, string>> = {
  FORWARD_LOOKING: 'Forward-looking claims about prices, returns, or future outcomes are outside available evidence.',
  UNSUPPORTED: 'This kind of claim cannot be tested with Sectors company and market data.',
  RELATIVE_GROWTH: 'Peer-relative growth is not yet supported in this version.',
};

@Injectable()
export class ClaimsService {
  constructor(private readonly llm: LlmService) {}

  async extract(thesis: string): Promise<ExtractionResult> {
    if (this.llm.available) {
      const extraction = await this.llm.parse(ExtractionSchema, {
        system: EXTRACTION_SYSTEM,
        user: extractionUser(thesis),
        label: 'claim_extraction',
      });
      return { extraction, extractor: `llm:${this.llm.model}` };
    }
    return { extraction: heuristicExtract(thesis), extractor: 'heuristic-v1' };
  }

  /** Maps an extracted claim to its versioned evidence contract, or an explicit scope state. */
  toContract(type: ClaimType, verifiability: Verifiability, scopeNote: string | null) {
    const supported = SUPPORTED_CLAIM_TYPES.includes(type);
    const contract = supported ? contractForClaimType(type) : null;
    return {
      contractId: contract && verifiability !== 'NO' ? contract.id : null,
      verifiability: supported ? verifiability : ('NO' as const),
      scopeNote: supported ? scopeNote : (scopeNote ?? SCOPE_NOTES[type] ?? null),
    };
  }
}

const RULES: { type: ClaimType; comparison: 'ABSOLUTE' | 'HISTORICAL' | 'PEER'; re: RegExp }[] = [
  { type: 'FORWARD_LOOKING', comparison: 'ABSOLUTE', re: /\b(akan|bakal|target|will|going to|to the moon|naik ke|potensi naik)\b/i },
  { type: 'RELATIVE_VALUATION', comparison: 'PEER', re: /\b(valuasi|valuation|murah|cheap|mahal|expensive|undervalued|per|pbv|p\/e|p\/bv)\b/i },
  { type: 'DIVIDEND_LEVEL', comparison: 'HISTORICAL', re: /\b(dividen|dividend|yield)\b/i },
  { type: 'ABSOLUTE_GROWTH', comparison: 'HISTORICAL', re: /\b(growth|tumbuh|pertumbuhan|bertumbuh|laba naik|revenue naik|earnings)\b/i },
];

/**
 * Offline fallback used only when no LLM is configured. It is labelled `heuristic-v1` in the
 * session so its output is never presented as model-based extraction.
 */
export function heuristicExtract(thesis: string): Extraction {
  const segments = thesis
    .split(/(?:,|;|\.|\bdan\b|\band\b|\bkarena\b|\bbecause\b|\bserta\b)/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);

  const claims: Extraction['claims'] = [];
  for (const seg of segments) {
    const rule = RULES.find((r) => r.re.test(seg));
    if (!rule) continue;
    const verifiable = rule.type !== 'FORWARD_LOOKING';
    claims.push({
      original_text: seg,
      normalized_text: seg,
      entity_mention: null,
      claim_type: rule.type,
      comparison_type: rule.comparison,
      time_scope: null,
      verifiability: verifiable ? 'YES' : 'NO',
      scope_note: verifiable ? null : SCOPE_NOTES.FORWARD_LOOKING!,
    });
  }
  if (claims.length === 0) {
    claims.push({
      original_text: thesis,
      normalized_text: thesis,
      entity_mention: null,
      claim_type: 'UNSUPPORTED',
      comparison_type: 'ABSOLUTE',
      time_scope: null,
      verifiability: 'NO',
      scope_note: SCOPE_NOTES.UNSUPPORTED!,
    });
  }
  return { entities: [], claims };
}
