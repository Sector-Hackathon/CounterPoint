import type { ChangeCondition, ClaimReport, EvidenceSummary, StepEvent } from './api';
import { isHeadlineMetric } from './format';
import type { ClaimState } from './session-state';

type Outcome = StepEvent['outcome'];

export interface Scale { min: number; max: number; valuePct: number; thresholdPct: number }
export interface MetricTile {
  checkId: string;
  question: string | null;
  rule: string | null;
  metric: string;
  value: number | null;
  unit: string;
  period: string | null;
  comparisonPeriod: string | null;
  evidenceId: string;
  outcome: Outcome;
  /** Present only when the report gives a contract threshold for this check. */
  scale: Scale | null;
  threshold: number | null;
}
export interface CounterItem {
  checkId: string;
  question: string;
  /** yes = the counter-case is confirmed by the data. */
  answer: 'yes' | 'no' | 'untested' | 'pending';
  metric: EvidenceSummary | null;
  note: string | null;
}
export interface TimelinePoint { id: string; kind: 'check' | 'counter' | 'replan'; outcome: Outcome; label: string | null }
export interface ClaimAnalytics {
  metrics: MetricTile[];
  counter: CounterItem[];
  timeline: TimelinePoint[];
  change: ChangeCondition | null;
  tally: { supports: number; weakens: number; neutral: number };
}

/** The check's own derived number: a known headline metric, else the last measured value. */
const headline = (evidence: EvidenceSummary[]) =>
  [...evidence].reverse().find((e) => isHeadlineMetric(e.metric)) ??
  [...evidence].reverse().find((e) => e.value !== null) ??
  null;

/** Value and threshold on one axis that always includes zero, padded so markers never touch the edge. */
export function scaleOf(value: number | null, threshold: number | null): Scale | null {
  if (value === null || threshold === null) return null;
  let min = Math.min(0, value, threshold);
  let max = Math.max(0, value, threshold);
  const pad = (max - min || 1) * 0.12;
  min -= pad;
  max += pad;
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  return { min, max, valuePct: pct(value), thresholdPct: pct(threshold) };
}

/**
 * Claim analytics view model. Built from the claim's steps so it fills in live, then enriched
 * by the report (counterpoint statuses, thresholds, the decisive change condition).
 */
export function buildClaimAnalytics(claim: ClaimState, report?: ClaimReport | null): ClaimAnalytics {
  const toolSteps = claim.steps.filter((s) => s.action.startsWith('get_') && s.checkId);
  const conditions = report?.changeConditions ?? [];

  const metricsById = new Map<string, MetricTile>();
  for (const s of toolSteps) {
    if (s.phase === 'counterpoint') continue;
    const e = headline(s.evidence);
    if (!e) continue;
    const cond = conditions.find((c) => c.checkId === s.checkId && c.threshold !== null && c.current !== null);
    metricsById.set(s.checkId!, {
      checkId: s.checkId!, question: s.question, rule: s.rule, metric: e.metric, value: e.value, unit: e.unit,
      period: e.economicPeriod, comparisonPeriod: e.comparisonPeriod, evidenceId: e.id, outcome: s.outcome,
      scale: cond ? scaleOf(e.value, cond.threshold) : null, threshold: cond?.threshold ?? null,
    });
  }

  const liveCounter = new Map<string, CounterItem>();
  for (const s of toolSteps.filter((x) => x.phase === 'counterpoint')) {
    liveCounter.set(s.checkId!, {
      checkId: s.checkId!, question: s.question ?? s.checkId!, metric: headline(s.evidence),
      answer: s.outcome === 'weakens' ? 'yes' : s.outcome ? 'no' : 'untested', note: s.evidence.find((e) => e.status !== 'VALID')?.note ?? null,
    });
  }
  const counter: CounterItem[] = report?.counterpoint
    ? report.counterpoint.hypotheses.map((h) => ({
        checkId: h.checkId,
        question: h.hypothesis,
        answer: h.status === 'confirmed' ? 'yes' : h.status === 'refuted' ? 'no' : h.status === 'not_tested' ? 'pending' : 'untested',
        metric: liveCounter.get(h.checkId)?.metric ?? null,
        note: h.note,
      }))
    : [...liveCounter.values()];

  const timeline: TimelinePoint[] = claim.steps
    .filter((s) => (s.action.startsWith('get_') && s.checkId) || s.action === 'REPLAN')
    .map((s) => ({ id: s.id, kind: s.action === 'REPLAN' ? 'replan' : s.phase === 'counterpoint' ? 'counter' : 'check', outcome: s.outcome, label: s.question }));

  const change = conditions.find((c) => c.wouldBecome !== null) ?? conditions.find((c) => c.effect !== 'missing_evidence') ?? conditions[0] ?? null;

  const tally = { supports: 0, weakens: 0, neutral: 0 };
  for (const s of toolSteps) if (s.outcome) tally[s.outcome]++;

  return { metrics: [...metricsById.values()], counter, timeline, change, tally };
}
