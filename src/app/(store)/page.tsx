import Image from 'next/image';
import Link from 'next/link';
import { getRepo } from '@/lib/repo';
import { COMPANY, FEES } from '@/lib/config/company';
import { STAGES } from '@/lib/engine/build-bay';
import { CATEGORY_LABEL, CATEGORY_SLUG, money } from '@/lib/format';
import { SectionHeader } from '@/components/hud/HudCard';
import { PackageCard } from '@/components/product/PackageCard';
import { FlashDealBoard } from '@/components/deals/FlashDealBoard';
import { CheckIcon, ChevronRight, ClockIcon, ShieldIcon, TruckIcon, WrenchIcon } from '@/components/ui/Icons';

export const dynamic = 'force-dynamic';

const CATEGORY_TILES = [
  ['GPU', '/media/cat-gpu.webp'],
  ['CPU', '/media/cat-cpu.webp'],
  ['MOTHERBOARD', '/media/cat-motherboard.webp'],
  ['RAM', '/media/cat-ram.webp'],
  ['STORAGE', '/media/cat-storage.webp'],
  ['CPU_COOLER', '/media/cat-cooler.webp'],
  ['CASE', '/media/cat-case.webp'],
  ['PSU', '/media/cat-psu.webp']
] as const;

const BUILD_STEPS = ['BENCH_ASSEMBLY_IN_PROGRESS', 'BIOS_FLASH_AND_EXPO_TUNING', 'OCCT_THERMAL_BURN_IN_4HR', 'INSTAPAK_FOAM_CRATING'] as const;

