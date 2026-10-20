import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRepo } from '@/lib/repo';
import { evaluateBuildCompatibilityV2, manifestFromParts } from '@/lib/engine/compatibility-engine-v2';
import { FEES } from '@/lib/config/company';
import { CATEGORY_CODE, money } from '@/lib/format';
import { HudCard } from '@/components/hud/HudCard';
import { TierBadge } from '@/components/hud/Badges';
import { ProductImage } from '@/components/hud/ProductImage';
import { PackageActions } from '@/components/product/PackageActions';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const pkg = await getRepo().getPackage(slug);
  return pkg ? { title: pkg.name, description: `${pkg.tagline}. ${pkg.description}` } : { title: 'Not found' };
}

export default async function PackagePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pkg = await getRepo().getPackage(slug);
  if (!pkg) notFound();
  const report = evaluateBuildCompatibilityV2(manifestFromParts(pkg.components.map((c) => ({ part: c, quantity: 1 })), 'PRO_BUILT_FOUNDRY_RIG'));
  const gpu = pkg.components.find((c) => c.category === 'GPU');

  return (
    <div className="container-hud py-10 md:py-14">
      <Link href="/syndicate" className="hud-label hover:text-volt">
        ← All Syndicate Rigs
      </Link>
      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_1.1fr]">
        <div className="flex flex-col gap-6">
          <span className="font-mono text-xs tracking-[0.2em]" style={{ color: pkg.hero_accent_hex }}>
            {pkg.tier.replace(/_/g, ' ')}
          </span>
          <h1 className="hud-title text-5xl md:text-7xl">{pkg.name}</h1>
          <p className="text-lg text-primary">{pkg.tagline}</p>
          <p className="leading-relaxed text-secondary">{pkg.description}</p>
          <div className="hud-panel chamfer flex flex-col gap-4 p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="hud-label">Component total</p>
                <p className="tabular text-4xl font-bold">{money(pkg.parts_total_cents)}</p>
                <p className="mt-1 font-mono text-xs text-volt">+ {money(0)} Foundry assembly (save {money(FEES.PRO_BUILT_ASSEMBLY_CENTS)})</p>
              </div>
              <TierBadge tier={report.overallConfidence} />
            </div>
            <p className="font-mono text-xs text-secondary">{pkg.target_fps_note}</p>
            <PackageActions slug={pkg.slug} name={pkg.name} components={pkg.components} inStock={pkg.in_stock} />
          </div>
          <div className="grid grid-cols-3 gap-px border border-hairline bg-hairline">
            {[
              ['Base draw', `${report.estimatedBaseWattage} W`],
              ['Peak transient', `${report.estimatedPeakTransientWattage} W`],
              ['PSU target', `${report.recommendedPsuWattage} W`]
            ].map(([l, v]) => (
              <div key={l} className="bg-chassis p-4">
                <p className="hud-label">{l}</p>
                <p className="tabular mt-1 text-lg text-cryo">{v}</p>
              </div>
            ))}
          </div>
          {report.autoInjectedLogisticsItems.length ? (
            <ul className="space-y-2">
              {report.autoInjectedLogisticsItems.map((i) => (
                <li key={i.code} className="border-l-2 border-cryo bg-chassis px-4 py-3 text-sm">
                  <span className="font-mono text-xs text-cryo">{i.code}</span>
                  <p className="text-primary">{i.name}</p>
                  <p className="text-xs text-secondary">{i.reason}</p>
                </li>
              ))}
            </ul>
          ) : null}
          {gpu && gpu.weight_grams >= FEES.GPU_FOAM_BRACE_THRESHOLD_GRAMS ? (
            <p className="font-mono text-xs text-muted">GPU mass {gpu.weight_grams.toLocaleString()} g ≥ {FEES.GPU_FOAM_BRACE_THRESHOLD_GRAMS} g → Instapak Quick RT foam brace molded in transit.</p>
          ) : null}
        </div>

        <section aria-label="Bill of materials">
          <h2 className="hud-eyebrow mb-4">Bill of Materials</h2>
          <ul className="flex flex-col gap-3">
            {pkg.components.map((c) => (
              <li key={c.id}>
                <HudCard innerClassName="flex items-center gap-4 p-3">
                  <div className="relative h-16 w-20 shrink-0 bg-void">
                    <ProductImage src={c.primary_image_url} alt="" sizes="80px" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="hud-label">
                      {CATEGORY_CODE[c.category]} · BIN #{c.warehouse_bin}
                    </p>
                    <Link href={`/product/${c.slug}`} className="block truncate text-sm text-primary hover:text-volt">
                      {c.name}
                    </Link>
                  </div>
                  <span className="tabular text-sm">{money(c.sale_price_cents ?? c.base_price_cents)}</span>
                </HudCard>
              </li>
            ))}
          </ul>
          {report.issues.length ? (
            <div className="mt-6">
              <h3 className="hud-eyebrow mb-3">Engine Notes</h3>
              <ul className="space-y-2">
                {report.issues.map((i) => (
                  <li key={i.code} className={`tier-${i.tier} border-l-2 tier-border bg-chassis px-4 py-3`}>
                    <p className="tier-text font-mono text-[0.65rem] tracking-[0.12em]">{i.code}</p>
                    <p className="text-sm text-primary">{i.title}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
