import type { Metadata } from 'next';
import Link from 'next/link';
import { COMPANY, FEES } from '@/lib/config/company';
import { money } from '@/lib/format';
import { HudCard, SectionHeader } from '@/components/hud/HudCard';

export const metadata: Metadata = {
  title: 'Support, RMA & Foundry Contact',
  description: `Technical support, RMA and B2B contact for ${COMPANY.legalName} — ${COMPANY.flagship.street}, ${COMPANY.flagship.city}, ${COMPANY.flagship.region}.`
};

const FAQ: [string, string][] = [
  [
    'What does the Compatibility Engine actually check?',
    'Socket and chipset, DDR generation, minimum BIOS revision vs. the board’s shipped BIOS (and whether it has a flashback button), GPU length and radiator thickness vs. chassis clearance, air-cooler overhang vs. RAM heatspreader height, and PSU wattage vs. estimated GPU/CPU transient spikes.'
  ],
  [
    'What is a TIGHT_TOLERANCE build?',
    'A build that fits within 0–3 mm on some axis, or uses a known-good edge case. It is allowed, but a Foundry technician performs a manual fit verification at the bench before closing the panel.'
  ],
  [
    'When does a DIY kit ship the same day?',
    `Orders placed Monday–Saturday before 16:00 CST dispatch the same day from the nearest hub. If you add the ${money(FEES.DIY_BIOS_PREFLASH_CENTS)} BIOS pre-flash, the board is flashed and socket pins inspected before it leaves.`
  ],
  [
    'Why was a $15 BIOS flash added automatically?',
    'Your CPU needs a newer BIOS than the motherboard ships with, and that board has no USB BIOS Flashback button — it would not POST out of the box. We flash it before dispatch so it boots first time.'
  ],
  [
    'What is the Instapak foam brace?',
    `Any GPU heavier than ${FEES.GPU_FOAM_BRACE_THRESHOLD_GRAMS.toLocaleString()} g gets an Instapak Quick RT expanding-foam brace molded around it inside the chassis, so the PCIe slot never carries the card’s mass in transit. It is included free on Pro-Built rigs.`
  ],
  ['How long is my inventory held at checkout?', `Locking your cart reserves every unit for ${FEES.RESERVATION_TTL_MINUTES} minutes with row-level database locks and freezes your price, including flash-deal pricing.`],
  ['How do I start an RMA?', `Email ${COMPANY.contacts.support.email} with your VL-ORD order number and a short fault description. Pro-Built rigs include the System Blueprint and burn-in data, which speeds up diagnosis.`]
];

export default function SupportPage() {
  const f = COMPANY.flagship;
  const orgLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: COMPANY.legalName,
    url: COMPANY.domain,
    address: { '@type': 'PostalAddress', streetAddress: f.street, addressLocality: f.city, addressRegion: f.region, postalCode: f.postalCode, addressCountry: 'US' },
    contactPoint: [
      { '@type': 'ContactPoint', contactType: 'technical support', email: COMPANY.contacts.support.email, telephone: COMPANY.contacts.support.tel },
      { '@type': 'ContactPoint', contactType: 'sales', email: COMPANY.contacts.syndicate.email, telephone: COMPANY.contacts.syndicate.tel }
    ]
  };
  return (
    <div className="container-hud py-10 md:py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }} />
      <header className="mb-10 flex flex-col gap-3">
        <span className="hud-eyebrow">SUPPORT // COMMS CHANNEL</span>
        <h1 className="hud-title text-4xl md:text-6xl">Support &amp; RMA</h1>
      </header>
      <div className="grid gap-5 md:grid-cols-3">
        {[COMPANY.contacts.support, COMPANY.contacts.syndicate].map((c) => (
          <HudCard key={c.email} innerClassName="flex h-full flex-col gap-3 p-6">
            <span className="hud-eyebrow">{c.label}</span>
            <a href={`mailto:${c.email}`} className="font-mono text-lg text-volt hover:underline">
              {c.email}
            </a>
            <a href={`tel:${c.tel}`} className="tabular font-mono text-secondary hover:text-primary">
              {c.phone}
            </a>
            <p className="mt-auto font-mono text-xs text-muted">{COMPANY.hours.label}</p>
          </HudCard>
        ))}
        <HudCard tone="cryo" innerClassName="flex h-full flex-col gap-2 p-6">
          <span className="hud-eyebrow">{f.label}</span>
          <address className="not-italic text-secondary">
            {COMPANY.legalName}
            <br />
            {f.street}
            <br />
            {f.city}, {f.region} {f.postalCode}
          </address>
          <p className="tabular font-mono text-xs text-muted">{f.coordinates.display}</p>
          <p className="font-mono text-xs text-muted">EIN {COMPANY.ein}</p>
        </HudCard>
      </div>

      <section className="mt-16 grid gap-10 lg:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col gap-4">
          <SectionHeader eyebrow="TRACK AN ORDER" title="Rig Forge Live" />
          <p className="text-secondary">Every order has a live telemetry page with technician logs, burn-in data and carrier tracking.</p>
          <Link href="/telemetry" className="btn-overclock self-start">
            Track an order
          </Link>
        </div>
        <div>
          <h2 className="hud-eyebrow mb-4">Field Manual</h2>
          <div className="flex flex-col gap-2">
            {FAQ.map(([q, a]) => (
              <details key={q} className="hud-panel group p-0">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 font-display text-sm font-semibold tracking-wide uppercase">
                  {q}
                  <span className="font-mono text-volt transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="border-t border-hairline px-4 py-4 text-sm leading-relaxed text-secondary">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
