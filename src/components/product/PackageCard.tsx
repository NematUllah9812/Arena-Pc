import Link from 'next/link';
import type { SyndicatePackageResolved } from '@/lib/types';
import { money } from '@/lib/format';
import { HudCard } from '@/components/hud/HudCard';

const TIER_LABEL: Record<string, string> = {
  ESPORTS_1080P: '1080P ESPORTS',
  COMPETITIVE_1440P: '1440P COMPETITIVE',
  APEX_4K: '4K APEX',
  WORKSTATION_AI: 'WORKSTATION / AI',
  EXTREME_CUSTOM_LOOP: 'EXTREME CUSTOM LOOP'
};

export function PackageCard({ pkg }: { pkg: SyndicatePackageResolved }) {
  const cpu = pkg.components.find((c) => c.category === 'CPU');
  const gpu = pkg.components.find((c) => c.category === 'GPU');
  return (
    <HudCard as="article" interactive innerClassName="flex h-full flex-col">
      <Link href={`/syndicate/${pkg.slug}`} className="relative z-[1] flex h-full flex-col p-6">
        <div className="mb-6 flex items-start justify-between">
          <span className="font-mono text-[0.65rem] tracking-[0.2em]" style={{ color: pkg.hero_accent_hex }}>
            {TIER_LABEL[pkg.tier]}
          </span>
          <span className="h-2 w-10" style={{ background: pkg.hero_accent_hex }} />
        </div>
        <h3 className="hud-title text-3xl">{pkg.name}</h3>
        <p className="mt-1 text-sm text-secondary">{pkg.tagline}</p>
        <dl className="my-6 space-y-2 border-y border-hairline py-4 font-mono text-xs">
          {[
            ['CPU', cpu?.name],
            ['GPU', gpu?.name],
            ['TARGET', pkg.target_fps_note]
          ].map(([k, v]) => (
            <div key={k} className="flex gap-3">
              <dt className="w-14 shrink-0 text-muted">{k}</dt>
              <dd className="text-secondary">{v ?? '—'}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-auto flex items-end justify-between">
          <div>
            <p className="hud-label">Turnkey · Assembly waived</p>
            <p className="tabular text-2xl font-bold">{money(pkg.parts_total_cents)}</p>
          </div>
          <span className={`badge ${pkg.in_stock ? 'badge-verified' : 'badge-tolerance'}`}>{pkg.in_stock ? 'Bay Ready' : 'Backorder'}</span>
        </div>
      </Link>
    </HudCard>
  );
}
