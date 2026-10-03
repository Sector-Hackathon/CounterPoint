import { describe, expect, it } from 'vitest';
import {
  CHECK_RULES,
  CONTRACTS,
  type CheckOutcome,
  type Comparator,
  type DecisionRule,
  type EvidenceContract,
  type Thresholds,
  phaseOf,
  purposeFor,
  questionFor,
  ruleTextFor,
} from '../src/index';

const allChecks = () =>
  Object.values(CONTRACTS).flatMap((c: EvidenceContract) => c.checks.map((check) => ({ contract: c, check })));

/** Independent implementation of the declared comparators, so agreement with evaluate() is a real check. */
function outcomeFromBands(rule: DecisionRule, value: number, t: Thresholds): CheckOutcome {
  const holds: Record<Comparator, (v: number, x: number) => boolean> = {
    at_least: (v, x) => v >= x,
    above: (v, x) => v > x,
    at_most: (v, x) => v <= x,
    below: (v, x) => v < x,
  };
  for (const b of rule.bands ?? []) {
    if (holds[b.comparator](value, b.threshold(t))) return b.outcome;
  }
  return 'neutral';
}

describe('check presentation', () => {
  it('gives every check in every contract a question and a purpose', () => {
    for (const { check } of allChecks()) {
      expect(questionFor(check), check.id).toBeTruthy();
      // The question must read as prose, never as an internal id.
      expect(questionFor(check), check.id).not.toMatch(/_/);
      expect(purposeFor(check), check.id).toBeTruthy();
    }
  });

  it('states a decision rule for every check', () => {
    for (const { contract, check } of allChecks()) {
      expect(ruleTextFor(check, contract.thresholds), `${contract.id}/${check.id}`).toBeTruthy();
    }
  });

  it('never shows an internal check id in a rule', () => {
    for (const { contract, check } of allChecks()) {
      expect(ruleTextFor(check, contract.thresholds), check.id).not.toMatch(/_/);
    }
  });

  /**
   * The rule shown to the reader must be the rule actually applied. For every single-metric
   * banded rule, probe each threshold and its neighbourhood and compare against evaluate().
   */
  it('declared bands agree with the contract evaluate() at every boundary', () => {
    let probed = 0;
    for (const { contract, check } of allChecks()) {
      const rule = CHECK_RULES[check.id];
      if (!rule?.bands?.length) continue;
      expect(check.metrics, `${check.id} needs exactly one metric for a banded rule`).toHaveLength(1);
      const metric = check.metrics[0]!;
      const t = contract.thresholds;

      const edges = rule.bands.map((b) => b.threshold(t));
      const values = [...new Set(edges.flatMap((e) => [e - 1, e - 0.01, e, e + 0.01, e + 1]))];
      for (const v of [...values, 0, 1, -1, 1000, -1000]) {
        const actual = check.evaluate({ [metric]: v }, t);
        expect(actual.ok, `${check.id} at ${v}`).toBe(true);
        if (!actual.ok) continue;
        expect(outcomeFromBands(rule, v, t), `${contract.id}/${check.id} at ${v}`).toBe(actual.value);
        probed++;
      }
    }
    // Guards against the loop silently skipping everything.
    expect(probed).toBeGreaterThan(200);
  });

  it('formats bands with their unit and effect', () => {
    const growth = CONTRACTS['absolute-growth-v2']!;
    const revenue = growth.checks.find((c) => c.id === 'revenue_growth')!;
    expect(ruleTextFor(revenue, growth.thresholds)).toBe(
      '≥10% supports the claim · <0% weakens the claim',
    );
    const margin = growth.checks.find((c) => c.id === 'margin_deterioration')!;
    expect(ruleTextFor(margin, growth.thresholds)).toBe('≤-2 pp weakens the claim');

    const valuation = CONTRACTS['relative-valuation-v3']!;
    const baseline = valuation.checks.find((c) => c.id === 'peer_baseline')!;
    expect(ruleTextFor(baseline, valuation.thresholds)).toBe(
      '≤-10% supports the claim · >0% weakens the claim',
    );
  });

  it('describes a counter-hypothesis by its own hypothesis text', () => {
    const valuation = CONTRACTS['relative-valuation-v3']!;
    const roe = valuation.checks.find((c) => c.id === 'roe_vs_peers')!;
    expect(phaseOf(roe)).toBe('counterpoint');
    expect(questionFor(roe)).toBe(roe.hypothesis);
    expect(purposeFor(roe)).toBe('Testing the strongest case against the claim');
  });
});
