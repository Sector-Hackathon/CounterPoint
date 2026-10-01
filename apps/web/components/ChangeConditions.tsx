import type { ChangeCondition } from '@/lib/api';
import { conditionText } from '@/lib/format';

export function ChangeConditions({ items, onOpen }: { items: ChangeCondition[]; onOpen: (evidenceId: string) => void }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>What would change this verdict</h3>
      <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
        {items.map((c) => (
          <li key={c.checkId}>
            {conditionText(c)}{' '}
            <button className="quiet small" style={{ padding: '2px 8px' }} onClick={() => onOpen(c.evidenceId)}>Show source</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
