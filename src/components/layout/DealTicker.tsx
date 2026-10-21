import Link from 'next/link';
import { COMPANY, FEES } from '@/lib/config/company';

/** Slim, static announcement bar (replaces the old scrolling ticker). */
export function DealTicker() {
  return (
    <div className="border-b border-hairline bg-chassis text-[0.8125rem] text-secondary">
      <div className="container-hud flex h-9 items-center justify-between gap-4">
        <p className="truncate">
          Free insured shipping on every order · Parts ship same day when ordered before {FEES.DIY_SAME_DAY_CUTOFF_HOUR - 12} PM CST
        </p>
        <div className="hidden shrink-0 items-center gap-5 md:flex">
          <Link href="/deals" className="font-medium text-tungsten hover:underline">
            Today&rsquo;s deals
          </Link>
          <a href={`tel:${COMPANY.contacts.support.tel}`} className="hover:text-primary">
            {COMPANY.contacts.support.phone}
          </a>
        </div>
      </div>
    </div>
  );
}
