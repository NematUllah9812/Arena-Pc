// src/lib/engine/compatibility-engine-v2.ts
// VORTEX LABS — Real-time PC Compatibility Engine v2.0 (Spec §5)
// 3-Tier confidence matrix: VERIFIED_FIT / TIGHT_TOLERANCE / HARD_CONFLICT.
// Pure + isomorphic: runs in the browser (live Rig Forge feedback), on the
// server (checkout re-validation) and inside the Auto-Forge optimizer.

import { FEES, SERVICE_CODES } from '@/lib/config/company';
import type { ConfidenceTier, FulfillmentMode } from '@/lib/types';

export type { ConfidenceTier, FulfillmentMode };

/** Minimal product shape the engine needs — satisfied by Product and PublicProduct. */
export interface EnginePart {
  id?: string;
  sku?: string;
  name: string;
  category?: string;
  tdp_watts?: number;
  weight_grams?: number;
  specs: Record<string, any>;
}

export interface CompatibilityIssue {
  code: string;
  tier: ConfidenceTier;
  involvedSlots: string[];
  title: string;
  explanation: string;
  remediationSuggestion: string;
  autoInjectedService?: {
    serviceCode: string;
    label: string;
    priceCents: number;
    mandatory: boolean;
  };
}

export interface BuildManifest {
  cpu?: EnginePart | null;
  motherboard?: EnginePart | null;
  ram?: EnginePart[];
  gpu?: EnginePart[];
  cooler?: EnginePart | null;
  storage?: EnginePart[];
  psu?: EnginePart | null;
  pcCase?: EnginePart | null;
  fulfillmentMode: FulfillmentMode;
}

export interface AutoInjectedLogisticsItem {
  code: string;
  name: string;
  priceCents: number;
  reason: string;
}

export interface CompatibilityReportV2 {
  canCheckout: boolean;
  overallConfidence: ConfidenceTier;
  requiresTechnicianManualVerify: boolean;
  estimatedBaseWattage: number;
  estimatedPeakTransientWattage: number;
  recommendedPsuWattage: number;
  autoInjectedLogisticsItems: AutoInjectedLogisticsItem[];
  issues: CompatibilityIssue[];
  /** Optional services offered (not mandatory) — e.g. DIY $15 BIOS pre-flash. */
  optionalServices: NonNullable<CompatibilityIssue['autoInjectedService']>[];
  /** Missing slots that prevent a complete, bootable system. */
  missingSlots: string[];
  isCompleteSystem: boolean;
}

/** Physical clearance thresholds (mm). VERIFIED_FIT requires >= 3mm buffer. */
export const CLEARANCE = {
  VERIFIED_BUFFER_MM: 3,
  RAM_FAN_OFFSET_MAX_MM: 5,
  RAM_VERIFIED_BUFFER_MM: 2,
  DEFAULT_RAM_HEIGHT_MM: 38,
  DEFAULT_RAM_CLEARANCE_MM: 40,
  DEFAULT_RADIATOR_STACK_MM: 38,
  SYSTEM_OVERHEAD_WATTS: 95
} as const;

const asArray = <T,>(v: T[] | undefined | null): T[] => (Array.isArray(v) ? v.filter(Boolean) : []);

