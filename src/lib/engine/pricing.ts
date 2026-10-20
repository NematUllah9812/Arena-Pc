import { FEES, SERVICE_CODES } from '@/lib/config/company';
import type { FulfillmentMode, OrderServiceLine } from '@/lib/types';
import type { CompatibilityReportV2 } from './compatibility-engine-v2';

export interface QuoteInput {
  partsSubtotalCents: number;
  fulfillmentMode: FulfillmentMode;
  /** Syndicate Package Offers waive the $149 assembly fee. */
  isSyndicatePackage: boolean;
  /** Customer opted into the optional $15 DIY pre-flash. */
  optInBiosPreflash: boolean;
  report: CompatibilityReportV2 | null;
}

export interface OrderQuote {
  partsSubtotalCents: number;
  assemblyFeeCents: number;
  assemblyFeeWaivedCents: number;
  servicesFeeCents: number;
  totalCents: number;
  services: OrderServiceLine[];
  includesBiosPreflash: boolean;
  includesFoamBrace: boolean;
}

/** Deterministic order quote shared by the cart UI and the checkout server. */
export function quoteOrder(input: QuoteInput): OrderQuote {
  const services: OrderServiceLine[] = [];
  const isPro = input.fulfillmentMode === 'PRO_BUILT_FOUNDRY_RIG';

  let assemblyFeeCents = 0;
  let assemblyFeeWaivedCents = 0;
  if (isPro) {
    if (input.isSyndicatePackage) {
      assemblyFeeWaivedCents = FEES.PRO_BUILT_ASSEMBLY_CENTS;
      services.push({
        code: SERVICE_CODES.PRO_ASSEMBLY,
        name: 'Foundry Assembly, Cable Routing, BIOS/EXPO Tuning & 72h Stress Test',
        price_cents: 0,
        reason: 'Waived — Syndicate Package Offer'
      });
    } else {
      assemblyFeeCents = FEES.PRO_BUILT_ASSEMBLY_CENTS;
      services.push({
        code: SERVICE_CODES.PRO_ASSEMBLY,
        name: 'Foundry Assembly, Cable Routing, BIOS/EXPO Tuning & 72h Stress Test',
        price_cents: FEES.PRO_BUILT_ASSEMBLY_CENTS,
        reason: 'Mode B — Pro-Built Foundry Rig flat fee'
      });
    }
  }

  let servicesFeeCents = 0;
  let includesBiosPreflash = false;
  let includesFoamBrace = false;

  for (const item of input.report?.autoInjectedLogisticsItems ?? []) {
    if (item.code === SERVICE_CODES.BIOS_FLASH_DIY) {
      includesBiosPreflash = true;
      servicesFeeCents += item.priceCents;
      services.push({ code: item.code, name: item.name, price_cents: item.priceCents, reason: item.reason });
    } else if (item.code === SERVICE_CODES.FOAM_BRACE) {
      includesFoamBrace = true;
      services.push({ code: item.code, name: item.name, price_cents: item.priceCents, reason: item.reason });
    }
  }

  if (!isPro && !includesBiosPreflash && input.optInBiosPreflash) {
    includesBiosPreflash = true;
    servicesFeeCents += FEES.DIY_BIOS_PREFLASH_CENTS;
    services.push({
      code: SERVICE_CODES.BIOS_FLASH_DIY,
      name: 'Pre-Ship Motherboard BIOS Flash & Socket Pin Inspection',
      price_cents: FEES.DIY_BIOS_PREFLASH_CENTS,
      reason: 'Optional DIY service selected at checkout'
    });
  }
  if (isPro) includesBiosPreflash = true; // Included free on every Pro-Built rig.

  const totalCents = input.partsSubtotalCents + assemblyFeeCents + servicesFeeCents;
  return {
    partsSubtotalCents: input.partsSubtotalCents,
    assemblyFeeCents,
    assemblyFeeWaivedCents,
    servicesFeeCents,
    totalCents,
    services,
    includesBiosPreflash,
    includesFoamBrace
  };
}

/* ------------------------------------------------------------------ */
/* Dispatch SLA (America/Chicago, Mon–Sat operations)                  */
/* ------------------------------------------------------------------ */

function chicagoParts(d: Date) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    weekday: 'short'
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return {
    y: Number(parts.year),
    m: Number(parts.month),
    d: Number(parts.day),
    hour: Number(parts.hour) % 24,
    weekday: parts.weekday as string
  };
}

/** Returns YYYY-MM-DD estimated dispatch date. */
export function estimateDispatchDate(mode: FulfillmentMode, now: Date = new Date()): string {
  const c = chicagoParts(now);
  // Work in a UTC date anchored to the Chicago calendar day.
  const day = new Date(Date.UTC(c.y, c.m - 1, c.d));
  const isSunday = (x: Date) => x.getUTCDay() === 0;
  const addOperatingDays = (x: Date, n: number) => {
    const r = new Date(x);
    let added = 0;
    while (added < n) {
      r.setUTCDate(r.getUTCDate() + 1);
      if (!isSunday(r)) added++;
    }
    return r;
  };

  let result: Date;
  if (mode === 'DIY_PARTS_ONLY') {
    const sameDay = !isSunday(day) && c.hour < FEES.DIY_SAME_DAY_CUTOFF_HOUR;
    result = sameDay ? day : addOperatingDays(day, 1);
  } else {
    // Assembly (1 day) + 72h stress test (3 days) + crating (1 day)
    result = addOperatingDays(day, 5);
  }
  return result.toISOString().slice(0, 10);
}

export function isBeforeSameDayCutoff(now: Date = new Date()): boolean {
  const c = chicagoParts(now);
  return c.weekday !== 'Sun' && c.hour < FEES.DIY_SAME_DAY_CUTOFF_HOUR;
}