export default async function HomePage() {
  const repo = getRepo();
  const [packages, deals] = await Promise.all([repo.listPackages(), repo.listFlashDeals()]);

  return (
    <>
      {/* HERO */}
      <section className="bg-gradient-to-b from-[#f1f5ff] to-white">
        <div className="container-hud grid items-center gap-10 py-12 md:py-16 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            <span className="hud-eyebrow">Built and tested in Austin, Texas</span>
            <h1 className="hud-title text-4xl md:text-5xl">Custom gaming PCs, built right the first time.</h1>
            <p className="max-w-lg text-lg text-secondary">
              Pick a ready-made PC or choose your own parts. Every build is checked for compatibility, assembled by a technician and stress-tested for 4 hours before it ships.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/syndicate" className="btn-overclock">
                Shop prebuilt PCs
              </Link>
              <Link href="/forge" className="btn-ghost">
                Build your own
              </Link>
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm text-secondary">
              {['Free insured shipping', 'Free assembly on prebuilt PCs', 'Every PC stress-tested'].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <CheckIcon size={16} className="text-verified" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-chassis shadow-[0_20px_50px_-20px_rgba(16,24,40,0.35)]">
            <Image src="/media/hero-rig.webp" alt="A custom gaming PC with RGB lighting on a desk" fill priority sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <section className="border-y border-hairline bg-white">
        <ul className="container-hud grid grid-cols-2 gap-6 py-6 md:grid-cols-4">
          {[
            [TruckIcon, 'Free shipping', `Parts ship same day before ${FEES.DIY_SAME_DAY_CUTOFF_HOUR - 12} PM CST`],
            [ShieldIcon, 'Compatibility checked', 'We flag parts that won’t fit or work together'],
            [WrenchIcon, 'Expert assembly', `${money(FEES.PRO_BUILT_ASSEMBLY_CENTS)} — free on prebuilt PCs`],
            [ClockIcon, 'Real support', `${COMPANY.hours.days.replace('–', ' – ')}, 9 AM – 9 PM CST`]
          ].map(([Icon, title, sub]) => {
            const I = Icon as typeof TruckIcon;
            return (
              <li key={title as string} className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#eff6ff] text-volt">
                  <I size={20} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-primary">{title as string}</p>
                  <p className="text-[0.8125rem] text-secondary">{sub as string}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* CATEGORIES */}
      <section className="container-hud py-14">
        <div className="flex items-end justify-between gap-4">
          <SectionHeader title="Shop by category" />
          <Link href="/catalog" className="mb-6 flex items-center gap-1 text-sm font-medium text-volt hover:underline">
            All parts <ChevronRight size={16} />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {CATEGORY_TILES.map(([c, img]) => (
            <Link key={c} href={`/catalog/${CATEGORY_SLUG[c]}`} className="group flex flex-col items-center gap-3 rounded-[14px] border border-hairline bg-white p-4 transition hover:border-[#d1d5db] hover:shadow-[0_6px_20px_-6px_rgba(16,24,40,0.12)]">
              <div className="relative aspect-square w-full">
                <Image src={img} alt="" fill sizes="(max-width: 640px) 45vw, 22vw" className="object-contain p-2 transition-transform duration-300 group-hover:scale-105" />
              </div>
              <span className="text-sm font-semibold text-primary">{CATEGORY_LABEL[c]}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* PREBUILT */}
      <section className="bg-chassis py-14">
        <div className="container-hud">
          <div className="flex items-end justify-between gap-4">
            <SectionHeader title="Prebuilt gaming PCs">Tested combinations, ready to build. Assembly and the 4-hour stress test are included free.</SectionHeader>
            <Link href="/syndicate" className="mb-6 hidden items-center gap-1 text-sm font-medium text-volt hover:underline sm:flex">
              View all <ChevronRight size={16} />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {packages.map((p) => (
              <PackageCard key={p.id} pkg={p} />
            ))}
          </div>
        </div>
      </section>

      {/* DEALS */}
      {deals.length ? (
        <section className="container-hud py-14">
          <div className="flex items-end justify-between gap-4">
            <SectionHeader title="Today’s deals">Limited quantities at these prices.</SectionHeader>
            <Link href="/deals" className="mb-6 flex items-center gap-1 text-sm font-medium text-volt hover:underline">
              All deals <ChevronRight size={16} />
            </Link>
          </div>
          <FlashDealBoard initial={deals} limit={3} />
        </section>
      ) : null}

      {/* TWO WAYS TO BUY */}
      <section className="container-hud py-14">
        <SectionHeader title="Two ways to buy" />
        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-[14px] border border-hairline bg-white p-7">
            <h3 className="text-xl font-semibold">Parts only</h3>
            <p className="text-secondary">Factory-sealed parts shipped to you. We still check your cart for compatibility before it ships.</p>
            <ul className="space-y-1.5 text-sm text-secondary">
              <li className="flex gap-2">
                <CheckIcon size={18} className="shrink-0 text-verified" /> Same-day shipping before {FEES.DIY_SAME_DAY_CUTOFF_HOUR - 12} PM CST
              </li>
              <li className="flex gap-2">
                <CheckIcon size={18} className="shrink-0 text-verified" /> Optional BIOS update before shipping — {money(FEES.DIY_BIOS_PREFLASH_CENTS)}
              </li>
            </ul>
            <Link href="/catalog" className="btn-ghost mt-auto self-start">
              Shop parts
            </Link>
          </div>
          <div className="flex flex-col gap-3 rounded-[14px] border-2 border-volt bg-white p-7">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-semibold">Built by us</h3>
              <span className="badge badge-volt">Most popular</span>
            </div>
            <p className="text-secondary">
              A technician assembles, cable-manages and stress-tests your PC, then ships it foam-protected. {money(FEES.PRO_BUILT_ASSEMBLY_CENTS)}, free on prebuilt PCs.
            </p>
            <ul className="space-y-1.5 text-sm text-secondary">
              <li className="flex gap-2">
                <CheckIcon size={18} className="shrink-0 text-verified" /> 4-hour stress test with a downloadable report
              </li>
              <li className="flex gap-2">
                <CheckIcon size={18} className="shrink-0 text-verified" /> Follow every build step online
              </li>
            </ul>
            <Link href="/forge" className="btn-overclock mt-auto self-start">
              Start a build
            </Link>
          </div>
        </div>
      </section>

      {/* HOW WE BUILD */}
      <section className="bg-chassis py-14">
        <div className="container-hud grid items-center gap-10 lg:grid-cols-2">
          <div className="relative aspect-[3/2] overflow-hidden rounded-2xl">
            <Image src="/media/foundry-bench.webp" alt="A technician installing a processor on a motherboard" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
          </div>
          <div>
            <SectionHeader title="How we build your PC">You can follow each step live from your order page.</SectionHeader>
            <ol className="space-y-4">
              {BUILD_STEPS.map((s, i) => (
                <li key={s} className="flex gap-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-sm font-semibold text-volt shadow-sm">{i + 1}</span>
                  <div>
                    <p className="font-semibold text-primary">{STAGES[s].label}</p>
                    <p className="text-sm text-secondary">{STAGES[s].customerTelemetry}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link href="/telemetry/VL-ORD-88412" className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-volt hover:underline">
              See an example order <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
