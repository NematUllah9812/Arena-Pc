import type { PartCategory, ProductSpecs } from '@/lib/types';
import { specLabel, specValue } from '@/lib/format';

const KEYS: Partial<Record<PartCategory, string[]>> = {
  CPU: ['cores', 'boost_clock_ghz', 'l3_cache_mb', 'socket', 'lithography'],
  GPU: ['vram_gb', 'boost_clock_mhz', 'length_mm', 'lithography', 'power_connector'],
  MOTHERBOARD: ['socket', 'chipset', 'form_factor', 'memory_type', 'has_bios_flashback_button'],
  RAM: ['capacity_gb', 'speed_mts', 'cas_latency', 'height_mm', 'profile'],
  CPU_COOLER: ['type', 'radiator_size_mm', 'height_mm', 'tdp_rating_watts', 'max_ram_height_clearance_mm'],
  STORAGE: ['capacity_gb', 'interface', 'read_mbps', 'write_mbps', 'tbw'],
  CASE: ['form_factor_support', 'max_gpu_length_mm', 'max_cpu_cooler_height_mm', 'supported_radiators_top_mm'],
  PSU: ['wattage', 'efficiency', 'atx_version', 'modular', 'form_factor'],
  CASE_FAN: ['size_mm', 'airflow_cfm', 'static_pressure_mmh2o', 'pack'],
  MONITOR: ['size_in', 'resolution', 'refresh_hz', 'panel', 'response_ms'],
  PERIPHERAL: ['type', 'switches', 'polling_hz', 'connection', 'weight_g'],
  OS: ['edition', 'license', 'architecture']
};

export function keySpecs(category: PartCategory, specs: ProductSpecs, max = 4): { label: string; value: string }[] {
  const keys = KEYS[category] ?? Object.keys(specs);
  return keys
    .filter((k) => specs[k] !== undefined && specs[k] !== null && specs[k] !== '')
    .slice(0, max)
    .map((k) => ({ label: specLabel(k), value: specValue(k, specs[k]) }));
}
