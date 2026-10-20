/**
 * VORTEX LABS — Corporate & Operational Identity (Spec §1).
 * Single source of truth for every legal / logistics string rendered in the UI.
 */
export const COMPANY = {
  legalName: 'Vortex Labs Hardware Syndicate, LLC',
  brandName: 'VORTEX LABS',
  brandTagline: 'CUSTOM RIG FOUNDRY',
  fullBrand: 'VORTEX LABS // CUSTOM RIG FOUNDRY',
  domain: 'https://vortexlabs.gg',
  ein: '84-3920194',
  flagship: {
    label: 'Flagship Assembly Foundry & Showroom',
    street: '4092 Silicon Way, Sector 7, Suite 800',
    city: 'Austin',
    region: 'TX',
    postalCode: '78701',
    country: 'USA',
    coordinates: { lat: 30.2672, lng: -97.7431, display: '30.2672° N, 97.7431° W' }
  },
  hubs: [
    {
      code: 'US-CENTRAL',
      city: 'Austin, TX',
      role: 'Primary Foundry & Burn-In Lab',
      areaSqFt: 75000,
      detail: 'Climate-controlled, anti-static, ISO-certified facility'
    },
    {
      code: 'US-EAST',
      city: 'Ashburn, VA',
      role: 'Component Dispatch',
      areaSqFt: 32000,
      detail: 'Fulfillment center'
    },
    {
      code: 'US-WEST',
      city: 'Reno, NV',
      role: 'Component Dispatch',
      areaSqFt: 40000,
      detail: 'Fulfillment center'
    }
  ],
  hours: {
    label: 'Monday–Saturday, 09:00 – 21:00 CST (UTC−6)',
    days: 'MON–SAT',
    open: '09:00',
    close: '21:00',
    timezone: 'America/Chicago'
  },
  contacts: {
    support: { label: 'Technical Support & RMA', email: 'rma@vortexlabs.gg', phone: '+1 (512) 555-0199', tel: '+15125550199' },
    syndicate: {
      label: 'B2B & Esports Sponsorships',
      email: 'syndicate@vortexlabs.gg',
      phone: '+1 (512) 555-0144',
      tel: '+15125550144'
    }
  }
} as const;

/** Fulfillment & service fee schedule (Spec §1 — Fulfillment Modes & Packaging Protocol). */
export const FEES = {
  /** Mode B — Pro-Built Foundry Rig flat assembly, cable routing, BIOS/EXPO tuning & 72h stress test. */
  PRO_BUILT_ASSEMBLY_CENTS: 14900,
  /** Mode A — optional Pre-Ship Motherboard BIOS Flash & Socket Pin Inspection. */
  DIY_BIOS_PREFLASH_CENTS: 1500,
  /** Mode A same-day dispatch cutoff (America/Chicago). */
  DIY_SAME_DAY_CUTOFF_HOUR: 16,
  /** GPU mass threshold that triggers the mandatory Instapak foam brace on Pro-Built rigs. */
  GPU_FOAM_BRACE_THRESHOLD_GRAMS: 1200,
  /** Inventory lease length for atomic cart reservations. */
  RESERVATION_TTL_MINUTES: 10,
  /** Price floor: effective price may never be below 60% of wholesale cost without dual-Overseer override. */
  PRICE_FLOOR_RATIO: 0.6
} as const;

export const SERVICE_CODES = {
  BIOS_FLASH_DIY: 'SRV-BIOS-FLASH-DIY',
  FOAM_BRACE: 'VL-PACK-INSTAPAK-BRACE',
  PRO_ASSEMBLY: 'SRV-FOUNDRY-ASSEMBLY'
} as const;
