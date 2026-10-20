import Image from 'next/image';
import Link from 'next/link';
import { getRepo } from '@/lib/repo';
import { COMPANY, FEES } from '@/lib/config/company';
import { STAGES } from '@/lib/engine/build-bay';
import { CATEGORY_LABEL, CATEGORY_SLUG, money } from '@/lib/format';
import { HudCard, SectionHeader } from '@/components/hud/HudCard';
import { PackageCard } from '@/components/product/PackageCard';
import { FlashDealBoard } from '@/components/deals/FlashDealBoard';
import { SearchButton } from '@/components/search/SearchPalette';

export const dynamic = 'force-dynamic';

const CATEGORY_TILES = [
  ['GPU', '/media/cat-gpu.webp'],
  ['CPU', '/media/cat-cpu.webp'],
  ['MOTHERBOARD', '/media/cat-motherboard.webp'],
  ['RAM', '/media/cat-ram.webp'],
  ['CPU_COOLER', '/media/cat-cooler.webp'],
  ['CASE', '/media/cat-case.webp'],
  ['PSU', '/media/cat-psu.webp'],
  ['STORAGE', '/media/cat-storage.webp']
] as const;

const PIPELINE = ['PARTS_ALLOCATED_BIN_LOCKED', 'BENCH_ASSEMBLY_IN_PROGRESS', 'BIOS_FLASH_AND_EXPO_TUNING', 'OCCT_THERMAL_BURN_IN_4HR', 'INSTAPAK_FOAM_CRATING', 'DISPATCHED_CARRIER'] as const;

