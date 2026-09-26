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

/** Extracts numeric literals, ignoring period/year tokens. Supports "1,234.5" formatting. */
export function extractNumbers(text: string): { raw: string; value: number; decimals: number }[] {
  let cleaned = text;
  for (const re of PERIOD_TOKENS) cleaned = cleaned.replace(re, ' ');
  const out: { raw: string; value: number; decimals: number }[] = [];
  for (const m of cleaned.matchAll(/-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/g)) {
    const raw = m[0];
    const normalized = raw.replace(/,/g, '');
    const decimals = normalized.includes('.') ? normalized.split('.')[1]!.length : 0;
    out.push({ raw, value: Number(normalized), decimals });
  }
  return out;
}

function matchesEvidence(n: { value: number; decimals: number }, values: number[]): boolean {
  const tolerance = 0.5 * 10 ** -n.decimals + 1e-9;
  return values.some(
    (v) => Math.abs(Math.abs(v) - Math.abs(n.value)) <= tolerance || compactMatch(n.value, v),
  );
}

/** Allows compact display units: "12.3 trillion" / "12.3T" for 12_300_000_000_000. */
function compactMatch(shown: number, actual: number): boolean {
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
  for (const n of extractNumbers(statement.text)) {
    if (!matchesEvidence(n, values)) {
      issues.push({ kind: 'uncited_number', statement: statement.text, detail: n.raw });
    }
  }
  return [...issues, ...guardLanguage(statement.text)];
}

const ADVICE_PATTERNS: RegExp[] = [
  /\b(buy|sell|hold)\b(?![- ]side)/i,
  /\btarget price\b/i,
  /\bprice target\b/i,
  /\bexpected return\b/i,
  /\bshould (invest|buy|sell|accumulate)\b/i,
  /\b(accumulate|undervalued gem|best stock)\b/i,
  /\b(beli|jual|tahan|akumulasi|harga target|target harga|rekomendasi)\b/i,
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
