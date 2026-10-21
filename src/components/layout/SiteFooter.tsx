import Link from 'next/link';
import { COMPANY, FEES } from '@/lib/config/company';
import { money } from '@/lib/format';
import { Wordmark } from './Logo';

const COLUMNS: { title: string; links: [string, string][] }[] = [
  {
    title: 'Shop',
    links: [
      ['/catalog', 'All parts'],
      ['/catalog/gpu', 'Graphics cards'],
      ['/catalog/cpu', 'Processors'],
      ['/syndicate', 'Prebuilt PCs'],
      ['/deals', 'Deals']
    ]
  },
  {
    title: 'Services',
    links: [
      ['/forge', 'PC Builder'],
      ['/telemetry', 'Track an order'],
      ['/support', 'Returns & RMA'],
      ['/support#faq', 'FAQ']
    ]
  }
];

export function SiteFooter() {
  const f = COMPANY.flagship;
  return (
    <footer className="mt-20 border-t border-hairline bg-chassis">
      <div className="container-hud grid gap-10 py-12 md:grid-cols-12">
        <div className="md:col-span-4">
          <Wordmark />
          <p className="mt-4 max-w-sm text-sm text-secondary">
            Custom gaming PCs built and stress-tested in Austin, Texas — plus the parts to build your own.
          </p>
          <p className="mt-4 text-sm text-secondary">{COMPANY.hours.label}</p>
        </div>

        {COLUMNS.map((c) => (
          <div key={c.title} className="md:col-span-2">
            <p className="mb-3 text-sm font-semibold text-primary">{c.title}</p>
            <ul className="space-y-2 text-sm">
              {c.links.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="text-secondary hover:text-volt">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="md:col-span-4">
          <p className="mb-3 text-sm font-semibold text-primary">Contact</p>
          <ul className="space-y-3 text-sm text-secondary">
            <li>
              <span className="block text-xs text-muted">{COMPANY.contacts.support.label}</span>
              <a className="hover:text-volt" href={`mailto:${COMPANY.contacts.support.email}`}>
                {COMPANY.contacts.support.email}
              </a>{' '}
              ·{' '}
              <a className="hover:text-volt" href={`tel:${COMPANY.contacts.support.tel}`}>
                {COMPANY.contacts.support.phone}
              </a>
            </li>
            <li>
              <span className="block text-xs text-muted">{COMPANY.contacts.syndicate.label}</span>
              <a className="hover:text-volt" href={`mailto:${COMPANY.contacts.syndicate.email}`}>
                {COMPANY.contacts.syndicate.email}
              </a>{' '}
              ·{' '}
              <a className="hover:text-volt" href={`tel:${COMPANY.contacts.syndicate.tel}`}>
                {COMPANY.contacts.syndicate.phone}
              </a>
            </li>
            <li>
              <address className="not-italic">
                {f.street}, {f.city}, {f.region} {f.postalCode}
              </address>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-hairline">
        <div className="container-hud flex flex-col gap-1 py-5 text-xs text-muted md:flex-row md:items-center md:justify-between">
          <span>
            © {new Date().getFullYear()} {COMPANY.legalName} · EIN {COMPANY.ein}
          </span>
          <span>Professional assembly {money(FEES.PRO_BUILT_ASSEMBLY_CENTS)} — free on prebuilt PCs</span>
        </div>
      </div>
    </footer>
  );
}
