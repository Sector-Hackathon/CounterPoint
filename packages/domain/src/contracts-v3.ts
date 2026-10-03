import type { EvidenceContract } from './contracts';
import { relativeValuationV2 } from './contracts-v2';

/**
 * Counter-hypotheses that explain an observed discount. Asking them only makes sense once the
 * peer baseline has actually found one: "why is it cheap?" is not a question about a company
 * that is not cheap.
 */
const WHY_THE_DISCOUNT = new Set(['roe_vs_peers', 'own_history', 'price_drawdown']);

/**
 * v3: the same checks and thresholds as v2, with the discount counter-hypotheses gated on the
 * peer baseline supporting the claim.
 *
 * - Peer P/E is not below the median → the "cheap" claim already fails on its required evidence,
 *   so the investigation completes instead of spending calls explaining a discount that is not
 *   there (measured: 7 tool calls down to 4, and roughly 10 fewer Sectors requests once the peer
 *   valuations behind them are counted).
 * - Peer P/E is below the median → the discount is real, which raises a new question: is it
 *   justified? The agent then tests lower returns on equity, the company's own P/E history, and
 *   a price fall — any of which weakens the claim that the company is simply cheap.
 *
 * Thresholds are inherited from v2 deliberately: this version changes which questions get asked,
 * not where any line sits. `contracts-v3.test.ts` pins that, so editing v2 cannot silently
 * redefine v3.
 */
export const relativeValuationV3: EvidenceContract = {
  ...relativeValuationV2,
  id: 'relative-valuation-v3',
  checks: relativeValuationV2.checks.map((c) =>
    WHY_THE_DISCOUNT.has(c.id)
      ? { ...c, triggeredBy: [{ check: 'peer_baseline', outcome: 'supports' as const }] }
      : c,
  ),
};
