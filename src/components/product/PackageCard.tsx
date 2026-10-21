import Image from 'next/image';
import Link from 'next/link';
import type { SyndicatePackageResolved } from '@/lib/types';
import { money } from '@/lib/format';

export const PACKAGE_TIER_LABEL: Record<string, string> = {
  ESPORTS_1080P: '1080p Gaming',
  COMPETITIVE_1440P: '1440p Gaming',
  APEX_4K: '4K Gaming',
  WORKSTATION_AI: 'Workstation & AI',
  EXTREME_CUSTOM_LOOP: 'Custom Water Cooling'
};

export function PackageCard({ pkg }: { pkg: SyndicatePackageResolved }) {
  const cpu = pkg.components.find((c) => c.category === 'CPU');
  const gpu = pkg.components.find((c) => c.category === 'GPU');
  const ram = pkg.components.find((c) => c.category === 'RAM');
  const storage = pkg.components.find((c) => c.category === 'STORAGE');
  const caseImg = pkg.components.find((c) => c.category === 'CASE')?.primary_image_url ?? '/media/prebuilt-rig.webp';
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[14px] border border-hairline bg-white transition hover:border-[#d1d5db] hover:shadow-[0_6px_20px_-6px_rgba(16,24,40,0.12)]">
      <Link href={`/syndicate/${pkg.slug}`} className="flex h-full flex-col">
        <div className="relative aspect-[4/3] bg-white">
          <Image src={caseImg} alt="" fill sizes="(max-width: 768px) 100vw, 25vw" className="object-contain p-6 transition-transform duration-300 group-hover:scale-[1.03]" />
          <span className="badge badge-volt absolute top-3 left-3">{PACKAGE_TIER_LABEL[pkg.tier] ?? pkg.tier}</span>
        </div>
        <div className="flex flex-1 flex-col gap-3 border-t border-hairline p-5">
          <div>
            <h3 className="text-lg font-semibold text-primary group-hover:text-volt">{pkg.name}</h3>
            <p className="mt-0.5 text-sm text-secondary">{pkg.tagline}</p>
          </div>
          <ul className="space-y-1 text-[0.8125rem] text-secondary">
            {[cpu, gpu, ram, storage].filter(Boolean).map((c) => (
              <li key={c!.id} className="truncate">
                {c!.name}
              </li>
            ))}
          </ul>
          <div className="mt-auto flex items-end justify-between gap-3 pt-2">
            <div>
              <p className="tabular text-xl font-bold text-primary">{money(pkg.parts_total_cents)}</p>
              <p className="text-xs text-verified">Free assembly &amp; stress test</p>
            </div>
            <span className={`badge ${pkg.in_stock ? 'badge-verified' : 'badge-tolerance'}`}>{pkg.in_stock ? 'Ready to build' : 'Backorder'}</span>
          </div>
        </div>
      </Link>
    </article>
  );
}
