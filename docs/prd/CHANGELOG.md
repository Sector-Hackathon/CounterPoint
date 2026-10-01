# PRD changelog

## v1.1 (2026-10-01)

Supersedes v1.0 where they conflict. Design: `docs/superpowers/specs/2026-10-01-final-week-design.md`.

- Sectors API v2 (v1 was discontinued on 2026-05-11); deployed LLM provider is OpenAI `gpt-4.1-mini`.
- Counterpoint phase added to the evidence contracts (v2): the agent tests the strongest opposing case after the required checks. Per-claim budget is now 8 tool calls and 3 counter-hypotheses.
- "What would change this verdict" conditions in the report.
- Live SSE event stream replaces polling; the planner's predictions and whether they held are recorded.
- 90 s session deadline implemented (NFR-005).
- Screenshot input: a post's screenshot is transcribed and confirmed by the user before checking.
- Preview pages, sign-in and pricing removed (PRD §6 CUT list).
- Historical-context growth check uses annual net income, because bank revenue is inconsistent across Sectors endpoints.
- Dividend comparisons use completed fiscal years only.
