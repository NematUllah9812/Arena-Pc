import type { BuildBayStage, PartCategory } from '@/lib/types';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export const money = (cents: number) => usd.format(cents / 100);
export const money0 = (cents: number) => usd0.format(Math.round(cents / 100));

export const CATEGORY_LABEL: Record<PartCategory, string> = {
  CPU: 'Processors',
  CPU_COOLER: 'CPU Cooling',
  MOTHERBOARD: 'Motherboards',
  RAM: 'Memory',
  STORAGE: 'Storage',
  GPU: 'Graphics Cards',
  CASE: 'Chassis',
  PSU: 'Power Supplies',
  CASE_FAN: 'Case Fans',
  OS: 'Operating Systems',
  MONITOR: 'Monitors',
  PERIPHERAL: 'Peripherals',
  INTERNAL_BRACE: 'Logistics'
};

export const CATEGORY_CODE: Record<PartCategory, string> = {
  CPU: 'CPU',
  CPU_COOLER: 'CLR',
  MOTHERBOARD: 'MBD',
  RAM: 'MEM',
  STORAGE: 'NVM',
  GPU: 'GPU',
  CASE: 'CHS',
  PSU: 'PWR',
  CASE_FAN: 'FAN',
  OS: 'SYS',
  MONITOR: 'DSP',
  PERIPHERAL: 'PER',
  INTERNAL_BRACE: 'LOG'
};

/** URL slug ↔ category for /catalog/[category]. */
export const CATEGORY_SLUG: Record<Exclude<PartCategory, 'INTERNAL_BRACE'>, string> = {
  CPU: 'cpu',
  CPU_COOLER: 'cooling',
  MOTHERBOARD: 'motherboards',
  RAM: 'memory',
  STORAGE: 'storage',
  GPU: 'gpu',
  CASE: 'cases',
  PSU: 'power',
  CASE_FAN: 'fans',
  OS: 'os',
  MONITOR: 'monitors',
  PERIPHERAL: 'peripherals'
};

export const SLUG_CATEGORY = Object.fromEntries(Object.entries(CATEGORY_SLUG).map(([k, v]) => [v, k])) as Record<string, PartCategory>;

export const PUBLIC_CATEGORIES = Object.keys(CATEGORY_SLUG) as Exclude<PartCategory, 'INTERNAL_BRACE'>[];

export const STAGE_SHORT: Record<BuildBayStage, string> = {
  ORDER_CONFIRMED: 'CONFIRMED',
  PARTS_ALLOCATED_BIN_LOCKED: 'BIN LOCKED',
  BENCH_ASSEMBLY_IN_PROGRESS: 'ASSEMBLY',
  BIOS_FLASH_AND_EXPO_TUNING: 'BIOS / EXPO',
  OCCT_THERMAL_BURN_IN_4HR: 'BURN-IN',
  INSTAPAK_FOAM_CRATING: 'CRATING',
  DISPATCHED_CARRIER: 'DISPATCHED',
  DELIVERED: 'DELIVERED'
};

export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return '***';
  return `${user.slice(0, 1)}${'•'.repeat(Math.max(2, Math.min(6, user.length - 1)))}@${domain}`;
}

export function firstName(name: string): string {
  return (name || '').trim().split(/\s+/)[0] || 'Operator';
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: '2-digit', year: 'numeric' }): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', ...opts }).format(d);
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short'
  }).format(new Date(iso));
}

/** Human-readable spec label from a snake_case key. */
export function specLabel(key: string): string {
  const map: Record<string, string> = {
    tdp_watts: 'TDP',
    tdp_rating_watts: 'Rated TDP',
    memory_type: 'Memory',
    form_factor: 'Form Factor',
    form_factor_support: 'Board Support',
    max_gpu_length_mm: 'Max GPU Length',
    max_cpu_cooler_height_mm: 'Max Cooler Height',
    max_ram_height_clearance_mm: 'RAM Clearance',
    requires_bios_version: 'Min. BIOS',
    bios_version_shipped: 'BIOS Shipped',
    has_bios_flashback_button: 'BIOS FlashBack',
    supported_radiators_top_mm: 'Top Radiators',
    supported_radiators_front_mm: 'Front Radiators',
    speed_mts: 'Speed',
    cas_latency: 'CAS Latency',
    length_mm: 'Length',
    height_mm: 'Height',
    weight_grams: 'Weight',
    vram_gb: 'VRAM',
    boost_clock_ghz: 'Boost Clock',
    base_clock_ghz: 'Base Clock',
    cores: 'Cores',
    threads: 'Threads',
    l3_cache_mb: 'L3 Cache',
    wattage: 'Wattage',
    efficiency: 'Efficiency',
    capacity_gb: 'Capacity',
    read_mbps: 'Seq. Read',
    write_mbps: 'Seq. Write',
    radiator_size_mm: 'Radiator',
    boost_clock_mhz: 'Boost Clock',
    vram_type: 'VRAM Type',
    memory_bus_bit: 'Bus Width',
    power_connector: 'Power',
    slot_width: 'Slot Width',
    size_in: 'Size',
    refresh_hz: 'Refresh',
    response_ms: 'Response',
    polling_hz: 'Polling',
    weight_g: 'Weight',
    airflow_cfm: 'Airflow',
    static_pressure_mmh2o: 'Static Pressure',
    tbw: 'Endurance',
    noise_dba: 'Noise',
    volume_l: 'Volume',
    pcie_gen: 'PCIe Gen',
    pcie_x16_gen: 'PCIe x16',
    m2_slots: 'M.2 Slots',
    max_memory_gb: 'Max Memory',
    atx_version: 'ATX Spec',
    pcie_12v2x6_connectors: '12V-2x6',
    warranty_years: 'Warranty',
    psu_form_factor_support: 'PSU Support',
    dpi_max: 'Max DPI',
    radiator_thickness_mm: 'Rad. Thickness',
    supported_sockets: 'Sockets'
  };
  return map[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function specValue(key: string, value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? 'YES' : 'NO';
  if (Array.isArray(value)) return value.join(' / ');
  if (typeof value === 'number') {
    if (key.endsWith('_mm')) return `${value} mm`;
    if (key.endsWith('_watts') || key === 'wattage') return `${value} W`;
    if (key.endsWith('_grams')) return `${value} g`;
    if (key.endsWith('_gb')) return value >= 1000 ? `${value / 1000} TB` : `${value} GB`;
    if (key.endsWith('_mb')) return `${value} MB`;
    if (key.endsWith('_mbps')) return `${value.toLocaleString()} MB/s`;
    if (key.endsWith('_ghz')) return `${value} GHz`;
    if (key.endsWith('_mhz')) return `${value.toLocaleString()} MHz`;
    if (key.endsWith('_hz')) return `${value.toLocaleString()} Hz`;
    if (key === 'size_in') return `${value}"`;
    if (key === 'response_ms') return `${value} ms`;
    if (key === 'weight_g') return `${value} g`;
    if (key === 'tbw') return `${value.toLocaleString()} TBW`;
    if (key === 'airflow_cfm') return `${value} CFM`;
    if (key === 'noise_dba') return `${value} dBA`;
    if (key === 'volume_l') return `${value} L`;
    if (key === 'memory_bus_bit') return `${value}-bit`;
    if (key === 'warranty_years') return `${value} yr`;
    if (key === 'static_pressure_mmh2o') return `${value} mmH₂O`;
    if (key === 'speed_mts') return `${value} MT/s`;
    if (key === 'cas_latency') return `CL${value}`;
    return value.toLocaleString();
  }
  return String(value);
}
