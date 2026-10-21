import type { Metadata } from 'next';
import Link from 'next/link';
import { COMPANY, FEES } from '@/lib/config/company';
import { money } from '@/lib/format';
import { SectionHeader } from '@/components/hud/HudCard';

export const metadata: Metadata = {
  title: 'Help & support',
  description: `Technical support, RMA and B2B contact for ${COMPANY.legalName} — ${COMPANY.flagship.street}, ${COMPANY.flagship.city}, ${COMPANY.flagship.region}.`
};

const FAQ: [string, string][] = [
  [
    'What does the compatibility check look at?',
    'That the processor fits the motherboard socket, the memory type matches, the motherboard BIOS supports your processor, the graphics card and radiator fit inside the case, the CPU cooler clears the memory, and the power supply can handle peak power draw.'
  ],
  [
    'What does “tight fit” mean?',
    'Some parts fit with only 0–3 mm to spare. The build is allowed, and if we assemble it, a technician checks the fit by hand before closing the case.'
  ],
  [
    'When do parts-only orders ship?',
    `Orders placed Monday–Saturday before 4 PM CST ship the same day from the nearest warehouse. If you add the ${money(FEES.DIY_BIOS_PREFLASH_CENTS)} BIOS update, we update the motherboard and inspect it before it leaves.`
  ],
  [
    `Why was a ${money(FEES.DIY_BIOS_PREFLASH_CENTS)} BIOS update added automatically?`,
    'Your processor needs a newer BIOS than the motherboard ships with, and that board can’t update itself without a working processor. We update it before shipping so your PC starts the first time.'
  ],
  [
    'How do you protect heavy graphics cards in shipping?',
    `Any graphics card heavier than ${FEES.GPU_FOAM_BRACE_THRESHOLD_GRAMS.toLocaleString()} g gets expanding protective foam around it inside the case, so the card’s weight isn’t on the slot during transit. It’s free on PCs we build.`
  ],
  ['How long are items held at checkout?', `When you start checkout we reserve your items for ${FEES.RESERVATION_TTL_MINUTES} minutes and lock in your prices, including deal prices.`],
  ['How do I return or repair something?', `Email ${COMPANY.contacts.support.email} with your order number (VL-ORD-…) and a short description of the problem. PCs we build include a build summary and test results, which helps us sort it out faster.`]
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
    <div className="container-hud py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }} />
      <header className="mb-8">
        <h1 className="hud-title text-3xl md:text-4xl">Help &amp; support</h1>
        <p className="mt-2 text-secondary">We&rsquo;re here {COMPANY.hours.label}.</p>
      </header>
      <div className="grid gap-5 md:grid-cols-3">
        {[COMPANY.contacts.support, COMPANY.contacts.syndicate].map((c) => (
          <div key={c.email} className="hud-card flex h-full flex-col gap-2 p-6">
            <span className="font-semibold">{c.label}</span>
            <a href={`mailto:${c.email}`} className="text-volt hover:underline">
              {c.email}
            </a>
            <a href={`tel:${c.tel}`} className="tabular text-secondary hover:text-primary">
              {c.phone}
            </a>
            <p className="mt-auto pt-2 text-sm text-muted">{COMPANY.hours.label}</p>
          </div>
        ))}
        <div className="hud-card flex h-full flex-col gap-2 p-6">
          <span className="font-semibold">{f.label}</span>
          <address className="not-italic text-secondary">
            {COMPANY.legalName}
            <br />
            {f.street}
            <br />
            {f.city}, {f.region} {f.postalCode}
          </address>
          <p className="text-sm text-muted">EIN {COMPANY.ein}</p>
        </div>
      </div>

      <section className="mt-16 grid gap-10 lg:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col gap-4">
          <SectionHeader title="Track an order" />
          <p className="text-secondary">Every order has its own page showing progress, test results and shipping tracking.</p>
          <Link href="/telemetry" className="btn-overclock self-start">
            Track an order
          </Link>
        </div>
        <div>
          <h2 className="hud-title mb-4 text-2xl">Frequently asked questions</h2>
          <div className="flex flex-col gap-2">
            {FAQ.map(([q, a]) => (
              <details key={q} className="hud-panel group p-0">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 font-medium">
                  {q}
                  <span className="text-xl leading-none text-muted transition-transform group-open:rotate-45">+</span>
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