export function evaluateBuildCompatibilityV2(build: BuildManifest): CompatibilityReportV2 {
  const issues: CompatibilityIssue[] = [];
  const autoInjectedLogisticsItems: AutoInjectedLogisticsItem[] = [];
  const optionalServices: CompatibilityReportV2['optionalServices'] = [];
  const { cpu, motherboard, cooler, psu, pcCase, fulfillmentMode } = build;
  const ram = asArray(build.ram);
  const gpu = asArray(build.gpu);
  const storage = asArray(build.storage);

  /* ------------------------------------------------------------------ */
  /* 1. CPU <-> MOTHERBOARD SOCKET & GRANULAR BIOS FLASHBACK LOGIC        */
  /* ------------------------------------------------------------------ */
  if (cpu && motherboard) {
    if (cpu.specs.socket !== motherboard.specs.socket) {
      issues.push({
        code: 'ERR_SOCKET_MISMATCH',
        tier: 'HARD_CONFLICT',
        involvedSlots: ['CPU', 'MOTHERBOARD'],
        title: `Socket Mismatch: ${cpu.specs.socket} vs ${motherboard.specs.socket}`,
        explanation: `${cpu.name} requires a ${cpu.specs.socket} socket, while ${motherboard.name} uses ${motherboard.specs.socket}.`,
        remediationSuggestion: `Filter motherboards by socket ${cpu.specs.socket}.`
      });
    } else if (
      cpu.specs.requires_bios_version &&
      Number(motherboard.specs.bios_version_shipped ?? 0) < Number(cpu.specs.requires_bios_version)
    ) {
      const hasBiosFlashbackButton = Boolean(motherboard.specs.has_bios_flashback_button);

      if (fulfillmentMode === 'PRO_BUILT_FOUNDRY_RIG') {
        issues.push({
          code: 'INFO_FOUNDRY_BIOS_AUTO_FLASH',
          tier: 'TIGHT_TOLERANCE',
          involvedSlots: ['CPU', 'MOTHERBOARD'],
          title: 'Foundry BIOS Pre-Flash Queued (Included Free)',
          explanation: `${motherboard.name} ships with factory BIOS v${motherboard.specs.bios_version_shipped}, whereas ${cpu.name} requires v${cpu.specs.requires_bios_version}.`,
          remediationSuggestion:
            'Because you selected Pro-Built Foundry Assembly, our technicians will flash the latest AGESA/microcode prior to burn-in at $0 cost.'
        });
      } else if (hasBiosFlashbackButton) {
        const service = {
          serviceCode: SERVICE_CODES.BIOS_FLASH_DIY,
          label: 'Pre-Ship Bench BIOS Update & Socket Inspection',
          priceCents: FEES.DIY_BIOS_PREFLASH_CENTS,
          mandatory: false
        };
        issues.push({
          code: 'WARN_DIY_USB_BIOS_FLASHBACK_AVAILABLE',
          tier: 'TIGHT_TOLERANCE',
          involvedSlots: ['CPU', 'MOTHERBOARD'],
          title: 'USB BIOS FlashBack Required Before First Boot',
          explanation: `${motherboard.name} includes a rear USB BIOS FlashBack button, allowing you to update to BIOS v${cpu.specs.requires_bios_version} using a FAT32 USB drive without an older CPU.`,
          remediationSuggestion:
            'Flash via USB yourself upon delivery, or check the $15 Vortex Pre-Ship BIOS Flash Service at checkout.',
          autoInjectedService: service
        });
        optionalServices.push(service);
      } else {
        // Board has NO flashback button and user selected DIY Parts-Only!
        const service = {
          serviceCode: SERVICE_CODES.BIOS_FLASH_DIY,
          label: 'Mandatory Pre-Ship Bench BIOS Flash (Board Lacks USB FlashBack)',
          priceCents: FEES.DIY_BIOS_PREFLASH_CENTS,
          mandatory: true
        };
        issues.push({
          code: 'WARN_NO_FLASHBACK_HEADER_MANDATORY_SERVICE',
          tier: 'TIGHT_TOLERANCE',
          involvedSlots: ['CPU', 'MOTHERBOARD'],
          title: 'Motherboard Lacks CPU-Less BIOS FlashBack Button',
          explanation: `${motherboard.name} cannot boot ${cpu.name} out of the box and lacks a CPU-less USB FlashBack button.`,
          remediationSuggestion:
            'We have automatically attached our $15 Pre-Ship Bench BIOS Flash Service so your board arrives ready to POST.',
          autoInjectedService: service
        });
        autoInjectedLogisticsItems.push({
          code: SERVICE_CODES.BIOS_FLASH_DIY,
          name: 'Foundry Pre-Ship BIOS Update & POST Verification',
          priceCents: FEES.DIY_BIOS_PREFLASH_CENTS,
          reason: `${motherboard.name} requires BIOS v${cpu.specs.requires_bios_version} and has no CPU-less USB FlashBack button.`
        });
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* 1b. MEMORY GENERATION + SLOT COUNT (DDR4 vs DDR5 => HARD_CONFLICT)   */
  /* ------------------------------------------------------------------ */
  if (motherboard && ram.length > 0) {
    const mismatched = ram.filter((r) => r.specs.memory_type !== motherboard.specs.memory_type);
    if (mismatched.length) {
      issues.push({
        code: 'ERR_MEMORY_GENERATION_MISMATCH',
        tier: 'HARD_CONFLICT',
        involvedSlots: ['RAM', 'MOTHERBOARD'],
        title: `Memory Mismatch: ${mismatched[0].specs.memory_type} kit on a ${motherboard.specs.memory_type} board`,
        explanation: `${mismatched[0].name} is keyed for ${mismatched[0].specs.memory_type}; ${motherboard.name} only accepts ${motherboard.specs.memory_type} DIMMs. The notch position physically prevents insertion.`,
        remediationSuggestion: `Choose a ${motherboard.specs.memory_type} memory kit.`
      });
    }
    const modules = ram.reduce((acc, r) => acc + Number(r.specs.modules ?? 1), 0);
    const slots = Number(motherboard.specs.memory_slots ?? 4);
    if (modules > slots) {
      issues.push({
        code: 'ERR_DIMM_SLOT_OVERFLOW',
        tier: 'HARD_CONFLICT',
        involvedSlots: ['RAM', 'MOTHERBOARD'],
        title: `Too Many DIMMs (${modules} modules vs ${slots} slots)`,
        explanation: `${motherboard.name} exposes ${slots} DIMM slots, but the selected kits contain ${modules} modules.`,
        remediationSuggestion: 'Use a single higher-capacity kit instead of stacking kits.'
      });
    } else if (modules > 2 && motherboard.specs.memory_type === 'DDR5') {
      issues.push({
        code: 'WARN_DDR5_FOUR_DIMM_DOWNCLOCK',
        tier: 'TIGHT_TOLERANCE',
        involvedSlots: ['RAM', 'MOTHERBOARD'],
        title: 'Four-DIMM DDR5 Population May Downclock EXPO/XMP',
        explanation: 'Populating 4 DDR5 slots (2 DIMMs per channel) typically limits stable speeds below the rated profile.',
        remediationSuggestion: 'Prefer a 2x32GB or 2x48GB kit for full-speed EXPO/XMP.'
      });
    }
  }
  if (cpu && ram.length > 0 && !motherboard) {
    const mismatched = ram.filter((r) => cpu.specs.memory_type && r.specs.memory_type !== cpu.specs.memory_type);
    if (mismatched.length) {
      issues.push({
        code: 'ERR_MEMORY_CONTROLLER_MISMATCH',
        tier: 'HARD_CONFLICT',
        involvedSlots: ['RAM', 'CPU'],
        title: `${cpu.name} only supports ${cpu.specs.memory_type}`,
        explanation: `${mismatched[0].name} is ${mismatched[0].specs.memory_type}; the integrated memory controller is ${cpu.specs.memory_type}-only.`,
        remediationSuggestion: `Choose a ${cpu.specs.memory_type} memory kit.`
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* 1c. COOLER SOCKET SUPPORT + THERMAL CAPACITY                         */
  /* ------------------------------------------------------------------ */
  if (cpu && cooler) {
    const sockets: string[] = cooler.specs.supported_sockets ?? [];
    if (sockets.length && !sockets.includes(cpu.specs.socket)) {
      issues.push({
        code: 'ERR_COOLER_SOCKET_UNSUPPORTED',
        tier: 'HARD_CONFLICT',
        involvedSlots: ['CPU_COOLER', 'CPU'],
        title: `Cooler Mount Missing for ${cpu.specs.socket}`,
        explanation: `${cooler.name} ships with mounting hardware for ${sockets.join(', ')} only.`,
        remediationSuggestion: `Pick a cooler that lists ${cpu.specs.socket} support.`
      });
    } else if (Number(cooler.specs.tdp_rating_watts ?? 0) < Number(cpu.tdp_watts ?? 0)) {
      issues.push({
        code: 'WARN_COOLER_THERMAL_HEADROOM',
        tier: 'TIGHT_TOLERANCE',
        involvedSlots: ['CPU_COOLER', 'CPU'],
        title: `Cooler Rated ${cooler.specs.tdp_rating_watts}W for a ${cpu.tdp_watts}W CPU`,
        explanation: `${cpu.name} can sustain ${cpu.tdp_watts}W; ${cooler.name} is rated for ${cooler.specs.tdp_rating_watts}W and will thermal-throttle under all-core load.`,
        remediationSuggestion: 'Step up to a dual-tower air cooler or 360mm AIO.'
      });
    }
  }
  if (cpu && !cooler && cpu.specs.includes_cooler === false) {
    issues.push({
      code: 'INFO_NO_COOLER_SELECTED',
      tier: 'TIGHT_TOLERANCE',
      involvedSlots: ['CPU_COOLER'],
      title: 'No CPU Cooler Selected',
      explanation: `${cpu.name} does not include a boxed cooler.`,
      remediationSuggestion: 'Add an air cooler or AIO — the system will not POST safely without one.'
    });
  }

  /* ------------------------------------------------------------------ */
  /* 1d. CHASSIS FORM FACTOR (MOTHERBOARD + PSU)                          */
  /* ------------------------------------------------------------------ */
  if (pcCase && motherboard) {
    const supported: string[] = pcCase.specs.form_factor_support ?? [];
    if (supported.length && !supported.includes(motherboard.specs.form_factor)) {
      issues.push({
        code: 'ERR_FORM_FACTOR_UNSUPPORTED',
        tier: 'HARD_CONFLICT',
        involvedSlots: ['MOTHERBOARD', 'CASE'],
        title: `${motherboard.specs.form_factor} Board Will Not Mount in ${pcCase.name}`,
        explanation: `${pcCase.name} accepts ${supported.join(' / ')} motherboards only.`,
        remediationSuggestion: `Choose a ${supported.join(' or ')} motherboard or a larger chassis.`
      });
    }
  }
  if (pcCase && psu) {
    const supported: string[] = pcCase.specs.psu_form_factor_support ?? ['ATX'];
    const ff = psu.specs.form_factor ?? 'ATX';
    if (!supported.includes(ff)) {
      issues.push({
        code: 'ERR_PSU_FORM_FACTOR',
        tier: 'HARD_CONFLICT',
        involvedSlots: ['PSU', 'CASE'],
        title: `${ff} PSU Does Not Fit ${pcCase.name}`,
        explanation: `${pcCase.name} has a ${supported.join(' / ')} power-supply bay.`,
        remediationSuggestion: `Select a ${supported.join(' or ')} power supply.`
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* 2. 3-TIER PHYSICAL CLEARANCE ENGINE (GPU, RADIATOR & AIR COOLER)     */
  /* ------------------------------------------------------------------ */
  let radiatorPlacement: 'TOP' | 'FRONT' | 'NONE' | null = null;
  if (pcCase && cooler?.specs.type === 'AIO_LIQUID') {
    const rad = Number(cooler.specs.radiator_size_mm);
    const top: number[] = pcCase.specs.supported_radiators_top_mm ?? [];
    const front: number[] = pcCase.specs.supported_radiators_front_mm ?? [];
    radiatorPlacement = top.includes(rad) ? 'TOP' : front.includes(rad) ? 'FRONT' : 'NONE';
    if (radiatorPlacement === 'NONE') {
      issues.push({
        code: 'ERR_RADIATOR_UNSUPPORTED',
        tier: 'HARD_CONFLICT',
        involvedSlots: ['CPU_COOLER', 'CASE'],
        title: `${rad}mm Radiator Has No Mounting Position`,
        explanation: `${pcCase.name} supports ${top.length ? top.join('/') + 'mm top' : 'no top'} and ${front.length ? front.join('/') + 'mm front' : 'no front'} radiators.`,
        remediationSuggestion: 'Choose a radiator size the chassis lists, or switch to an air cooler.'
      });
    }
  }

  if (pcCase && gpu.length > 0) {
    const longestGpuMm = Math.max(...gpu.map((g) => Number(g.specs.length_mm ?? 0)));
    const frontRadDeduction =
      cooler?.specs.type === 'AIO_LIQUID' && radiatorPlacement === 'FRONT'
        ? Number(cooler.specs.radiator_thickness_mm ?? CLEARANCE.DEFAULT_RADIATOR_STACK_MM)
        : 0;
    const effectiveMaxGpuMm = Number(pcCase.specs.max_gpu_length_mm ?? 0) - frontRadDeduction;
    const bufferMm = effectiveMaxGpuMm - longestGpuMm;

    if (bufferMm < 0) {
      issues.push({
        code: 'ERR_GPU_PHYSICAL_COLLISION',
        tier: 'HARD_CONFLICT',
        involvedSlots: ['GPU', 'CASE'],
        title: `GPU Physical Collision (${longestGpuMm}mm GPU vs ${effectiveMaxGpuMm}mm Available)`,
        explanation: `The GPU exceeds internal clearance by ${Math.abs(bufferMm)}mm (accounting for ${frontRadDeduction}mm front radiator stack).`,
        remediationSuggestion: 'Select a larger chassis, mount the AIO in the top exhaust, or choose a shorter GPU.'
      });
    } else if (bufferMm < CLEARANCE.VERIFIED_BUFFER_MM) {
      issues.push({
        code: 'WARN_GPU_TIGHT_TOLERANCE',
        tier: 'TIGHT_TOLERANCE',
        involvedSlots: ['GPU', 'CASE'],
        title: `Tight GPU Fitment Margin (${bufferMm}mm Buffer Remaining)`,
        explanation: `${longestGpuMm}mm GPU leaves only ${bufferMm}mm of clearance inside ${pcCase.name}${frontRadDeduction ? ` after a ${frontRadDeduction}mm front radiator stack` : ''}.`,
        remediationSuggestion: 'Requires installing the GPU diagonally before mounting front intake fans.'
      });
    }
  }

  // Air cooler height vs chassis
  if (pcCase && cooler?.specs.type === 'AIR' && cooler.specs.height_mm && pcCase.specs.max_cpu_cooler_height_mm) {
    const delta = Number(pcCase.specs.max_cpu_cooler_height_mm) - Number(cooler.specs.height_mm);
    if (delta < 0) {
      issues.push({
        code: 'ERR_COOLER_HEIGHT_COLLISION',
        tier: 'HARD_CONFLICT',
        involvedSlots: ['CPU_COOLER', 'CASE'],
        title: `Cooler Too Tall (${cooler.specs.height_mm}mm vs ${pcCase.specs.max_cpu_cooler_height_mm}mm)`,
        explanation: `${cooler.name} would press against the side panel of ${pcCase.name} by ${Math.abs(delta)}mm.`,
        remediationSuggestion: 'Choose a shorter tower, a low-profile cooler, or an AIO.'
      });
    } else if (delta < CLEARANCE.VERIFIED_BUFFER_MM) {
      issues.push({
        code: 'WARN_COOLER_HEIGHT_TIGHT',
        tier: 'TIGHT_TOLERANCE',
        involvedSlots: ['CPU_COOLER', 'CASE'],
        title: `Cooler Clears Side Panel by ${delta}mm`,
        explanation: `${cooler.name} (${cooler.specs.height_mm}mm) inside ${pcCase.name} (${pcCase.specs.max_cpu_cooler_height_mm}mm max).`,
        remediationSuggestion: 'Foundry technicians verify glass-panel clearance before sealing.'
      });
    }
  }

  // Air Cooler vs. RAM Heatspreader 3-Tier Check
  if (cooler?.specs.type === 'AIR' && ram.length > 0) {
    const tallestRamMm = Math.max(...ram.map((r) => Number(r.specs.height_mm ?? CLEARANCE.DEFAULT_RAM_HEIGHT_MM)));
    const clearanceMm = Number(cooler.specs.max_ram_height_clearance_mm ?? CLEARANCE.DEFAULT_RAM_CLEARANCE_MM);
    const deltaMm = Math.round((clearanceMm - tallestRamMm) * 10) / 10;

    if (deltaMm < -CLEARANCE.RAM_FAN_OFFSET_MAX_MM) {
      issues.push({
        code: 'ERR_RAM_COOLER_SEVERE_COLLISION',
        tier: 'HARD_CONFLICT',
        involvedSlots: ['CPU_COOLER', 'RAM'],
        title: 'Air Cooler Tower Collides with Tall RAM Heatspreaders',
        explanation: `RAM height (${tallestRamMm}mm) exceeds cooler clearance (${clearanceMm}mm) by ${Math.abs(deltaMm)}mm.`,
        remediationSuggestion: 'Switch to low-profile RAM (<35mm) or an AIO Liquid Cooler.'
      });
    } else if (deltaMm < CLEARANCE.RAM_VERIFIED_BUFFER_MM) {
      issues.push({
        code: 'WARN_FAN_OFFSET_REQUIRED',
        tier: 'TIGHT_TOLERANCE',
        involvedSlots: ['CPU_COOLER', 'RAM'],
        title: `Front Cooler Fan Requires +${Math.max(1, Math.ceil(CLEARANCE.RAM_VERIFIED_BUFFER_MM - deltaMm))}mm Vertical Clip Offset`,
        explanation: `RAM height (${tallestRamMm}mm) requires shifting the front fan slightly upward on the heatsink fins.`,
        remediationSuggestion:
          'Foundry technicians will offset the front fan clip during assembly and verify glass panel clearance.'
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* 2b. STORAGE M.2 SLOT CAPACITY                                        */
  /* ------------------------------------------------------------------ */
  if (motherboard && storage.length > 0) {
    const nvme = storage.filter((s) => s.specs.type === 'NVME_M2').length;
    const m2Slots = Number(motherboard.specs.m2_slots ?? 0);
    if (nvme > m2Slots) {
      issues.push({
        code: 'ERR_M2_SLOT_OVERFLOW',
        tier: 'HARD_CONFLICT',
        involvedSlots: ['STORAGE', 'MOTHERBOARD'],
        title: `Too Many NVMe Drives (${nvme} vs ${m2Slots} M.2 slots)`,
        explanation: `${motherboard.name} exposes ${m2Slots} M.2 slots.`,
        remediationSuggestion: 'Use fewer, larger NVMe drives or add a SATA SSD for bulk storage.'
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* 3. HEAVY GPU TRANSIT PROTECTION (AUTO-INJECT EXPANDING FOAM BRACE)   */
  /* ------------------------------------------------------------------ */
  if (fulfillmentMode === 'PRO_BUILT_FOUNDRY_RIG' && gpu.length > 0) {
    const heaviestGpuGrams = Math.max(...gpu.map((g) => Number(g.weight_grams ?? 1400)));
    if (heaviestGpuGrams >= FEES.GPU_FOAM_BRACE_THRESHOLD_GRAMS) {
      autoInjectedLogisticsItems.push({
        code: SERVICE_CODES.FOAM_BRACE,
        name: 'Instapak Quick RT Molded Internal GPU Transit Brace + Anti-Sag Bracket',
        priceCents: 0, // Included in $149 Pro-Built Foundry SLA
        reason: `Selected GPU mass (${heaviestGpuGrams.toLocaleString('en-US')}g) exceeds the 1,200g PCIe shear threshold during carrier transit.`
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* 4. TRANSIENT POWER EXCURSION & ATX 3.1 12V-2x6 CHECK                 */
  /* ------------------------------------------------------------------ */
  const cpuWatts = Number(cpu?.tdp_watts ?? 0);
  const gpuWatts = gpu.reduce((acc, g) => acc + Number(g.tdp_watts ?? 0), 0);
  const systemOverheadWatts = CLEARANCE.SYSTEM_OVERHEAD_WATTS;
  const estimatedBaseWattage = cpuWatts + gpuWatts + systemOverheadWatts;
  const estimatedPeakTransientWattage = Math.ceil(cpuWatts * 1.25 + gpuWatts * 1.45 + systemOverheadWatts);
  const recommendedPsuWattage = Math.ceil((estimatedPeakTransientWattage + 100) / 50) * 50;

  if (psu) {
    const wattage = Number(psu.specs.wattage ?? 0);
    if (wattage < estimatedBaseWattage * 1.1) {
      issues.push({
        code: 'ERR_PSU_OVERLOAD',
        tier: 'HARD_CONFLICT',
        involvedSlots: ['PSU', 'GPU', 'CPU'],
        title: `PSU Wattage Insufficient (${wattage}W vs ${recommendedPsuWattage}W Recommended)`,
        explanation: `Peak transient draw reaches ${estimatedPeakTransientWattage}W, which will trip Over-Current Protection (OCP) on a ${wattage}W unit.`,
        remediationSuggestion: `Select at least a ${recommendedPsuWattage}W ATX 3.1 power supply.`
      });
    } else if (wattage < recommendedPsuWattage) {
      issues.push({
        code: 'WARN_PSU_LOW_TRANSIENT_HEADROOM',
        tier: 'TIGHT_TOLERANCE',
        involvedSlots: ['PSU', 'GPU'],
        title: 'Narrow Transient Spike Power Headroom',
        explanation: `${wattage}W handles continuous load (${estimatedBaseWattage}W) but leaves narrow headroom for ${estimatedPeakTransientWattage}W microsecond GPU spikes.`,
        remediationSuggestion: `Consider stepping up to ${recommendedPsuWattage}W for silent fan operation and future upgrades.`
      });
    }

    const needs12v2x6 = gpu.filter((g) => g.specs.power_connector === '12V-2x6').length;
    const has12v2x6 = Number(psu.specs.pcie_12v2x6_connectors ?? 0);
    if (needs12v2x6 > has12v2x6) {
      issues.push({
        code: 'WARN_12V2X6_ADAPTER_REQUIRED',
        tier: 'TIGHT_TOLERANCE',
        involvedSlots: ['PSU', 'GPU'],
        title: 'Native 12V-2x6 Cable Count Short',
        explanation: `${needs12v2x6} GPU(s) need a 12V-2x6 connector; ${psu.name} provides ${has12v2x6} native cable(s).`,
        remediationSuggestion: 'Use the GPU-bundled adapter (technicians will seat-check it) or choose an ATX 3.1 unit with more native cables.'
      });
    }
    if (needs12v2x6 > 0 && String(psu.specs.atx_version ?? '') < '3.0') {
      issues.push({
        code: 'WARN_PSU_NOT_ATX3',
        tier: 'TIGHT_TOLERANCE',
        involvedSlots: ['PSU', 'GPU'],
        title: 'PSU Is Not ATX 3.x Certified',
        explanation: 'Pre-ATX 3.0 units are not specified for 200% transient excursions.',
        remediationSuggestion: 'Select an ATX 3.1 power supply.'
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* 5. SYSTEM COMPLETENESS                                               */
  /* ------------------------------------------------------------------ */
  const missingSlots: string[] = [];
  if (!cpu) missingSlots.push('CPU');
  if (!motherboard) missingSlots.push('MOTHERBOARD');
  if (ram.length === 0) missingSlots.push('RAM');
  if (storage.length === 0) missingSlots.push('STORAGE');
  if (!psu) missingSlots.push('PSU');
  if (!pcCase) missingSlots.push('CASE');
  if (!cooler && !(cpu?.specs.includes_cooler === true)) missingSlots.push('CPU_COOLER');
  if (gpu.length === 0 && !(cpu?.specs.integrated_graphics === true)) missingSlots.push('GPU');
  const isCompleteSystem = missingSlots.length === 0;

  if (fulfillmentMode === 'PRO_BUILT_FOUNDRY_RIG' && !isCompleteSystem) {
    issues.push({
      code: 'ERR_PRO_BUILT_INCOMPLETE',
      tier: 'HARD_CONFLICT',
      involvedSlots: missingSlots,
      title: `Pro-Built Rig Incomplete (${missingSlots.length} slot${missingSlots.length === 1 ? '' : 's'} empty)`,
      explanation: `Foundry assembly requires a complete bootable system. Missing: ${missingSlots.join(', ')}.`,
      remediationSuggestion: 'Fill the empty slots or switch to DIY Parts-Only dispatch.'
    });
  }

  const hasHardConflict = issues.some((i) => i.tier === 'HARD_CONFLICT');
  const hasTightTolerance = issues.some((i) => i.tier === 'TIGHT_TOLERANCE');

  return {
    canCheckout: !hasHardConflict,
    overallConfidence: hasHardConflict ? 'HARD_CONFLICT' : hasTightTolerance ? 'TIGHT_TOLERANCE' : 'VERIFIED_FIT',
    requiresTechnicianManualVerify: hasTightTolerance && fulfillmentMode === 'PRO_BUILT_FOUNDRY_RIG',
    estimatedBaseWattage,
    estimatedPeakTransientWattage,
    recommendedPsuWattage,
    autoInjectedLogisticsItems,
    issues,
    optionalServices,
    missingSlots,
    isCompleteSystem
  };
}

/** Build a manifest from a flat list of parts (cart lines / package components). */
export function manifestFromParts(
  parts: { part: EnginePart & { category: string }; quantity: number }[],
  fulfillmentMode: FulfillmentMode
): BuildManifest {
  const m: BuildManifest = { fulfillmentMode, ram: [], gpu: [], storage: [] };
  for (const { part, quantity } of parts) {
    const n = Math.max(1, quantity);
    switch (part.category) {
      case 'CPU':
        m.cpu = part;
        break;
      case 'MOTHERBOARD':
        m.motherboard = part;
        break;
      case 'CPU_COOLER':
        m.cooler = part;
        break;
      case 'PSU':
        m.psu = part;
        break;
      case 'CASE':
        m.pcCase = part;
        break;
      case 'RAM':
        for (let i = 0; i < n; i++) m.ram!.push(part);
        break;
      case 'GPU':
        for (let i = 0; i < n; i++) m.gpu!.push(part);
        break;
      case 'STORAGE':
        for (let i = 0; i < n; i++) m.storage!.push(part);
        break;
      default:
        break;
    }
  }
  return m;
}

/** Count of distinct "core" component categories present. Duplicates of single-slot parts are flagged separately. */
export function duplicateSingleSlotCategories(parts: { part: { category: string }; quantity: number }[]): string[] {
  const single = ['CPU', 'MOTHERBOARD', 'CPU_COOLER', 'PSU', 'CASE'];
  const counts = new Map<string, number>();
  for (const { part, quantity } of parts) counts.set(part.category, (counts.get(part.category) ?? 0) + quantity);
  return single.filter((c) => (counts.get(c) ?? 0) > 1);
}
