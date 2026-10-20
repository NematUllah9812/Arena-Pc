import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRepo } from '@/lib/repo';
import { evaluateBuildCompatibilityV2, manifestFromParts } from '@/lib/engine/compatibility-engine-v2';
import { FEES } from '@/lib/config/company';
import { CATEGORY_LABEL, money } from '@/lib/format';
import { TierBadge } from '@/components/hud/Badges';
import { ProductImage } from '@/components/hud/ProductImage';
import { PackageActions } from '@/components/product/PackageActions';
import { PACKAGE_TIER_LABEL } from '@/components/product/PackageCard';
import { CheckIcon } from '@/components/ui/Icons';

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
  const caseImg = pkg.components.find((c) => c.category === 'CASE')?.primary_image_url ?? '/media/prebuilt-rig.webp';

  return (
    <div className="container-hud py-8 md:py-10">
      <nav className="mb-6 text-sm text-muted" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-volt">
          Home
        </Link>{' '}
        /{' '}
        <Link href="/syndicate" className="hover:text-volt">
          Prebuilt PCs
        </Link>{' '}
        / <span className="text-secondary">{pkg.name}</span>
      </nav>
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-2xl border border-hairline bg-white">
          <Image src={caseImg} alt={pkg.name} fill priority sizes="(max-width: 1024px) 100vw, 50vw" className="object-contain p-10" />
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <span className="badge badge-volt">{PACKAGE_TIER_LABEL[pkg.tier] ?? pkg.tier}</span>
            <h1 className="hud-title mt-3 text-3xl md:text-4xl">{pkg.name}</h1>
            <p className="mt-2 text-lg text-secondary">{pkg.tagline}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="tabular text-3xl font-bold">{money(pkg.parts_total_cents)}</p>
            <TierBadge tier={report.overallConfidence} />
          </div>
          <ul className="space-y-1.5 text-sm text-secondary">
            <li className="flex gap-2">
              <CheckIcon size={18} className="shrink-0 text-verified" /> Free professional assembly (save {money(FEES.PRO_BUILT_ASSEMBLY_CENTS)})
            </li>
            <li className="flex gap-2">
              <CheckIcon size={18} className="shrink-0 text-verified" /> 4-hour stress test with report
            </li>
            <li className="flex gap-2">
              <CheckIcon size={18} className="shrink-0 text-verified" /> {pkg.target_fps_note}
            </li>
            <li className="flex gap-2">
              <CheckIcon size={18} className="shrink-0 text-verified" /> Recommended power supply: {report.recommendedPsuWattage} W
            </li>
          </ul>
          <div className="rounded-xl border border-hairline p-5">
            <PackageActions slug={pkg.slug} name={pkg.name} components={pkg.components} inStock={pkg.in_stock} />
          </div>
          <p className="leading-relaxed text-secondary">{pkg.description}</p>
        </div>
      </div>

      <section aria-labelledby="parts-h" className="mt-12">
        <h2 id="parts-h" className="mb-4 text-xl font-semibold">
          What&rsquo;s inside
        </h2>
        <ul className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-white">
          {pkg.components.map((c) => (
            <li key={c.id} className="flex items-center gap-4 p-3 sm:p-4">
              <div className="relative h-14 w-14 shrink-0">
                <ProductImage src={c.primary_image_url} alt="" sizes="56px" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">{CATEGORY_LABEL[c.category]}</p>
                <Link href={`/product/${c.slug}`} className="block truncate text-sm font-medium text-primary hover:text-volt">
                  {c.name}
                </Link>
              </div>
              <span className="tabular text-sm text-secondary">{money(c.sale_price_cents ?? c.base_price_cents)}</span>
            </li>
          ))}
        </ul>
        {report.autoInjectedLogisticsItems.length ? (
          <ul className="mt-4 space-y-2">
            {report.autoInjectedLogisticsItems.map((i) => (
              <li key={i.code} className="rounded-lg bg-[#f0f9ff] px-4 py-3 text-sm">
                <p className="font-medium text-primary">{i.name}</p>
                <p className="text-secondary">{i.reason}</p>
              </li>
            ))}
          </ul>
        ) : null}
        {report.issues.length ? (
          <ul className="mt-4 space-y-2">
            {report.issues.map((i) => (
              <li key={i.code} className={`tier-${i.tier} rounded-lg border-l-4 tier-border bg-chassis px-4 py-3 text-sm`}>
                <p className="font-medium text-primary">{i.title}</p>
                <p className="text-secondary">{i.remediationSuggestion}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
