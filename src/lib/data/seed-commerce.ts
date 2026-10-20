import type { BuildBayStage, FlashDeal, FulfillmentMode, SyndicatePackage, TelemetryMetrics } from '@/lib/types';
import { seedProduct } from './seed-catalog';
import { stableUuid } from './stable-id';

/* ------------------------------------------------------------------ */
/* Flash deals — windows are expressed relative to boot / NOW()        */
/* ------------------------------------------------------------------ */
export interface SeedDeal {
  key: string;
  sku: string;
  title: string;
  price: number;
  maxClaims: number;
  claimed: number;
  startsOffsetHours: number;
  durationHours: number;
  accent?: string;
}

export const SEED_DEALS: SeedDeal[] = [
  { key: 'deal-7800x3d', sku: 'VL-CPU-7800X3D', title: 'V-CACHE LIQUIDATION // 7800X3D', price: 329, maxClaims: 40, claimed: 31, startsOffsetHours: -6, durationHours: 14 },
  { key: 'deal-9070', sku: 'VL-GPU-9070-HELLHOUND', title: 'RDNA 4 OVERSTOCK DROP', price: 529, maxClaims: 25, claimed: 9, startsOffsetHours: -2, durationHours: 26, accent: '#FF3B00' },
  { key: 'deal-p3plus', sku: 'VL-SSD-P3PLUS-2TB', title: '2TB LIBRARY DRIVE BLITZ', price: 89, maxClaims: 60, claimed: 22, startsOffsetHours: -10, durationHours: 40 },
  { key: 'deal-a850g', sku: 'VL-PSU-A850G', title: '850W POWER CELL CLEARANCE', price: 94, maxClaims: 30, claimed: 27, startsOffsetHours: -20, durationHours: 24 },
  { key: 'deal-b650m', sku: 'VL-MB-B650M-PRORS', title: 'LEFTOVER BIN A4 // B650M', price: 104, maxClaims: 20, claimed: 4, startsOffsetHours: 3, durationHours: 24, accent: '#00F0FF' }
];

export function materializeDeals(now: number = Date.now()): FlashDeal[] {
  return SEED_DEALS.map((d) => {
    const product = seedProduct(d.sku);
    const starts = new Date(now + d.startsOffsetHours * 3600_000);
    const expires = new Date(starts.getTime() + d.durationHours * 3600_000);
    return {
      id: stableUuid(d.key),
      product_id: product.id,
      deal_title: d.title,
      deal_price_cents: Math.round(d.price * 100),
      max_claims: d.maxClaims,
      claimed_count: d.claimed,
      reserved_claims: 0,
      starts_at: starts.toISOString(),
      expires_at: expires.toISOString(),
      banner_accent_hex: d.accent ?? '#FF3B00',
      is_active: true,
      created_at: new Date(now).toISOString()
    };
  });
}