export default async function HomePage() {
  const repo = getRepo();
  const [packages, deals] = await Promise.all([repo.listPackages(), repo.listFlashDeals()]);

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-hairline">
        <div className="absolute inset-0">
          <Image src="/media/hero-rig.webp" alt="" fill priority sizes="100vw" className="object-cover object-center opacity-55" />
          <div className="absolute inset-0 bg-gradient-to-r from-void via-void/85 to-void/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-void via-transparent to-void/40" />
        </div>
        <div className="container-hud relative grid min-h-[calc(100svh-var(--header-h)-36px)] content-center gap-10 py-16 md:py-24">
          <div className="flex max-w-3xl flex-col gap-6">
            <span className="hud-eyebrow">
              <span className="status-dot pulse anim-continuous mr-2 text-verified" />
              FOUNDRY ONLINE · AUSTIN US-CENTRAL · {COMPANY.hours.days} {COMPANY.hours.open}–{COMPANY.hours.close} CST
            </span>
            <h1 className="hud-title text-[clamp(2.75rem,8vw,6.5rem)] leading-[0.92]">
              Forged.
              <br />
              Burned-in.
              <br />
              <span className="text-volt">Verified.</span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-secondary">
              Custom gaming rigs engineered to the millimetre. Every build clears a 3-tier compatibility engine, a 4-hour OCCT thermal burn-in and ships with the proof.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/forge" className="btn-overclock">
                Open Rig Forge
              </Link>
              <Link href="/syndicate" className="btn-ghost">
                Syndicate Rigs
              </Link>
              <SearchButton />
            </div>
          </div>
          <dl className="grid max-w-4xl grid-cols-2 gap-px border border-hairline bg-hairline md:grid-cols-4">
            {[
              ['4 HR', 'OCCT + FurMark burn-in'],
              ['±3 MM', 'Clearance tolerance'],
              ['16:00', 'CST same-day DIY cutoff'],
              ['$0', `Assembly on Syndicate rigs`]
            ].map(([v, l]) => (
              <div key={l} className="bg-void/80 p-4 backdrop-blur">
                <dt className="hud-label">{l}</dt>
                <dd className="tabular mt-1 font-display text-2xl font-bold text-volt">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* FULFILLMENT MODES */}
      <section className="container-hud py-20">
        <SectionHeader eyebrow="FULFILLMENT PROTOCOL" title="Two ways to deploy" />
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <HudCard innerClassName="flex h-full flex-col gap-4 p-7">
            <span className="font-mono text-xs tracking-[0.2em] text-cryo">MODE A</span>
            <h3 className="hud-title text-3xl">DIY Component Kit</h3>
            <p className="text-secondary">Loose, factory-sealed components dispatched from the nearest hub. Every manifest still runs through the compatibility engine before it ships.</p>
            <ul className="mt-2 space-y-2 font-mono text-sm text-secondary">
              <li>› Same-day dispatch on orders before 16:00 CST</li>
              <li>› Optional pre-ship BIOS flash &amp; socket pin inspection · {money(FEES.DIY_BIOS_PREFLASH_CENTS)}</li>
              <li>› Mandatory flash auto-added when a board can&rsquo;t boot your CPU and lacks flashback</li>
            </ul>
            <Link href="/catalog" className="btn-ghost mt-auto self-start">
              Shop components
            </Link>
          </HudCard>
          <HudCard tone="selected" innerClassName="flex h-full flex-col gap-4 p-7">
            <span className="font-mono text-xs tracking-[0.2em] text-volt">MODE B</span>
            <h3 className="hud-title text-3xl">Pro-Built Foundry Rig</h3>
            <p className="text-secondary">
              Assembled by a named technician on an anti-static bench, cable-routed, BIOS and EXPO tuned, then stress-tested for 72 hours before crating. {money(FEES.PRO_BUILT_ASSEMBLY_CENTS)} flat —
              waived on every Syndicate package.
            </p>
            <ul className="mt-2 space-y-2 font-mono text-sm text-secondary">
              <li>› 4-hour OCCT + FurMark thermal burn-in with downloadable proof</li>
              <li>› Instapak Quick RT foam brace molded around any GPU over {FEES.GPU_FOAM_BRACE_THRESHOLD_GRAMS.toLocaleString()} g</li>
              <li>› Live 7-stage Build Bay telemetry from bin lock to freight</li>
            </ul>
            <Link href="/forge" className="btn-overclock mt-auto self-start">
              Forge a Pro-Built rig
            </Link>
          </HudCard>
        </div>
      </section>

      {/* SYNDICATE */}
      <section className="border-y border-hairline bg-chassis/40 py-20">
        <div className="container-hud">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeader eyebrow="SYNDICATE PACKAGE OFFERS" title="Turnkey. Validated. Assembly waived." />
            <Link href="/syndicate" className="hud-label hover:text-volt">
              All packages →
            </Link>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {packages.map((p) => (
              <PackageCard key={p.id} pkg={p} />
            ))}
          </div>
        </div>
      </section>

      {/* FLASH DEALS */}
      {deals.length ? (
        <section className="container-hud py-20">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <SectionHeader eyebrow="LIQUIDATION // LIVE" title={<>Flash <span className="text-tungsten">Drops</span></>} />
            <Link href="/deals" className="hud-label hover:text-tungsten">
              All drops →
            </Link>
          </div>
          <FlashDealBoard initial={deals} limit={3} />
        </section>
      ) : null}

      {/* ENGINE */}
      <section className="border-y border-hairline py-20">
        <div className="container-hud grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div className="flex flex-col gap-5">
            <SectionHeader eyebrow="COMPATIBILITY ENGINE V2" title="Three tiers. Zero guesswork." />
            <p className="text-secondary">
              Socket and chipset are table stakes. The engine checks BIOS revision against CPU microcode, GPU length and radiator thickness against chassis clearance, air-cooler overhang against RAM
              heatspreader height, and PSU headroom against GPU transient spikes.
            </p>
            <Link href="/forge" className="btn-ghost self-start">
              Run a build through it
            </Link>
          </div>
          <div className="grid gap-3">
            {[
              ['verified', 'VERIFIED_FIT', '≥ 3 mm clearance buffer on every axis. Socket, memory generation, BIOS and power all clear.'],
              ['tolerance', 'TIGHT_TOLERANCE', 'Within 0–3 mm or a known-good edge case. Allowed — a technician manually verifies the fit at the bench.'],
              ['conflict', 'HARD_CONFLICT', 'Physically or electrically impossible. DDR4 in a DDR5 board, a 44 mm DIMM under a 32 mm overhang. Checkout blocked.']
            ].map(([k, t, d]) => (
              <div key={t} className="hud-panel flex gap-4 p-5">
                <span className={`badge badge-${k} h-fit shrink-0`}>{t.replace('_', ' ')}</span>
                <p className="text-sm text-secondary">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BUILD BAY */}
      <section className="container-hud py-20">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <HudCard innerClassName="relative aspect-[4/3]">
            <Image src="/media/foundry-bench.webp" alt="Technician bench in the Austin Build Bay" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
            <div className="absolute bottom-4 left-4 z-[1] font-mono text-[0.65rem] tracking-[0.18em] text-volt">BAY A-07 · ANTI-STATIC · ISO CLEANROOM</div>
          </HudCard>
          <div className="flex flex-col gap-6">
            <SectionHeader eyebrow="RIG FORGE LIVE" title="Watch it get built." />
            <ol className="flex flex-col">
              {PIPELINE.map((s) => (
                <li key={s} className="flex gap-4 border-b border-hairline py-3 last:border-0">
                  <span className="tabular w-8 font-mono text-sm text-volt">{String(STAGES[s].index).padStart(2, '0')}</span>
                  <div>
                    <p className="font-display text-sm font-semibold tracking-wide uppercase">{STAGES[s].label}</p>
                    <p className="text-xs text-secondary">{STAGES[s].customerTelemetry}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link href="/telemetry/VL-ORD-88412" className="btn-ghost self-start">
              View a live telemetry feed
            </Link>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="border-t border-hairline bg-chassis/40 py-20">
        <div className="container-hud">
          <SectionHeader eyebrow="CATALOG" title="Component arsenal" />
          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
            {CATEGORY_TILES.map(([c, img]) => (
              <Link key={c} href={`/catalog/${CATEGORY_SLUG[c]}`} className="group">
                <HudCard interactive innerClassName="relative aspect-square">
                  <Image src={img} alt="" fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover opacity-70 transition duration-300 group-hover:scale-105 group-hover:opacity-90" />
                  <div className="absolute inset-0 bg-gradient-to-t from-void via-void/30 to-transparent" />
                  <span className="absolute bottom-4 left-4 z-[1] font-display text-lg font-semibold tracking-wide uppercase">{CATEGORY_LABEL[c]}</span>
                </HudCard>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* HUBS */}
      <section className="container-hud py-20">
        <SectionHeader eyebrow="LOGISTICS GRID" title="Three hubs. One foundry." />
        <div className="mt-10 grid gap-px border border-hairline bg-hairline md:grid-cols-3">
          {COMPANY.hubs.map((h) => (
            <div key={h.code} className="bg-chassis p-6">
              <p className="font-mono text-xs tracking-[0.18em] text-volt">{h.code}</p>
              <p className="mt-2 font-display text-xl font-semibold">{h.city}</p>
              <p className="text-sm text-secondary">{h.role}</p>
              <p className="tabular mt-3 font-mono text-xs text-muted">
                {h.areaSqFt.toLocaleString()} sq ft · {h.detail}
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
