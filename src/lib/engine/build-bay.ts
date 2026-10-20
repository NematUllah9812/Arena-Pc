import type { BuildBayStage, FulfillmentMode } from '@/lib/types';

export interface StageDefinition {
  stage: BuildBayStage;
  index: number;
  label: string;
  short: string;
  customerTelemetry: string;
  technicianRequirement: string;
  /** Fields the technician must supply when logging this stage. */
  requiredFields: (keyof StageFieldMap)[];
}

export interface StageFieldMap {
  serials: string;
  bench_bay_id: string;
  technician_code: string;
  bios_version_flashed: string;
  expo_xmp_profile_verified: string;
  idle_cpu_temp_c: string;
  peak_occt_cpu_temp_c: string;
  peak_furmark_gpu_temp_c: string;
  time_spy_score: string;
  proof_screenshot: string;
  foam_brace_molded: string;
  crate_sealed: string;
  carrier: string;
  tracking_number: string;
}

export const STAGES: Record<BuildBayStage, StageDefinition> = {
  ORDER_CONFIRMED: {
    stage: 'ORDER_CONFIRMED',
    index: 1,
    label: 'Order Confirmed',
    short: 'CONFIRMED',
    customerTelemetry: 'Order locked; parts reserved in Austin Hub.',
    technicianRequirement: 'Auto-verified via reserve_inventory_atomic.',
    requiredFields: []
  },
  PARTS_ALLOCATED_BIN_LOCKED: {
    stage: 'PARTS_ALLOCATED_BIN_LOCKED',
    index: 2,
    label: 'Parts Allocated // Bin Locked',
    short: 'BIN LOCKED',
    customerTelemetry: 'Serial numbers & warehouse bin numbers scanned.',
    technicianRequirement: 'Barcode scan of each component serial number.',
    requiredFields: ['serials']
  },
  BENCH_ASSEMBLY_IN_PROGRESS: {
    stage: 'BENCH_ASSEMBLY_IN_PROGRESS',
    index: 3,
    label: 'Bench Assembly In Progress',
    short: 'ASSEMBLY',
    customerTelemetry: 'Assigned technician badge + anti-static bench bay ID.',
    technicianRequirement: 'Technician claims build ticket; checks TIGHT_TOLERANCE notes.',
    requiredFields: ['technician_code', 'bench_bay_id']
  },
  BIOS_FLASH_AND_EXPO_TUNING: {
    stage: 'BIOS_FLASH_AND_EXPO_TUNING',
    index: 4,
    label: 'BIOS Flash & EXPO Tuning',
    short: 'BIOS / EXPO',
    customerTelemetry: 'Exact BIOS version flashed & RAM EXPO/XMP speed locked.',
    technicianRequirement: 'Technician inputs flashed BIOS revision & memory timings.',
    requiredFields: ['bios_version_flashed', 'expo_xmp_profile_verified']
  },
  OCCT_THERMAL_BURN_IN_4HR: {
    stage: 'OCCT_THERMAL_BURN_IN_4HR',
    index: 5,
    label: 'OCCT Thermal Burn-In (4hr)',
    short: 'BURN-IN',
    customerTelemetry: 'Recorded thermal curve, CPU/GPU peaks, 3DMark Time Spy score + downloadable thermal proof.',
    technicianRequirement: 'Mandatory upload of OCCT + 3DMark screenshot to Supabase Storage.',
    requiredFields: ['idle_cpu_temp_c', 'peak_occt_cpu_temp_c', 'peak_furmark_gpu_temp_c', 'time_spy_score', 'proof_screenshot']
  },
  INSTAPAK_FOAM_CRATING: {
    stage: 'INSTAPAK_FOAM_CRATING',
    index: 6,
    label: 'Instapak Foam Crating',
    short: 'CRATING',
    customerTelemetry: 'Instapak Quick RT foam brace molded around GPU & double-walled shock crate sealed.',
    technicianRequirement: 'Checklist confirmation of internal GPU foam brace.',
    requiredFields: ['foam_brace_molded', 'crate_sealed']
  },
  DISPATCHED_CARRIER: {
    stage: 'DISPATCHED_CARRIER',
    index: 7,
    label: 'Dispatched // Carrier',
    short: 'DISPATCHED',
    customerTelemetry: 'Live UPS/FedEx freight tracking + printable System Blueprint & BIOS profile.',
    technicianRequirement: 'Carrier tracking number sync.',
    requiredFields: ['carrier', 'tracking_number']
  },
  DELIVERED: {
    stage: 'DELIVERED',
    index: 8,
    label: 'Delivered',
    short: 'DELIVERED',
    customerTelemetry: 'Rig delivered. Welcome to the Syndicate.',
    technicianRequirement: 'Carrier delivery confirmation.',
    requiredFields: []
  }
};

const PRO_SEQUENCE: BuildBayStage[] = [
  'ORDER_CONFIRMED',
  'PARTS_ALLOCATED_BIN_LOCKED',
  'BENCH_ASSEMBLY_IN_PROGRESS',
  'BIOS_FLASH_AND_EXPO_TUNING',
  'OCCT_THERMAL_BURN_IN_4HR',
  'INSTAPAK_FOAM_CRATING',
  'DISPATCHED_CARRIER',
  'DELIVERED'
];

/** Stage pipeline per fulfillment mode. DIY skips bench/burn-in; BIOS stage only if pre-flash was purchased. */
export function stageSequence(mode: FulfillmentMode, includesBiosPreflash: boolean): BuildBayStage[] {
  if (mode === 'PRO_BUILT_FOUNDRY_RIG') return PRO_SEQUENCE;
  return [
    'ORDER_CONFIRMED',
    'PARTS_ALLOCATED_BIN_LOCKED',
    ...(includesBiosPreflash ? (['BIOS_FLASH_AND_EXPO_TUNING'] as BuildBayStage[]) : []),
    'DISPATCHED_CARRIER',
    'DELIVERED'
  ];
}

export function nextStage(mode: FulfillmentMode, includesBiosPreflash: boolean, current: BuildBayStage): BuildBayStage | null {
  const seq = stageSequence(mode, includesBiosPreflash);
  const i = seq.indexOf(current);
  return i >= 0 && i < seq.length - 1 ? seq[i + 1] : null;
}

/** Stage-specific required fields; foam brace checklist only when the order includes one. */
export function requiredFieldsFor(stage: BuildBayStage, mode: FulfillmentMode, includesFoamBrace: boolean): (keyof StageFieldMap)[] {
  const def = STAGES[stage];
  let fields = [...def.requiredFields];
  if (stage === 'INSTAPAK_FOAM_CRATING' && !includesFoamBrace) fields = fields.filter((f) => f !== 'foam_brace_molded');
  if (stage === 'BIOS_FLASH_AND_EXPO_TUNING' && mode === 'DIY_PARTS_ONLY') fields = ['bios_version_flashed'];
  return fields;
}

export const CARRIERS = {
  UPS: { label: 'UPS', trackingUrl: (n: string) => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}` },
  FEDEX: { label: 'FedEx', trackingUrl: (n: string) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}` }
} as const;

export function trackingUrl(carrier: string | null, number: string | null): string | null {
  if (!carrier || !number) return null;
  const c = CARRIERS[carrier.toUpperCase() as keyof typeof CARRIERS];
  return c ? c.trackingUrl(number) : null;
}
