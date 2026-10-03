import type { ChangeCondition } from '@/lib/api';
import { conditionText } from '@/lib/format';
import { ASSESSMENT_TEXT } from './Status';

/**
 * What would change the verdict. Each condition was re-run through the deterministic assessment
 * rule, so the ones that would actually move the verdict are separated from the ones that would
 * only strengthen the evidence. Nothing here claims a change it cannot demonstrate.
 */
export function ChangeConditions({ items, onOpen }: { items: ChangeCondition[]; onOpen: (evidenceId: string) => void }) {
  if (!items.length) return null;
  const decisive = items.filter((c) => c.wouldBecome !== null);
  const supporting = items.filter((c) => c.wouldBecome === null);

  const list = (group: ChangeCondition[]) => (
    <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
      {group.map((c) => (
        <li key={c.checkId}>
          {conditionText(c)}
          {c.wouldBecome && (
            <>
              {' '}
              <strong>Verdict would become {ASSESSMENT_TEXT[c.wouldBecome].toLowerCase()}.</strong>
            </>
          )}{' '}
          {c.evidenceId && (
            <button className="quiet small" style={{ padding: '2px 8px' }} onClick={() => onOpen(c.evidenceId!)}>
              Show source
            </button>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>What would change this verdict</h3>
      {decisive.length > 0 && list(decisive)}
      {supporting.length > 0 && (
        <>
          <p className="small muted" style={{ margin: decisive.length ? '12px 0 6px' : '0 0 6px' }}>
            {decisive.length
              ? 'These would strengthen the evidence without changing the verdict on their own:'
              : 'No single change below would alter the verdict. Each would strengthen the evidence:'}
          </p>
          {list(supporting)}
        </>
      )}
    </div>
  );
}
