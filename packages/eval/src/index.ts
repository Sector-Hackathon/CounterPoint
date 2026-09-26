import { z } from 'zod';
import { Assessment, ClaimType, StopReason, Verifiability } from '@counterpoint/domain';

export const ClaimCase = z.object({
  id: z.string(),
  split: z.enum(['dev', 'heldout']),
  description: z.string(),
  claim: z.object({
    ticker: z.string().nullable(),
    claimType: ClaimType,
    verifiability: Verifiability,
    normalizedText: z.string(),
  }),
  expected: z.object({
    assessment: Assessment,
    stopReason: StopReason,
    /** Whether the case must (true) or must not (false) take a contradiction-driven replan. */
    replan: z.boolean().optional(),
    maxToolCalls: z.number().int().optional(),
  }),
});
export type ClaimCase = z.infer<typeof ClaimCase>;

export const ThesisCase = z.object({
  id: z.string(),
  split: z.enum(['dev', 'heldout']),
  thesis: z.string(),
  expected: z.object({
    primaryTicker: z.string().nullable(),
    /** Claim types that must appear (multiset not required). */
    claimTypes: z.array(ClaimType),
    /** At least one claim must abstain (verifiability NO). */
    hasAbstention: z.boolean(),
  }),
});
export type ThesisCase = z.infer<typeof ThesisCase>;

export interface ClaimRunResult {
  assessment: Assessment;
  stopReason: StopReason;
  replanned: boolean;
  toolCalls: number;
  toolPath: string[];
  uncitedNumbers: number;
}

export interface CaseScore {
  id: string;
  split: string;
  pass: boolean;
  failures: string[];
}

export function scoreClaimCase(c: ClaimCase, r: ClaimRunResult): CaseScore {
  const failures: string[] = [];
  if (r.assessment !== c.expected.assessment) failures.push(`assessment ${r.assessment} != ${c.expected.assessment}`);
  if (r.stopReason !== c.expected.stopReason) failures.push(`stopReason ${r.stopReason} != ${c.expected.stopReason}`);
  if (c.expected.replan !== undefined && r.replanned !== c.expected.replan) {
    failures.push(`replan ${r.replanned} != ${c.expected.replan}`);
  }
  if (c.expected.maxToolCalls !== undefined && r.toolCalls > c.expected.maxToolCalls) {
    failures.push(`toolCalls ${r.toolCalls} > ${c.expected.maxToolCalls}`);
  }
  if (r.uncitedNumbers > 0) failures.push(`${r.uncitedNumbers} report numbers without evidence`);
  return { id: c.id, split: c.split, pass: failures.length === 0, failures };
}

export interface ThesisRunResult {
  primaryTicker: string | null;
  claimTypes: ClaimType[];
  abstained: boolean;
}

export function scoreThesisCase(c: ThesisCase, r: ThesisRunResult): CaseScore {
  const failures: string[] = [];
  if (r.primaryTicker !== c.expected.primaryTicker) failures.push(`primary ${r.primaryTicker} != ${c.expected.primaryTicker}`);
  for (const t of c.expected.claimTypes) if (!r.claimTypes.includes(t)) failures.push(`missing claim type ${t}`);
  if (c.expected.hasAbstention && !r.abstained) failures.push('expected an abstaining claim');
  return { id: c.id, split: c.split, pass: failures.length === 0, failures };
}

export function summarize(scores: CaseScore[]): string {
  const bySplit = new Map<string, CaseScore[]>();
  for (const s of scores) bySplit.set(s.split, [...(bySplit.get(s.split) ?? []), s]);
  const lines = [...bySplit].map(([split, ss]) => `${split}: ${ss.filter((s) => s.pass).length}/${ss.length} passed`);
  for (const s of scores.filter((x) => !x.pass)) lines.push(`  FAIL ${s.id}: ${s.failures.join('; ')}`);
  return lines.join('\n');
}