/* ------------------------------------------------------------------ */
/* Syndicate Package Offers — assembly fee waived                      */
/* ------------------------------------------------------------------ */
export const SEED_PACKAGES: SyndicatePackage[] = [
  {
    id: stableUuid('pkg-spectre'),
    slug: 'vx-01-spectre',
    name: 'VX-01 SPECTRE',
    tier: 'ESPORTS_1080P',
    tagline: '1080p esports interceptor',
    description:
      'Zen 5 six-core and a 16GB Blackwell card tuned for 240–360Hz panels. Low-profile memory, dual-tower air and an airflow chassis keep it silent between rounds.',
    hero_accent_hex: '#00F0FF',
    component_skus: ['VL-CPU-9600X', 'VL-MB-B850-AORUS', 'VL-RAM-FURY-32-6000', 'VL-GPU-5060TI-TWIN', 'VL-SSD-SN850X-1TB', 'VL-COOL-PA120SE', 'VL-CASE-H6FLOW', 'VL-PSU-GFA3-750'],
    target_fps_note: 'Valorant 480+ FPS · CS2 380+ FPS · Fortnite Perf. 300+ FPS',
    is_active: true,
    sort_order: 1
  },
  {
    id: stableUuid('pkg-halcyon'),
    slug: 'vx-02-halcyon',
    name: 'VX-02 HALCYON',
    tier: 'COMPETITIVE_1440P',
    tagline: '1440p high-refresh dominator',
    description:
      'The 9800X3D frame-time king paired with an RTX 5070 Ti. 360mm Liquid Freezer III, CL30 EXPO memory and a walnut-front North XL.',
    hero_accent_hex: '#D4FF00',
    component_skus: ['VL-CPU-9800X3D', 'VL-MB-X870-TOMAHAWK', 'VL-RAM-TZ5N-32-6000', 'VL-GPU-5070TI-GOC', 'VL-SSD-990PRO-2TB', 'VL-COOL-LF3PRO-360', 'VL-CASE-NORTHXL', 'VL-PSU-RM850X-SHIFT'],
    target_fps_note: 'Apex 1440p 300+ FPS · Warzone 200+ FPS · Cyberpunk RT Ultra (DLSS 4) 140+ FPS',
    is_active: true,
    sort_order: 2
  },
  {
    id: stableUuid('pkg-overseer'),
    slug: 'vx-03-overseer',
    name: 'VX-03 OVERSEER',
    tier: 'APEX_4K',
    tagline: 'No-compromise 4K flagship',
    description:
      'Ryzen 9 9950X3D, ROG Astral RTX 5090 and 64GB Dominator Titanium in a dual-chamber O11 EVO. Ships with the Instapak GPU transit brace molded in-house.',
    hero_accent_hex: '#FF3B00',
    component_skus: ['VL-CPU-9950X3D', 'VL-MB-X870E-HERO', 'VL-RAM-DOMTI-64-6400', 'VL-GPU-5090-ASTRAL', 'VL-SSD-9100PRO-2TB', 'VL-COOL-KRAKEN-ELITE-360', 'VL-CASE-O11EVO-RGB', 'VL-PSU-THOR-1600'],
    target_fps_note: 'Cyberpunk 4K Path Tracing (DLSS 4 MFG) 200+ FPS · Black Myth 4K Cinematic 120+ FPS',
    is_active: true,
    sort_order: 3
  },
  {
    id: stableUuid('pkg-architect'),
    slug: 'vx-04-architect',
    name: 'VX-04 ARCHITECT',
    tier: 'WORKSTATION_AI',
    tagline: 'Local-LLM & render workstation',
    description:
      '24-core Core Ultra 9 with NPU, 96GB DDR5-6400, a 32GB RTX 5090 and 4TB Gen5 scratch. 1500W Platinum headroom for a second GPU later.',
    hero_accent_hex: '#00E676',
    component_skus: ['VL-CPU-285K', 'VL-MB-Z890-HERO', 'VL-RAM-TZ5-96-6400', 'VL-GPU-5090-FE', 'VL-SSD-T705-4TB', 'VL-COOL-TITAN-360RX', 'VL-CASE-NORTHXL', 'VL-PSU-HX1500I'],
    target_fps_note: 'Llama 70B Q4 local inference · Blender Cycles · DaVinci 8K timelines',
    is_active: true,
    sort_order: 4
  }
];

/* ------------------------------------------------------------------ */
/* Demo orders for the Rig Forge Live tracker                          */
/* ------------------------------------------------------------------ */
export interface SeedOrderLog {
  stage: BuildBayStage;
  hoursAgo: number;
  technician: string;
  metrics?: TelemetryMetrics;
  proof?: string;
  notes?: string;
}

export interface SeedOrder {
  orderNumber: string;
  email: string;
  name: string;
  city: string;
  region: string;
  postal: string;
  mode: FulfillmentMode;
  packageSlug: string | null;
  skus: { sku: string; qty: number }[];
  stage: BuildBayStage;
  technician: string | null;
  createdHoursAgo: number;
  carrier?: string;
  tracking?: string;
  optInBios?: boolean;
  logs: SeedOrderLog[];
}

function curve(peakCpu: number, peakGpu: number, idle: number) {
  const pts: { t: number; cpu: number; gpu: number }[] = [];
  for (let t = 0; t <= 240; t += 10) {
    const ramp = 1 - Math.exp(-t / 18);
    const wobble = Math.sin(t / 7) * 0.8 + Math.cos(t / 13) * 0.6;
    pts.push({
      t,
      cpu: Math.round((idle + (peakCpu - idle - 1.5) * ramp + wobble) * 10) / 10,
      gpu: Math.round((idle - 3 + (peakGpu - idle + 1.5) * ramp + wobble * 0.7) * 10) / 10
    });
  }
  return pts;
}

