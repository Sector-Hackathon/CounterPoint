import { budgetUse, type ClaimState } from '@/lib/session-state';

export function BudgetMeter({ claim }: { claim: ClaimState }) {
  const u = budgetUse(claim);
  return (
    <p className="small muted" style={{ margin: 0 }}>
      Tool calls {u.toolCalls} of 8 · Changes of course {u.replans} of 2 · Counter-checks {u.counterpoints} of 3
    </p>
  );
}
