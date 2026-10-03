import type { EvidenceItem, ReportStatement } from './models';

export interface ValidationIssue {
  kind: 'uncited_number' | 'unknown_evidence' | 'advice' | 'causality';
  statement: string;
  detail: string;
}

const PERIOD_TOKENS = [
  /\b\d{4}-\d{2}-\d{2}\b/g,
  /\bFY\s?\d{4}\b/gi,
  /\b\d{4}\s?Q[1-4]\b/gi,
  /\bQ[1-4]\s?\d{4}\b/gi,
  /\b(19|20)\d{2}\b/g,
];

/**
 * Extracts numeric literals with their written sign, ignoring period/year tokens. Supports
 * "1,234.5" formatting and the typographic minus (U+2212) the UI uses for negative figures.
 */
export function extractNumbers(text: string): { raw: string; value: number; decimals: number }[] {
  let cleaned = text;
  for (const re of PERIOD_TOKENS) cleaned = cleaned.replace(re, ' ');
  const out: { raw: string; value: number; decimals: number }[] = [];
  for (const m of cleaned.matchAll(/[-−]?\d{1,3}(?:,\d{3})+(?:\.\d+)?|[-−]?\d+(?:\.\d+)?/g)) {
    const raw = m[0];
    const normalized = raw.replace(/,/g, '').replace(/−/g, '-');
    const decimals = normalized.includes('.') ? normalized.split('.')[1]!.length : 0;
    out.push({ raw, value: Number(normalized), decimals });
  }
  return out;
}

/**
 * Words that let prose describe a negative value with an unsigned figure ("net income fell 5.8%"
 * for -5.8). Without one of these, a positive figure may only match a positive value, so an
 * interpretation cannot turn a decline into growth.
 */
const DECLINE_CUES =
  /\b(fell|fall|fallen|falling|declin\w*|decreas\w*|drop\w*|down|lower|below|contract\w*|shrank|shrunk|shrink\w*|negative|loss|losses|minus|deteriorat\w*|turun|menurun|penurunan|berkurang|lebih rendah|di bawah)\b/i;

function matchesEvidence(
  n: { value: number; decimals: number },
  values: number[],
  declineAllowed: boolean,
): boolean {
  const tolerance = 0.5 * 10 ** -n.decimals + 1e-9;
  return values.some((v) => {
    if (Math.abs(v - n.value) <= tolerance) return true;
    if (compactMatch(n.value, v, false)) return true;
    // An unsigned figure may stand for a negative value only when the sentence says it is a decline.
    if (declineAllowed && n.value > 0 && v < 0) {
      return Math.abs(-v - n.value) <= tolerance || compactMatch(n.value, v, true);
    }
    return false;
  });
}

/** Allows compact display units: "12.3 trillion" / "12.3T" for 12_300_000_000_000. */
function compactMatch(shown: number, actual: number, ignoreSign: boolean): boolean {
  if (!ignoreSign && (actual < 0) !== (shown < 0)) return false;
  for (const scale of [1e3, 1e6, 1e9, 1e12]) {
    const scaled = Math.abs(actual) / scale;
    if (scaled >= 1 && scaled < 1000 && Math.abs(scaled - Math.abs(shown)) <= 0.05) return true;
  }
  return false;
}

/**
 * Numeric reconciliation (PRD FR-012 / NFR-002): every number in a statement must equal a value
 * of an EvidenceItem that statement cites.
 */
export function validateStatement(
  statement: ReportStatement,
  evidenceById: Map<string, EvidenceItem>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const cited: EvidenceItem[] = [];
  for (const id of statement.evidenceIds) {
    const e = evidenceById.get(id);
    if (!e) issues.push({ kind: 'unknown_evidence', statement: statement.text, detail: id });
    else cited.push(e);
  }
  const values = cited.flatMap((e) => (e.value === null ? [] : [e.value]));
  const declineAllowed = DECLINE_CUES.test(statement.text);
  for (const n of extractNumbers(statement.text)) {
    if (!matchesEvidence(n, values, declineAllowed)) {
      issues.push({ kind: 'uncited_number', statement: statement.text, detail: n.raw });
    }
  }
  return [...issues, ...guardLanguage(statement.text)];
}

/**
 * Advice, recommendation and forward-looking language (PRD 20.1). Counterpoint reports what the
 * evidence says; it never frames a holding as appealing, nor predicts where a price goes.
 * Applied to every piece of model-written text that reaches the reader.
 */
const ADVICE_PATTERNS: RegExp[] = [
  /\b(buy|sell|hold)\b(?![- ]side)/i,
  /\btarget price\b/i,
  /\bprice target\b/i,
  /\bexpected return\b/i,
  /\bshould (invest|buy|sell|accumulate)\b/i,
  /\b(accumulate|accumulating|undervalued gem|best stock)\b/i,
  // Framing evidence as an investment case rather than as evidence.
  /\b(attractive|attractively|unattractive)\b/i,
  /\b(opportunity|opportunities)\b/i,
  /\b(outperform|outperforms|outperforming|underperform|underperforming)\b/i,
  /\b(bargain|cheap for a reason|value play|re-?rating)\b/i,
  // Predicting direction.
  /\bwill (rise|fall|climb|drop|increase|decrease|go (up|down)|continue to (rise|fall|grow))\b/i,
  /\b(is|are) (expected|likely|set) to (rise|fall|grow|decline|outperform)\b/i,
  /\b(upside|downside) (potential|risk)\b/i,
  // Indonesian equivalents.
  /\b(beli|jual|tahan|akumulasi|akumulasikan|harga target|target harga|rekomendasi|rekomendasikan)\b/i,
  /\b(menarik|tidak menarik|peluang|prospek(nya)? bagus|layak (beli|dikoleksi|investasi)|koleksi)\b/i,
  /\b(akan (naik|turun|menguat|melemah)|bakal (naik|turun)|potensi (naik|turun|cuan)|cuan)\b/i,
];

const CAUSAL_PATTERNS: RegExp[] = [/\bbecause of\b/i, /\bdue to\b/i, /\bcaused by\b/i, /\bdriven by\b/i, /\bkarena\b/i];

/** Advice and causality guard (PRD 20.1, 13.2). */
export function guardLanguage(text: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const re of ADVICE_PATTERNS) {
    const m = re.exec(text);
    if (m) issues.push({ kind: 'advice', statement: text, detail: m[0] });
  }
  for (const re of CAUSAL_PATTERNS) {
    const m = re.exec(text);
    if (m) issues.push({ kind: 'causality', statement: text, detail: m[0] });
  }
  return issues;
}