export const SEED_ORDERS: SeedOrder[] = [
  {
    orderNumber: 'VL-ORD-88412',
    email: 'kade.mercer@protonmail.com',
    name: 'Kade Mercer',
    city: 'Seattle',
    region: 'WA',
    postal: '98101',
    mode: 'PRO_BUILT_FOUNDRY_RIG',
    packageSlug: 'vx-03-overseer',
    skus: SEED_PACKAGES[2].component_skus.map((sku) => ({ sku, qty: 1 })),
    stage: 'OCCT_THERMAL_BURN_IN_4HR',
    technician: 'TECH-VANCE-04',
    createdHoursAgo: 52,
    logs: [
      { stage: 'ORDER_CONFIRMED', hoursAgo: 52, technician: 'SYSTEM', notes: 'Inventory locked via reserve_inventory_atomic. Package VX-03 OVERSEER.' },
      {
        stage: 'PARTS_ALLOCATED_BIN_LOCKED',
        hoursAgo: 40,
        technician: 'TECH-ORTIZ-11',
        metrics: {
          serials: {
            CPU: '9HB4721X40112',
            GPU: 'S2N0KX01A4-99',
            MOTHERBOARD: 'R8M0PZ041887',
            RAM: 'CMP64GX5M2X6400C32-2611',
            STORAGE: 'S7VXNF0X501223',
            CPU_COOLER: 'KR-E360-R21-55810',
            CASE: 'O11DEVO-RGB-77102',
            PSU: 'THOR1600T3-0094'
          }
        },
        notes: 'All 8 serials scanned. GPU pulled from BIN #A4-99.'
      },
      { stage: 'BENCH_ASSEMBLY_IN_PROGRESS', hoursAgo: 30, technician: 'TECH-VANCE-04', metrics: { bench_bay_id: 'ESD-BAY-07' }, notes: 'Vertical radiator in top exhaust. Custom white-braided 12V-2x6 routed behind tray.' },
      {
        stage: 'BIOS_FLASH_AND_EXPO_TUNING',
        hoursAgo: 14,
        technician: 'TECH-VANCE-04',
        metrics: { bios_version_flashed: 'v1804', expo_xmp_profile_verified: '6400 MT/s CL32 (EXPO I)' },
        notes: 'Flashed latest AGESA. Curve Optimizer -15 all-core validated.'
      },
      {
        stage: 'OCCT_THERMAL_BURN_IN_4HR',
        hoursAgo: 3,
        technician: 'TECH-VANCE-04',
        metrics: {
          idle_cpu_temp_c: 34,
          peak_occt_cpu_temp_c: 71,
          peak_furmark_gpu_temp_c: 64,
          time_spy_score: 41870,
          thermal_curve: curve(71, 64, 34)
        },
        proof: '/media/proof/VL-ORD-88412-occt.svg',
        notes: 'OCCT CPU+RAM 4h pass, 0 WHEA errors. FurMark 1080p 20 min: 64°C peak.'
      }
    ]
  },
  {
    orderNumber: 'VL-ORD-88397',
    email: 'nadia.okafor@gmail.com',
    name: 'Nadia Okafor',
    city: 'Chicago',
    region: 'IL',
    postal: '60607',
    mode: 'PRO_BUILT_FOUNDRY_RIG',
    packageSlug: 'vx-02-halcyon',
    skus: SEED_PACKAGES[1].component_skus.map((sku) => ({ sku, qty: 1 })),
    stage: 'DISPATCHED_CARRIER',
    technician: 'TECH-REYES-02',
    createdHoursAgo: 150,
    carrier: 'UPS',
    tracking: '1Z9V0R4X0312884127',
    logs: [
      { stage: 'ORDER_CONFIRMED', hoursAgo: 150, technician: 'SYSTEM' },
      { stage: 'PARTS_ALLOCATED_BIN_LOCKED', hoursAgo: 138, technician: 'TECH-ORTIZ-11', metrics: { serials: { CPU: '9HC1102Z10771', GPU: 'GV-N507TGOC-1188' } } },
      { stage: 'BENCH_ASSEMBLY_IN_PROGRESS', hoursAgo: 120, technician: 'TECH-REYES-02', metrics: { bench_bay_id: 'ESD-BAY-03' } },
      { stage: 'BIOS_FLASH_AND_EXPO_TUNING', hoursAgo: 100, technician: 'TECH-REYES-02', metrics: { bios_version_flashed: 'v2.A51', expo_xmp_profile_verified: '6000 MT/s CL30 (EXPO I)' } },
      {
        stage: 'OCCT_THERMAL_BURN_IN_4HR',
        hoursAgo: 80,
        technician: 'TECH-REYES-02',
        metrics: { idle_cpu_temp_c: 31, peak_occt_cpu_temp_c: 68, peak_furmark_gpu_temp_c: 62, time_spy_score: 27940, thermal_curve: curve(68, 62, 31) },
        proof: '/media/proof/VL-ORD-88412-occt.svg'
      },
      { stage: 'INSTAPAK_FOAM_CRATING', hoursAgo: 40, technician: 'TECH-REYES-02', metrics: { foam_brace_molded: true, crate_sealed: true } },
      { stage: 'DISPATCHED_CARRIER', hoursAgo: 20, technician: 'TECH-REYES-02', metrics: { carrier: 'UPS', tracking_number: '1Z9V0R4X0312884127' } }
    ]
  },
  {
    orderNumber: 'VL-ORD-88425',
    email: 'j.whitfield@outlook.com',
    name: 'Jonah Whitfield',
    city: 'Denver',
    region: 'CO',
    postal: '80202',
    mode: 'PRO_BUILT_FOUNDRY_RIG',
    packageSlug: null,
    skus: [
      { sku: 'VL-CPU-9700X', qty: 1 },
      { sku: 'VL-MB-B650-GPLUS', qty: 1 },
      { sku: 'VL-RAM-FLAREX5-32-6000', qty: 1 },
      { sku: 'VL-GPU-5090-ASTRAL', qty: 1 },
      { sku: 'VL-SSD-990PRO-2TB', qty: 1 },
      { sku: 'VL-COOL-NHD15G2', qty: 1 },
      { sku: 'VL-CASE-4000D-RS', qty: 1 },
      { sku: 'VL-PSU-VERTEX-GX1200', qty: 1 }
    ],
    stage: 'BENCH_ASSEMBLY_IN_PROGRESS',
    technician: 'TECH-VANCE-04',
    createdHoursAgo: 20,
    logs: [
      { stage: 'ORDER_CONFIRMED', hoursAgo: 20, technician: 'SYSTEM', notes: 'TIGHT_TOLERANCE build flagged for technician clearance check.' },
      { stage: 'PARTS_ALLOCATED_BIN_LOCKED', hoursAgo: 12, technician: 'TECH-ORTIZ-11', metrics: { serials: { GPU: 'S2N0KX01A4-71', CASE: '4000DRS-55102' } } },
      { stage: 'BENCH_ASSEMBLY_IN_PROGRESS', hoursAgo: 2, technician: 'TECH-VANCE-04', metrics: { bench_bay_id: 'ESD-BAY-07' }, notes: '358mm GPU in 360mm chassis: installing diagonally before front fans. NH-D15 G2 front fan raised 3mm to clear 33mm Flare X5 DIMMs (1mm margin verified with feeler gauge).' }
    ]
  },
  {
    orderNumber: 'VL-ORD-88431',
    email: 'priya.raman@icloud.com',
    name: 'Priya Raman',
    city: 'Raleigh',
    region: 'NC',
    postal: '27601',
    mode: 'DIY_PARTS_ONLY',
    packageSlug: null,
    optInBios: true,
    skus: [
      { sku: 'VL-CPU-9600X', qty: 1 },
      { sku: 'VL-MB-B650M-PRORS', qty: 1 },
      { sku: 'VL-RAM-FLAREX5-32-6000', qty: 1 },
      { sku: 'VL-SSD-P3PLUS-2TB', qty: 1 }
    ],
    stage: 'PARTS_ALLOCATED_BIN_LOCKED',
    technician: null,
    createdHoursAgo: 4,
    logs: [
      { stage: 'ORDER_CONFIRMED', hoursAgo: 4, technician: 'SYSTEM', notes: 'Mandatory pre-ship BIOS flash attached (B650M Pro RS lacks FlashBack).' },
      { stage: 'PARTS_ALLOCATED_BIN_LOCKED', hoursAgo: 1, technician: 'TECH-ORTIZ-11', metrics: { serials: { CPU: '9HA0914Y22016', MOTHERBOARD: 'M80-GC012345' } } }
    ]
  }
];
