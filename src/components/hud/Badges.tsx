import type { ConfidenceTier } from '@/lib/types';

const TIER_LABEL: Record<ConfidenceTier, string> = {
  VERIFIED_FIT: 'Verified Fit',
  TIGHT_TOLERANCE: 'Tight Tolerance',
  HARD_CONFLICT: 'Hard Conflict'
};

export function TierBadge({ tier, compact = false }: { tier: ConfidenceTier; compact?: boolean }) {
  const cls = tier === 'VERIFIED_FIT' ? 'badge-verified' : tier === 'TIGHT_TOLERANCE' ? 'badge-tolerance' : 'badge-conflict';
  return (
    <span className={`badge ${cls}`}>
      <span className="status-dot" />
      {compact ? tier.replace('_', ' ') : TIER_LABEL[tier]}
    </span>
  );
}

export function StockBadge({ available, bin }: { available: number; bin?: string }) {
  const tone = available === 0 ? 'badge-conflict' : available <= 5 ? 'badge-tolerance' : 'badge-verified';
  const label = available === 0 ? 'Depleted' : available <= 5 ? `${available} left` : `${available} in stock`;
  return (
    <span className={`badge ${tone}`}>
      <span className={`status-dot ${available > 0 && available <= 5 ? 'pulse anim-continuous' : ''}`} />
      {label}
      {bin ? <span className="text-muted">· BIN #{bin}</span> : null}
    </span>
  );
}
