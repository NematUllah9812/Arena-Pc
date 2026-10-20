import Link from 'next/link';
import { COMPANY, FEES } from '@/lib/config/company';
import { money } from '@/lib/format';
import { VortexMark } from './Logo';
import { SystemToggles } from './SystemToggles';

export function SiteFooter() {
  const f = COMPANY.flagship;
  return (
    <footer className="mt-24 border-t border-hairline bg-chassis">
      <div className="ruler" />
      <div className="container-hud grid gap-10 py-14 md:grid-cols-12">
        <div className="md:col-span-4">
          <div className="flex items-center gap-3">
            <VortexMark size={32} />
            <span className="font-display text-xl font-bold tracking-[0.08em]">VORTEX LABS</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-secondary">
            Hand-assembled, burn-in verified gaming rigs and precision component dispatch from a 75,000 sq ft anti-static foundry in Austin, Texas.
          </p>
          <div className="mt-6">
            <SystemToggles />
          </div>
        </div>

        <div className="md:col-span-3">
          <p className="hud-label mb-3">{f.label}</p>
          <address className="text-sm leading-relaxed text-secondary not-italic">
            {COMPANY.legalName}
            <br />
            {f.street}
            <br />
            {f.city}, {f.region} {f.postalCode}, {f.country}
            <br />
            <span className="font-mono text-xs text-muted">{f.coordinates.display}</span>
          </address>
          <p className="hud-label mt-5 mb-1">Operations</p>
          <p className="font-mono text-xs text-secondary">{COMPANY.hours.label}</p>
        </div>

        <div className="md:col-span-3">
          <p className="hud-label mb-3">Comms Channels</p>
          <ul className="space-y-3 text-sm">
            <li>
              <span className="block text-xs text-muted">{COMPANY.contacts.support.label}</span>
              <a className="font-mono text-secondary hover:text-volt" href={`mailto:${COMPANY.contacts.support.email}`}>
                {COMPANY.contacts.support.email}
              </a>
              <a className="block font-mono text-secondary hover:text-volt" href={`tel:${COMPANY.contacts.support.tel}`}>
                {COMPANY.contacts.support.phone}
              </a>
            </li>
            <li>
              <span className="block text-xs text-muted">{COMPANY.contacts.syndicate.label}</span>
              <a className="font-mono text-secondary hover:text-volt" href={`mailto:${COMPANY.contacts.syndicate.email}`}>
                {COMPANY.contacts.syndicate.email}
              </a>
              <a className="block font-mono text-secondary hover:text-volt" href={`tel:${COMPANY.contacts.syndicate.tel}`}>
                {COMPANY.contacts.syndicate.phone}
              </a>
            </li>
          </ul>
        </div>

        <div className="md:col-span-2">
          <p className="hud-label mb-3">Index</p>
          <ul className="space-y-2 font-mono text-xs tracking-[0.12em] uppercase">
            {[
              ['/catalog', 'Catalog'],
              ['/forge', 'Rig Forge'],
              ['/syndicate', 'Syndicate Rigs'],
              ['/deals', 'Flash Deals'],
              ['/telemetry', 'Order Telemetry'],
              ['/support', 'Support & RMA']
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="text-secondary hover:text-volt">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-hairline">
        <div className="container-hud flex flex-col gap-2 py-5 font-mono text-[0.65rem] tracking-[0.1em] text-muted uppercase md:flex-row md:items-center md:justify-between">
          <span>
            © {new Date().getFullYear()} {COMPANY.legalName} · EIN {COMPANY.ein}
          </span>
          <span>
            Mode A same-day dispatch before {FEES.DIY_SAME_DAY_CUTOFF_HOUR}:00 CST · Mode B Pro-Built {money(FEES.PRO_BUILT_ASSEMBLY_CENTS)} flat · Free insured freight
          </span>
        </div>
      </div>
    </footer>
  );
}
