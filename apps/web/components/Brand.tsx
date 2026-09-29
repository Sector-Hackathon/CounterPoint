import Link from 'next/link';
import { Scale } from 'lucide-react';

export function Brand({ href = '/', className = 'brand' }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={className} aria-label="Counterpoint home">
      <span className="brand-mark" aria-hidden="true">
        <Scale size={18} strokeWidth={2.2} />
      </span>
      Counterpoint
    </Link>
  );
}
