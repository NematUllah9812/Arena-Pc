import type { ConfidenceTier } from '@/lib/types';

export const TIER_LABEL: Record<ConfidenceTier, string> = {
  VERIFIED_FIT: 'Compatible',
  TIGHT_TOLERANCE: 'Tight fit — we check it',
  HARD_CONFLICT: 'Not compatible'
};

export function TierBadge({ tier, compact = false }: { tier: ConfidenceTier; compact?: boolean }) {
  const cls = tier === 'VERIFIED_FIT' ? 'badge-verified' : tier === 'TIGHT_TOLERANCE' ? 'badge-tolerance' : 'badge-conflict';
  const label = compact ? { VERIFIED_FIT: 'Compatible', TIGHT_TOLERANCE: 'Tight fit', HARD_CONFLICT: 'Conflict' }[tier] : TIER_LABEL[tier];
  return (
    <span className={`badge ${cls}`}>
      <span className="status-dot" />
      {label}
    </span>
  );
}

export function StockBadge({ available }: { available: number; bin?: string }) {
  if (available === 0)
    return (
      <span className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-conflict">
        <span className="status-dot" /> Out of stock
      </span>
    );
  if (available <= 5)
    return (
      <span className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-tolerance">
        <span className="status-dot" /> Only {available} left
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-verified">
      <span className="status-dot" /> In stock
    </span>
  );
}
