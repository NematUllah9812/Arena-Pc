import type { PartCategory, Product, ProductSpecs } from '@/lib/types';
import { stableUuid } from './stable-id';

/**
 * VORTEX LABS — seeded hardware catalog.
 * Every SKU carries full physical tolerances (mm / grams / watts), commercial
 * columns (cost, inventory age, overstock flags) and a warehouse bin so the
 * compatibility engine, Auto-Forge optimizer and Overseer console operate on
 * real data from the first boot.
 */

const CATEGORY_IMAGE: Record<PartCategory, string> = {
  CPU: '/media/cat-cpu.webp',
  CPU_COOLER: '/media/cat-cooler.webp',
  MOTHERBOARD: '/media/cat-motherboard.webp',
  RAM: '/media/cat-ram.webp',
  STORAGE: '/media/cat-storage.webp',
  GPU: '/media/cat-gpu.webp',
  CASE: '/media/cat-case.webp',
  PSU: '/media/cat-psu.webp',
  CASE_FAN: '/media/cat-fan.svg',
  OS: '/media/cat-os.svg',
  MONITOR: '/media/cat-monitor.svg',
  PERIPHERAL: '/media/cat-peripheral.svg',
  INTERNAL_BRACE: '/media/cat-brace.svg'
};

interface SeedInput {
  sku: string;
  name: string;
  brand: string;
  category: PartCategory;
  price: number; // USD
  sale?: number | null; // USD
  cost: number; // USD
  stock: number;
  bin: string;
  days?: number;
  overstock?: boolean;
  clearance?: boolean;
  weight: number;
  perf: number;
  tdp?: number;
  gamingWeight?: number;
  workstationWeight?: number;
  specs: ProductSpecs;
  description: string;
}

const SEED_EPOCH = '2026-09-01T00:00:00.000Z';

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function p(i: SeedInput): Product {
  return {
    id: stableUuid(i.sku),
    sku: i.sku,
    name: i.name,
    slug: slugify(i.name),
    brand: i.brand,
    category: i.category,
    base_price_cents: Math.round(i.price * 100),
    sale_price_cents: i.sale != null ? Math.round(i.sale * 100) : null,
    cost_price_cents: Math.round(i.cost * 100),
    dual_admin_price_override_token: null,
    stock_quantity: i.stock,
    reserved_quantity: 0,
    warehouse_bin: i.bin,
    days_in_inventory: i.days ?? 21,
    overstock_priority: i.overstock ?? false,
    is_leftover_clearance: i.clearance ?? false,
    is_active: true,
    weight_grams: i.weight,
    performance_score: i.perf,
    gaming_tier_weight: i.gamingWeight ?? 1,
    workstation_tier_weight: i.workstationWeight ?? 1,
    tdp_watts: i.tdp ?? 0,
    primary_image_url: CATEGORY_IMAGE[i.category],
    gallery_urls: [],
    model_3d_glb_url: null,
    specs: i.specs,
    description: i.description,
    created_at: SEED_EPOCH,
    updated_at: SEED_EPOCH
  };
}

const BOTH_SOCKETS = ['AM5', 'LGA1851'];

export const SEED_PRODUCTS: Product[] = [
  /* ============================== CPU ============================== */
  p({
    sku: 'VL-CPU-9950X3D', name: 'AMD Ryzen 9 9950X3D', brand: 'AMD', category: 'CPU',
    price: 699, cost: 572, stock: 14, bin: 'A1-04', days: 18, weight: 52, perf: 9800, tdp: 170, workstationWeight: 1.35,
    specs: { socket: 'AM5', architecture: 'Zen 5 + 2nd-Gen 3D V-Cache', cores: 16, threads: 32, base_clock_ghz: 4.3, boost_clock_ghz: 5.7, l3_cache_mb: 128, lithography: 'TSMC N4P', memory_type: 'DDR5', integrated_graphics: true, includes_cooler: false, requires_bios_version: 3001, pcie_gen: 5 },
    description: 'Sixteen Zen 5 cores with stacked 3D V-Cache on the compute die — the no-compromise chip for 4K gaming rigs that also render, compile and stream.'
  }),
  p({
    sku: 'VL-CPU-9800X3D', name: 'AMD Ryzen 7 9800X3D', brand: 'AMD', category: 'CPU',
    price: 479, cost: 401, stock: 22, bin: 'A1-05', days: 9, weight: 48, perf: 9450, tdp: 120,
    specs: { socket: 'AM5', architecture: 'Zen 5 + 2nd-Gen 3D V-Cache', cores: 8, threads: 16, base_clock_ghz: 4.7, boost_clock_ghz: 5.2, l3_cache_mb: 96, lithography: 'TSMC N4P', memory_type: 'DDR5', integrated_graphics: true, includes_cooler: false, requires_bios_version: 2401, pcie_gen: 5 },
    description: 'The current esports frame-time king. 96MB of L3 keeps 1% lows locked on high-refresh panels.'
  }),
  p({
    sku: 'VL-CPU-9900X', name: 'AMD Ryzen 9 9900X', brand: 'AMD', category: 'CPU',
    price: 399, sale: 359, cost: 301, stock: 17, bin: 'A1-06', days: 64, weight: 48, perf: 8350, tdp: 120, workstationWeight: 1.25,
    specs: { socket: 'AM5', architecture: 'Zen 5', cores: 12, threads: 24, base_clock_ghz: 4.4, boost_clock_ghz: 5.6, l3_cache_mb: 64, lithography: 'TSMC N4P', memory_type: 'DDR5', integrated_graphics: true, includes_cooler: false, requires_bios_version: 1801, pcie_gen: 5 },
    description: 'Twelve Zen 5 cores for creators who game — strong multi-thread throughput at a sane 120W.'
  }),
  p({
    sku: 'VL-CPU-9700X', name: 'AMD Ryzen 7 9700X', brand: 'AMD', category: 'CPU',
    price: 299, cost: 236, stock: 26, bin: 'A1-07', days: 47, weight: 48, perf: 7850, tdp: 65,
    specs: { socket: 'AM5', architecture: 'Zen 5', cores: 8, threads: 16, base_clock_ghz: 3.8, boost_clock_ghz: 5.5, l3_cache_mb: 32, lithography: 'TSMC N4P', memory_type: 'DDR5', integrated_graphics: true, includes_cooler: false, requires_bios_version: 1801, pcie_gen: 5 },
    description: 'Efficient eight-core Zen 5 with a 65W default envelope — runs cool in compact builds.'
  }),
  p({
    sku: 'VL-CPU-9600X', name: 'AMD Ryzen 5 9600X', brand: 'AMD', category: 'CPU',
    price: 219, sale: 199, cost: 168, stock: 31, bin: 'A1-08', days: 39, weight: 48, perf: 7150, tdp: 65,
    specs: { socket: 'AM5', architecture: 'Zen 5', cores: 6, threads: 12, base_clock_ghz: 3.9, boost_clock_ghz: 5.4, l3_cache_mb: 32, lithography: 'TSMC N4P', memory_type: 'DDR5', integrated_graphics: true, includes_cooler: false, requires_bios_version: 1801, pcie_gen: 5 },
    description: 'The 1080p esports entry point on AM5 with a long upgrade runway.'
  }),
  p({
    sku: 'VL-CPU-7800X3D', name: 'AMD Ryzen 7 7800X3D', brand: 'AMD', category: 'CPU',
    price: 369, cost: 318, stock: 41, bin: 'A2-11', days: 142, overstock: true, weight: 48, perf: 8950, tdp: 120,
    specs: { socket: 'AM5', architecture: 'Zen 4 + 3D V-Cache', cores: 8, threads: 16, base_clock_ghz: 4.2, boost_clock_ghz: 5.0, l3_cache_mb: 96, lithography: 'TSMC N5', memory_type: 'DDR5', integrated_graphics: true, includes_cooler: false, requires_bios_version: 1001, pcie_gen: 5 },
    description: 'Last-gen V-Cache legend. Still within a few percent of the newest chips in most titles.'
  }),
  p({
    sku: 'VL-CPU-7600', name: 'AMD Ryzen 5 7600', brand: 'AMD', category: 'CPU',
    price: 179, cost: 151, stock: 19, bin: 'A2-12', days: 188, overstock: true, clearance: true, weight: 160, perf: 6450, tdp: 65,
    specs: { socket: 'AM5', architecture: 'Zen 4', cores: 6, threads: 12, base_clock_ghz: 3.8, boost_clock_ghz: 5.1, l3_cache_mb: 32, lithography: 'TSMC N5', memory_type: 'DDR5', integrated_graphics: true, includes_cooler: true, bundled_cooler: 'AMD Wraith Stealth', requires_bios_version: 1001, pcie_gen: 5 },
    description: 'Budget AM5 six-core with a boxed Wraith Stealth cooler. Leftover clearance stock.'
  }),
  p({
    sku: 'VL-CPU-285K', name: 'Intel Core Ultra 9 285K', brand: 'Intel', category: 'CPU',
    price: 549, sale: 519, cost: 452, stock: 12, bin: 'A3-02', days: 96, overstock: true, weight: 50, perf: 8700, tdp: 250, workstationWeight: 1.4,
    specs: { socket: 'LGA1851', architecture: 'Arrow Lake-S', cores: 24, threads: 24, p_cores: 8, e_cores: 16, base_clock_ghz: 3.7, boost_clock_ghz: 5.7, l3_cache_mb: 36, lithography: 'TSMC N3B', memory_type: 'DDR5', integrated_graphics: true, includes_cooler: false, requires_bios_version: 1001, npu: true, pcie_gen: 5 },
    description: '24-core Arrow Lake flagship with an on-die NPU — built for AI workstation pipelines.'
  }),
  p({
    sku: 'VL-CPU-265K', name: 'Intel Core Ultra 7 265K', brand: 'Intel', category: 'CPU',
    price: 339, sale: 299, cost: 248, stock: 18, bin: 'A3-03', days: 110, overstock: true, weight: 50, perf: 8150, tdp: 250, workstationWeight: 1.25,
    specs: { socket: 'LGA1851', architecture: 'Arrow Lake-S', cores: 20, threads: 20, p_cores: 8, e_cores: 12, base_clock_ghz: 3.9, boost_clock_ghz: 5.5, l3_cache_mb: 30, lithography: 'TSMC N3B', memory_type: 'DDR5', integrated_graphics: true, includes_cooler: false, requires_bios_version: 1001, npu: true, pcie_gen: 5 },
    description: 'Twenty cores of Arrow Lake at a mid-range price. Excellent value for hybrid creator rigs.'
  }),
  p({
    sku: 'VL-CPU-245K', name: 'Intel Core Ultra 5 245K', brand: 'Intel', category: 'CPU',
    price: 259, cost: 205, stock: 15, bin: 'A3-04', days: 77, weight: 50, perf: 7400, tdp: 159,
    specs: { socket: 'LGA1851', architecture: 'Arrow Lake-S', cores: 14, threads: 14, p_cores: 6, e_cores: 8, base_clock_ghz: 4.2, boost_clock_ghz: 5.2, l3_cache_mb: 24, lithography: 'TSMC N3B', memory_type: 'DDR5', integrated_graphics: true, includes_cooler: false, requires_bios_version: 1001, npu: true, pcie_gen: 5 },
    description: 'Fourteen-core LGA1851 entry chip with full PCIe 5.0 lanes.'
  }),

  /* ============================== GPU ============================== */
  p({
    sku: 'VL-GPU-5090-ASTRAL', name: 'ASUS ROG Astral GeForce RTX 5090 OC', brand: 'ASUS', category: 'GPU',
    price: 3299, cost: 2840, stock: 4, bin: 'A4-99', days: 12, weight: 3050, perf: 10000, tdp: 600, workstationWeight: 1.3,
    specs: { chipset: 'GeForce RTX 5090', architecture: 'Blackwell', vram_gb: 32, vram_type: 'GDDR7', memory_bus_bit: 512, boost_clock_mhz: 2610, length_mm: 358, slot_width: 3.8, power_connector: '12V-2x6', lithography: 'TSMC 4N', fans: 4, outputs: '2x HDMI 2.1b, 3x DP 2.1b' },
    description: 'Quad-fan vapor-chamber flagship. At 3.05kg it triggers our mandatory Instapak transit brace on every Pro-Built rig.'
  }),
  p({
    sku: 'VL-GPU-5090-FE', name: 'NVIDIA GeForce RTX 5090 Founders Edition', brand: 'NVIDIA', category: 'GPU',
    price: 1999, cost: 1880, stock: 2, bin: 'A4-97', days: 5, weight: 1800, perf: 9850, tdp: 575, workstationWeight: 1.3,
    specs: { chipset: 'GeForce RTX 5090', architecture: 'Blackwell', vram_gb: 32, vram_type: 'GDDR7', memory_bus_bit: 512, boost_clock_mhz: 2410, length_mm: 304, slot_width: 2, power_connector: '12V-2x6', lithography: 'TSMC 4N', fans: 2, outputs: '1x HDMI 2.1b, 3x DP 2.1b' },
    description: 'Dual-slot double flow-through design — the densest 5090 for small-form-factor foundry builds.'
  }),
  p({
    sku: 'VL-GPU-5080-TRIO', name: 'MSI GeForce RTX 5080 Gaming Trio OC', brand: 'MSI', category: 'GPU',
    price: 1249, sale: 1179, cost: 1012, stock: 9, bin: 'A4-81', days: 58, weight: 1550, perf: 8250, tdp: 360,
    specs: { chipset: 'GeForce RTX 5080', architecture: 'Blackwell', vram_gb: 16, vram_type: 'GDDR7', memory_bus_bit: 256, boost_clock_mhz: 2730, length_mm: 338, slot_width: 3, power_connector: '12V-2x6', lithography: 'TSMC 4N', fans: 3, outputs: '1x HDMI 2.1b, 3x DP 2.1b' },
    description: 'High-refresh 1440p and entry 4K with DLSS 4 Multi Frame Generation.'
  }),
  p({
    sku: 'VL-GPU-5070TI-GOC', name: 'Gigabyte GeForce RTX 5070 Ti Gaming OC', brand: 'Gigabyte', category: 'GPU',
    price: 849, cost: 712, stock: 13, bin: 'A4-72', days: 33, weight: 1420, perf: 7300, tdp: 300,
    specs: { chipset: 'GeForce RTX 5070 Ti', architecture: 'Blackwell', vram_gb: 16, vram_type: 'GDDR7', memory_bus_bit: 256, boost_clock_mhz: 2588, length_mm: 340, slot_width: 3, power_connector: '12V-2x6', lithography: 'TSMC 4N', fans: 3, outputs: '1x HDMI 2.1b, 3x DP 2.1b' },
    description: 'The 1440p sweet spot: 16GB GDDR7 and a WINDFORCE triple-fan cooler.'
  }),
  p({
    sku: 'VL-GPU-5070-PRIME', name: 'ASUS Prime GeForce RTX 5070 OC', brand: 'ASUS', category: 'GPU',
    price: 599, cost: 503, stock: 16, bin: 'A4-64', days: 41, weight: 1050, perf: 6300, tdp: 250,
    specs: { chipset: 'GeForce RTX 5070', architecture: 'Blackwell', vram_gb: 12, vram_type: 'GDDR7', memory_bus_bit: 192, boost_clock_mhz: 2610, length_mm: 304, slot_width: 2.5, power_connector: '12V-2x6', lithography: 'TSMC 4N', fans: 3, outputs: '1x HDMI 2.1b, 3x DP 2.1b' },
    description: 'SFF-ready 2.5-slot card with axial-tech fans for efficient 1440p.'
  }),
  p({
    sku: 'VL-GPU-5060TI-TWIN', name: 'ZOTAC GeForce RTX 5060 Ti 16GB Twin Edge', brand: 'ZOTAC', category: 'GPU',
    price: 449, sale: 429, cost: 371, stock: 24, bin: 'A4-51', days: 52, weight: 650, perf: 4800, tdp: 180,
    specs: { chipset: 'GeForce RTX 5060 Ti', architecture: 'Blackwell', vram_gb: 16, vram_type: 'GDDR7', memory_bus_bit: 128, boost_clock_mhz: 2602, length_mm: 221, slot_width: 2, power_connector: '8-pin x1', lithography: 'TSMC 4N', fans: 2, outputs: '1x HDMI 2.1b, 3x DP 2.1b' },
    description: 'Compact 16GB card that pins 1080p esports titles well above 240 FPS.'
  }),
  p({
    sku: 'VL-GPU-9070XT-NITRO', name: 'Sapphire NITRO+ AMD Radeon RX 9070 XT', brand: 'Sapphire', category: 'GPU',
    price: 799, cost: 672, stock: 11, bin: 'A5-22', days: 37, weight: 1690, perf: 7200, tdp: 340,
    specs: { chipset: 'Radeon RX 9070 XT', architecture: 'RDNA 4', vram_gb: 16, vram_type: 'GDDR6', memory_bus_bit: 256, boost_clock_mhz: 3060, length_mm: 320, slot_width: 3, power_connector: '12V-2x6', lithography: 'TSMC N4P', fans: 3, outputs: '2x HDMI 2.1b, 2x DP 2.1a' },
    description: 'RDNA 4 with FSR 4 and a hidden 12V-2x6 connector behind a magnetic backplate.'
  }),
  p({
    sku: 'VL-GPU-9070-HELLHOUND', name: 'PowerColor Hellhound Radeon RX 9070', brand: 'PowerColor', category: 'GPU',
    price: 599, sale: 569, cost: 489, stock: 28, bin: 'A5-18', days: 123, overstock: true, weight: 1290, perf: 6550, tdp: 220,
    specs: { chipset: 'Radeon RX 9070', architecture: 'RDNA 4', vram_gb: 16, vram_type: 'GDDR6', memory_bus_bit: 256, boost_clock_mhz: 2700, length_mm: 330, slot_width: 2.5, power_connector: '8-pin x2', lithography: 'TSMC N4P', fans: 3, outputs: '1x HDMI 2.1b, 3x DP 2.1a' },
    description: 'Quiet, cool 16GB 1440p card. Overstock allocation — frequently featured in flash drops.'
  }),
  p({
    sku: 'VL-GPU-9060XT-SWIFT', name: 'XFX Swift Radeon RX 9060 XT 16GB', brand: 'XFX', category: 'GPU',
    price: 369, cost: 309, stock: 20, bin: 'A5-09', days: 44, weight: 850, perf: 4550, tdp: 160,
    specs: { chipset: 'Radeon RX 9060 XT', architecture: 'RDNA 4', vram_gb: 16, vram_type: 'GDDR6', memory_bus_bit: 128, boost_clock_mhz: 3130, length_mm: 260, slot_width: 2, power_connector: '8-pin x1', lithography: 'TSMC N4P', fans: 2, outputs: '1x HDMI 2.1b, 2x DP 2.1a' },
    description: 'Value 1080p champion with a full 16GB frame buffer.'
  }),

  /* =========================== MOTHERBOARD ========================= */
  p({
    sku: 'VL-MB-X870E-HERO', name: 'ASUS ROG Crosshair X870E Hero', brand: 'ASUS', category: 'MOTHERBOARD',
    price: 699, cost: 571, stock: 7, bin: 'B1-02', days: 29, weight: 1780, perf: 9200,
    specs: { socket: 'AM5', chipset: 'X870E', form_factor: 'ATX', memory_type: 'DDR5', memory_slots: 4, max_memory_gb: 256, m2_slots: 5, pcie_x16_gen: 5, wifi: 'Wi-Fi 7', lan: '5GbE + 2.5GbE', usb4: true, bios_version_shipped: 3001, has_bios_flashback_button: true },
    description: '22+2+2 power stages, dual USB4 and five M.2 slots. Ships with BIOS v3001 ready for every Zen 5 X3D chip.'
  }),
  p({
    sku: 'VL-MB-X870-TOMAHAWK', name: 'MSI MAG X870 Tomahawk WiFi', brand: 'MSI', category: 'MOTHERBOARD',
    price: 289, cost: 232, stock: 18, bin: 'B1-07', days: 36, weight: 1450, perf: 8400,
    specs: { socket: 'AM5', chipset: 'X870', form_factor: 'ATX', memory_type: 'DDR5', memory_slots: 4, max_memory_gb: 256, m2_slots: 4, pcie_x16_gen: 5, wifi: 'Wi-Fi 7', lan: '5GbE', usb4: true, bios_version_shipped: 2401, has_bios_flashback_button: true },
    description: 'The foundry workhorse for AM5 builds — robust VRM, USB4, and a Flash BIOS button.'
  }),
  p({
    sku: 'VL-MB-B850-AORUS', name: 'Gigabyte B850 AORUS Elite WiFi7', brand: 'Gigabyte', category: 'MOTHERBOARD',
    price: 239, sale: 219, cost: 181, stock: 21, bin: 'B1-11', days: 61, weight: 1320, perf: 7900,
    specs: { socket: 'AM5', chipset: 'B850', form_factor: 'ATX', memory_type: 'DDR5', memory_slots: 4, max_memory_gb: 256, m2_slots: 3, pcie_x16_gen: 5, wifi: 'Wi-Fi 7', lan: '2.5GbE', usb4: false, bios_version_shipped: 2401, has_bios_flashback_button: true },
    description: 'PCIe 5.0 GPU and M.2 on a B-series budget, with Q-Flash Plus CPU-less updating.'
  }),
  p({
    sku: 'VL-MB-B650M-PRORS', name: 'ASRock B650M Pro RS', brand: 'ASRock', category: 'MOTHERBOARD',
    price: 139, sale: 119, cost: 108, stock: 33, bin: 'B2-31', days: 214, overstock: true, clearance: true, weight: 980, perf: 6800,
    specs: { socket: 'AM5', chipset: 'B650', form_factor: 'MATX', memory_type: 'DDR5', memory_slots: 4, max_memory_gb: 192, m2_slots: 2, pcie_x16_gen: 4, wifi: 'None', lan: '2.5GbE', usb4: false, bios_version_shipped: 1636, has_bios_flashback_button: false },
    description: 'Leftover warehouse stock shipped with factory BIOS v1636 — requires a pre-flash for Ryzen 9000 chips and has no FlashBack header.'
  }),
  p({
    sku: 'VL-MB-B650-GPLUS', name: 'MSI B650 Gaming Plus WiFi', brand: 'MSI', category: 'MOTHERBOARD',
    price: 169, cost: 132, stock: 26, bin: 'B2-28', days: 131, overstock: true, weight: 1150, perf: 7100,
    specs: { socket: 'AM5', chipset: 'B650', form_factor: 'ATX', memory_type: 'DDR5', memory_slots: 4, max_memory_gb: 192, m2_slots: 2, pcie_x16_gen: 4, wifi: 'Wi-Fi 6E', lan: '2.5GbE', usb4: false, bios_version_shipped: 1636, has_bios_flashback_button: true },
    description: 'Value ATX board with a rear Flash BIOS button — DIY builders can self-update for Zen 5.'
  }),
  p({
    sku: 'VL-MB-B850I-STRIX', name: 'ASUS ROG Strix B850-I Gaming WiFi', brand: 'ASUS', category: 'MOTHERBOARD',
    price: 319, cost: 262, stock: 6, bin: 'B1-15', days: 27, weight: 720, perf: 8100,
    specs: { socket: 'AM5', chipset: 'B850', form_factor: 'ITX', memory_type: 'DDR5', memory_slots: 2, max_memory_gb: 128, m2_slots: 2, pcie_x16_gen: 5, wifi: 'Wi-Fi 7', lan: '2.5GbE', usb4: false, bios_version_shipped: 2401, has_bios_flashback_button: true },
    description: 'Mini-ITX with a stacked M.2 riser card — the brain of our SFF foundry rigs.'
  }),
  p({
    sku: 'VL-MB-Z890-HERO', name: 'ASUS ROG Maximus Z890 Hero', brand: 'ASUS', category: 'MOTHERBOARD',
    price: 629, sale: 589, cost: 508, stock: 5, bin: 'B3-04', days: 102, weight: 1820, perf: 9100,
    specs: { socket: 'LGA1851', chipset: 'Z890', form_factor: 'ATX', memory_type: 'DDR5', memory_slots: 4, max_memory_gb: 256, m2_slots: 6, pcie_x16_gen: 5, wifi: 'Wi-Fi 7', lan: '5GbE + 2.5GbE', usb4: true, thunderbolt: 'Thunderbolt 5', bios_version_shipped: 1201, has_bios_flashback_button: true },
    description: 'Thunderbolt 5, six M.2 slots and a 22+1+2+2 VRM for sustained 250W Arrow Lake loads.'
  }),
  p({
    sku: 'VL-MB-Z890-TOMAHAWK', name: 'MSI MAG Z890 Tomahawk WiFi', brand: 'MSI', category: 'MOTHERBOARD',
    price: 309, cost: 249, stock: 11, bin: 'B3-09', days: 88, weight: 1460, perf: 8300,
    specs: { socket: 'LGA1851', chipset: 'Z890', form_factor: 'ATX', memory_type: 'DDR5', memory_slots: 4, max_memory_gb: 256, m2_slots: 4, pcie_x16_gen: 5, wifi: 'Wi-Fi 7', lan: '5GbE', usb4: false, thunderbolt: 'Thunderbolt 4', bios_version_shipped: 1201, has_bios_flashback_button: true },
    description: 'Balanced Z890 platform with EZ PCIe release and Flash BIOS button.'
  }),
  p({
    sku: 'VL-MB-B860M-AORUS', name: 'Gigabyte B860M AORUS Elite WiFi6E', brand: 'Gigabyte', category: 'MOTHERBOARD',
    price: 179, cost: 141, stock: 14, bin: 'B3-14', days: 70, weight: 1010, perf: 7300,
    specs: { socket: 'LGA1851', chipset: 'B860', form_factor: 'MATX', memory_type: 'DDR5', memory_slots: 4, max_memory_gb: 256, m2_slots: 3, pcie_x16_gen: 5, wifi: 'Wi-Fi 6E', lan: '2.5GbE', usb4: false, bios_version_shipped: 1201, has_bios_flashback_button: true },
    description: 'Micro-ATX LGA1851 board for compact Intel builds.'
  }),

  /* =============================== RAM ============================= */
  p({
    sku: 'VL-RAM-TZ5N-32-6000', name: 'G.Skill Trident Z5 Neo RGB 32GB (2x16GB) DDR5-6000 CL30', brand: 'G.Skill', category: 'RAM',
    price: 119, cost: 92, stock: 46, bin: 'C1-03', days: 25, weight: 110, perf: 8600,
    specs: { memory_type: 'DDR5', capacity_gb: 32, modules: 2, speed_mts: 6000, cas_latency: 30, timings: '30-38-38-96', voltage: 1.35, profile: 'AMD EXPO', height_mm: 44, rgb: true },
    description: 'The AM5 sweet-spot kit: 6000 MT/s CL30 on Hynix A-die, validated with EXPO.'
  }),
  p({
    sku: 'VL-RAM-DOMTI-64-6400', name: 'Corsair Dominator Titanium RGB 64GB (2x32GB) DDR5-6400 CL32', brand: 'Corsair', category: 'RAM',
    price: 259, cost: 204, stock: 12, bin: 'C1-09', days: 40, weight: 150, perf: 9000, workstationWeight: 1.3,
    specs: { memory_type: 'DDR5', capacity_gb: 64, modules: 2, speed_mts: 6400, cas_latency: 32, timings: '32-40-40-84', voltage: 1.4, profile: 'Intel XMP 3.0 / AMD EXPO', height_mm: 56, rgb: true },
    description: 'Tall 56mm machined-aluminum heatspreaders — check air-cooler clearance before pairing.'
  }),
  p({
    sku: 'VL-RAM-FURY-32-6000', name: 'Kingston FURY Beast 32GB (2x16GB) DDR5-6000 CL36', brand: 'Kingston', category: 'RAM',
    price: 94, sale: 86, cost: 70, stock: 58, bin: 'C1-14', days: 73, weight: 90, perf: 7700,
    specs: { memory_type: 'DDR5', capacity_gb: 32, modules: 2, speed_mts: 6000, cas_latency: 36, timings: '36-38-38-80', voltage: 1.35, profile: 'Intel XMP 3.0 / AMD EXPO', height_mm: 34.9, rgb: false },
    description: 'Low-profile 34.9mm modules that clear every tower cooler we stock.'
  }),
  p({
    sku: 'VL-RAM-VENG-32-6000', name: 'Corsair Vengeance RGB 32GB (2x16GB) DDR5-6000 CL30', brand: 'Corsair', category: 'RAM',
    price: 109, cost: 85, stock: 37, bin: 'C1-17', days: 51, weight: 100, perf: 8500,
    specs: { memory_type: 'DDR5', capacity_gb: 32, modules: 2, speed_mts: 6000, cas_latency: 30, timings: '30-36-36-76', voltage: 1.4, profile: 'Intel XMP 3.0 / AMD EXPO', height_mm: 44, rgb: true },
    description: 'Ten-zone RGB lightbar and tight CL30 timings.'
  }),
  p({
    sku: 'VL-RAM-DELTA-64-6000', name: 'TeamGroup T-Force Delta RGB 64GB (2x32GB) DDR5-6000 CL30', brand: 'TeamGroup', category: 'RAM',
    price: 199, sale: 179, cost: 151, stock: 22, bin: 'C2-02', days: 109, overstock: true, weight: 120, perf: 8800, workstationWeight: 1.25,
    specs: { memory_type: 'DDR5', capacity_gb: 64, modules: 2, speed_mts: 6000, cas_latency: 30, timings: '30-36-36-76', voltage: 1.35, profile: 'AMD EXPO', height_mm: 46.1, rgb: true },
    description: '64GB at CL30 for creators who keep forty browser tabs, OBS and a game open.'
  }),
  p({
    sku: 'VL-RAM-FLAREX5-32-6000', name: 'G.Skill Flare X5 32GB (2x16GB) DDR5-6000 CL30', brand: 'G.Skill', category: 'RAM',
    price: 104, cost: 79, stock: 29, bin: 'C2-07', days: 66, weight: 80, perf: 8550,
    specs: { memory_type: 'DDR5', capacity_gb: 32, modules: 2, speed_mts: 6000, cas_latency: 30, timings: '30-36-36-96', voltage: 1.35, profile: 'AMD EXPO', height_mm: 33, rgb: false },
    description: '33mm low-profile EXPO kit — zero fan-offset risk under dual-tower coolers.'
  }),
  p({
    sku: 'VL-RAM-TZ5-96-6400', name: 'G.Skill Trident Z5 RGB 96GB (2x48GB) DDR5-6400 CL32', brand: 'G.Skill', category: 'RAM',
    price: 299, cost: 238, stock: 9, bin: 'C2-12', days: 34, weight: 120, perf: 9100, workstationWeight: 1.5,
    specs: { memory_type: 'DDR5', capacity_gb: 96, modules: 2, speed_mts: 6400, cas_latency: 32, timings: '32-39-39-102', voltage: 1.35, profile: 'Intel XMP 3.0', height_mm: 44, rgb: true },
    description: 'Non-binary 48GB DIMMs: 96GB in two sticks for local LLM inference workstations.'
  }),
  p({
    sku: 'VL-RAM-LPX-32-3600', name: 'Corsair Vengeance LPX 32GB (2x16GB) DDR4-3600 CL18', brand: 'Corsair', category: 'RAM',
    price: 69, sale: 54, cost: 48, stock: 17, bin: 'C9-01', days: 301, overstock: true, clearance: true, weight: 80, perf: 5200,
    specs: { memory_type: 'DDR4', capacity_gb: 32, modules: 2, speed_mts: 3600, cas_latency: 18, timings: '18-22-22-42', voltage: 1.35, profile: 'Intel XMP 2.0', height_mm: 34, rgb: false },
    description: 'Legacy DDR4 clearance for upgrade customers on older AM4 / LGA1700 platforms. Not compatible with any AM5 or LGA1851 board.'
  }),

  /* ============================= STORAGE =========================== */
  p({
    sku: 'VL-SSD-9100PRO-2TB', name: 'Samsung 9100 PRO 2TB PCIe 5.0 NVMe', brand: 'Samsung', category: 'STORAGE',
    price: 249, cost: 196, stock: 19, bin: 'D1-02', days: 31, weight: 9, perf: 9600,
    specs: { type: 'NVME_M2', interface: 'PCIe 5.0 x4', form_factor: 'M.2 2280', capacity_gb: 2000, read_mbps: 14700, write_mbps: 13400, tbw: 1200, dram_cache: true, heatsink: false },
    description: 'Samsung\u2019s Presto controller pushing 14.7 GB/s sequential reads.'
  }),
  p({
    sku: 'VL-SSD-990PRO-2TB', name: 'Samsung 990 PRO 2TB PCIe 4.0 NVMe', brand: 'Samsung', category: 'STORAGE',
    price: 169, sale: 149, cost: 124, stock: 44, bin: 'D1-05', days: 82, weight: 9, perf: 8400,
    specs: { type: 'NVME_M2', interface: 'PCIe 4.0 x4', form_factor: 'M.2 2280', capacity_gb: 2000, read_mbps: 7450, write_mbps: 6900, tbw: 1200, dram_cache: true, heatsink: false },
    description: 'The reference Gen4 drive — consistent, cool, and DirectStorage-ready.'
  }),
  p({
    sku: 'VL-SSD-SN850X-1TB', name: 'WD_BLACK SN850X 1TB PCIe 4.0 NVMe', brand: 'WD', category: 'STORAGE',
    price: 89, cost: 66, stock: 52, bin: 'D1-09', days: 57, weight: 8, perf: 7900,
    specs: { type: 'NVME_M2', interface: 'PCIe 4.0 x4', form_factor: 'M.2 2280', capacity_gb: 1000, read_mbps: 7300, write_mbps: 6300, tbw: 600, dram_cache: true, heatsink: false },
    description: 'Game Mode 2.0 predictive loading in a proven 1TB boot drive.'
  }),
  p({
    sku: 'VL-SSD-SN8100-2TB', name: 'WD_BLACK SN8100 2TB PCIe 5.0 NVMe', brand: 'WD', category: 'STORAGE',
    price: 259, cost: 205, stock: 10, bin: 'D1-12', days: 22, weight: 9, perf: 9650,
    specs: { type: 'NVME_M2', interface: 'PCIe 5.0 x4', form_factor: 'M.2 2280', capacity_gb: 2000, read_mbps: 14900, write_mbps: 14000, tbw: 1200, dram_cache: true, heatsink: false },
    description: 'Gen5 speed without the furnace — efficient enough to run without an active heatsink.'
  }),
  p({
    sku: 'VL-SSD-T705-4TB', name: 'Crucial T705 4TB PCIe 5.0 NVMe', brand: 'Crucial', category: 'STORAGE',
    price: 479, cost: 389, stock: 6, bin: 'D2-03', days: 49, weight: 52, perf: 9500, workstationWeight: 1.3,
    specs: { type: 'NVME_M2', interface: 'PCIe 5.0 x4', form_factor: 'M.2 2280', capacity_gb: 4000, read_mbps: 14500, write_mbps: 12700, tbw: 2400, dram_cache: true, heatsink: true },
    description: '4TB of Gen5 scratch space for 8K timelines and model checkpoints.'
  }),
  p({
    sku: 'VL-SSD-P3PLUS-2TB', name: 'Crucial P3 Plus 2TB PCIe 4.0 NVMe', brand: 'Crucial', category: 'STORAGE',
    price: 109, sale: 99, cost: 81, stock: 63, bin: 'D2-08', days: 156, overstock: true, weight: 8, perf: 6600,
    specs: { type: 'NVME_M2', interface: 'PCIe 4.0 x4', form_factor: 'M.2 2280', capacity_gb: 2000, read_mbps: 5000, write_mbps: 4200, tbw: 440, dram_cache: false, heatsink: false },
    description: 'Big, affordable game library drive. Overstock allocation.'
  }),
  p({
    sku: 'VL-SSD-870EVO-2TB', name: 'Samsung 870 EVO 2TB SATA SSD', brand: 'Samsung', category: 'STORAGE',
    price: 149, cost: 117, stock: 15, bin: 'D3-01', days: 120, weight: 46, perf: 5100,
    specs: { type: 'SATA_SSD', interface: 'SATA III 6Gb/s', form_factor: '2.5"', capacity_gb: 2000, read_mbps: 560, write_mbps: 530, tbw: 1200, dram_cache: true, heatsink: false },
    description: 'Reliable 2.5" SATA archive drive for capture footage and backups.'
  }),
  p({
    sku: 'VL-SSD-530R-4TB', name: 'Seagate FireCuda 530R 4TB PCIe 4.0 NVMe', brand: 'Seagate', category: 'STORAGE',
    price: 329, cost: 262, stock: 8, bin: 'D2-14', days: 63, weight: 8, perf: 8300,
    specs: { type: 'NVME_M2', interface: 'PCIe 4.0 x4', form_factor: 'M.2 2280', capacity_gb: 4000, read_mbps: 7400, write_mbps: 7000, tbw: 5100, dram_cache: true, heatsink: false },
    description: 'Record-breaking 5,100 TBW endurance for heavy-write workstation workloads.'
  }),

  /* ============================ CPU_COOLER ========================= */
  p({
    sku: 'VL-COOL-NHD15G2', name: 'Noctua NH-D15 G2', brand: 'Noctua', category: 'CPU_COOLER',
    price: 149, cost: 112, stock: 16, bin: 'E1-01', days: 45, weight: 1760, perf: 9000,
    specs: { type: 'AIR', supported_sockets: BOTH_SOCKETS, tdp_rating_watts: 250, height_mm: 168, max_ram_height_clearance_mm: 32, fan_count: 2, fan_size_mm: 140, noise_dba: 24.8 },
    description: 'Dual-tower, eight heatpipes, two NF-A14x25r G2 fans. Front fan sits over the DIMM slots — 32mm RAM clearance in standard position.'
  }),
  p({
    sku: 'VL-COOL-PA120SE', name: 'Thermalright Peerless Assassin 120 SE', brand: 'Thermalright', category: 'CPU_COOLER',
    price: 39, cost: 24, stock: 71, bin: 'E1-06', days: 38, weight: 980, perf: 8100,
    specs: { type: 'AIR', supported_sockets: BOTH_SOCKETS, tdp_rating_watts: 245, height_mm: 155, max_ram_height_clearance_mm: 52, fan_count: 2, fan_size_mm: 120, noise_dba: 25.6 },
    description: 'The best-value dual-tower ever made. 52mm offset RAM clearance.'
  }),
  p({
    sku: 'VL-COOL-DRP5', name: 'be quiet! Dark Rock Pro 5', brand: 'be quiet!', category: 'CPU_COOLER',
    price: 99, sale: 89, cost: 71, stock: 13, bin: 'E1-09', days: 99, overstock: true, weight: 1250, perf: 8700,
    specs: { type: 'AIR', supported_sockets: BOTH_SOCKETS, tdp_rating_watts: 270, height_mm: 168, max_ram_height_clearance_mm: 40, fan_count: 2, fan_size_mm: 135, noise_dba: 23.3 },
    description: 'Whisper-quiet dual-tower with a black-coated fin stack.'
  }),
  p({
    sku: 'VL-COOL-NHL9A-AM5', name: 'Noctua NH-L9a-AM5 chromax.black', brand: 'Noctua', category: 'CPU_COOLER',
    price: 54, cost: 38, stock: 10, bin: 'E1-12', days: 71, weight: 465, perf: 5200,
    specs: { type: 'AIR', supported_sockets: ['AM5'], tdp_rating_watts: 95, height_mm: 37, max_ram_height_clearance_mm: 99, fan_count: 1, fan_size_mm: 92, noise_dba: 23.6 },
    description: '37mm low-profile cooler for 65W chips in ultra-slim ITX chassis.'
  }),
  p({
    sku: 'VL-COOL-LF3PRO-360', name: 'Arctic Liquid Freezer III Pro 360', brand: 'Arctic', category: 'CPU_COOLER',
    price: 119, cost: 86, stock: 24, bin: 'E2-03', days: 54, weight: 2110, perf: 9400,
    specs: { type: 'AIO_LIQUID', supported_sockets: BOTH_SOCKETS, tdp_rating_watts: 330, radiator_size_mm: 360, radiator_thickness_mm: 63, fan_count: 3, fan_size_mm: 120, noise_dba: 22.5, vrm_fan: true },
    description: '38mm-thick radiator + 25mm fans (63mm stack) and an integrated VRM fan.'
  }),
  p({
    sku: 'VL-COOL-KRAKEN-ELITE-360', name: 'NZXT Kraken Elite 360 RGB', brand: 'NZXT', category: 'CPU_COOLER',
    price: 299, sale: 269, cost: 221, stock: 9, bin: 'E2-07', days: 87, weight: 1950, perf: 9300,
    specs: { type: 'AIO_LIQUID', supported_sockets: BOTH_SOCKETS, tdp_rating_watts: 320, radiator_size_mm: 360, radiator_thickness_mm: 52, fan_count: 3, fan_size_mm: 120, noise_dba: 26, lcd_display: '2.72" 640x640' },
    description: 'Pump-head LCD that can mirror live CPU telemetry from our burn-in profile.'
  }),
  p({
    sku: 'VL-COOL-TITAN-360RX', name: 'Corsair iCUE LINK TITAN 360 RX RGB', brand: 'Corsair', category: 'CPU_COOLER',
    price: 219, cost: 168, stock: 11, bin: 'E2-10', days: 43, weight: 2010, perf: 9350,
    specs: { type: 'AIO_LIQUID', supported_sockets: BOTH_SOCKETS, tdp_rating_watts: 340, radiator_size_mm: 360, radiator_thickness_mm: 52, fan_count: 3, fan_size_mm: 120, noise_dba: 24 },
    description: 'FlowDrive pump and single-cable iCUE LINK daisy-chain — tidy enough for 250W Arrow Lake loads.'
  }),
  p({
    sku: 'VL-COOL-GALAHAD2-240', name: 'Lian Li Galahad II Trinity 240', brand: 'Lian Li', category: 'CPU_COOLER',
    price: 129, cost: 95, stock: 14, bin: 'E2-14', days: 92, weight: 1350, perf: 8300,
    specs: { type: 'AIO_LIQUID', supported_sockets: BOTH_SOCKETS, tdp_rating_watts: 260, radiator_size_mm: 240, radiator_thickness_mm: 57, fan_count: 2, fan_size_mm: 120, noise_dba: 27 },
    description: '240mm AIO sized for ITX top-mount brackets.'
  }),

  /* =============================== CASE ============================ */
  p({
    sku: 'VL-CASE-O11EVO-RGB', name: 'Lian Li O11 Dynamic EVO RGB', brand: 'Lian Li', category: 'CASE',
    price: 189, cost: 141, stock: 12, bin: 'F1-01', days: 59, weight: 13200, perf: 8800,
    specs: { form_factor_support: ['E-ATX', 'ATX', 'MATX', 'ITX'], psu_form_factor_support: ['ATX', 'SFX'], max_gpu_length_mm: 422, max_cpu_cooler_height_mm: 167, supported_radiators_top_mm: [240, 280, 360], supported_radiators_front_mm: [240, 280, 360], included_fans: 0, side_panel: 'Tempered Glass', volume_l: 66 },
    description: 'Dual-chamber showcase chassis with reversible layout and a 422mm GPU runway.'
  }),
  p({
    sku: 'VL-CASE-NORTHXL', name: 'Fractal Design North XL', brand: 'Fractal Design', category: 'CASE',
    price: 189, sale: 169, cost: 134, stock: 10, bin: 'F1-04', days: 84, weight: 13500, perf: 8700,
    specs: { form_factor_support: ['E-ATX', 'ATX', 'MATX', 'ITX'], psu_form_factor_support: ['ATX'], max_gpu_length_mm: 413, max_cpu_cooler_height_mm: 185, supported_radiators_top_mm: [240, 280, 360], supported_radiators_front_mm: [240, 280, 360, 420], included_fans: 3, side_panel: 'Tempered Glass', volume_l: 71 },
    description: 'Walnut front, mesh airflow, three 140mm fans included.'
  }),
  p({
    sku: 'VL-CASE-H6FLOW', name: 'NZXT H6 Flow RGB', brand: 'NZXT', category: 'CASE',
    price: 139, cost: 104, stock: 18, bin: 'F1-08', days: 46, weight: 8700, perf: 8000,
    specs: { form_factor_support: ['ATX', 'MATX', 'ITX'], psu_form_factor_support: ['ATX'], max_gpu_length_mm: 365, max_cpu_cooler_height_mm: 163, supported_radiators_top_mm: [240, 280, 360], supported_radiators_front_mm: [240, 280, 360], included_fans: 3, side_panel: 'Tempered Glass', volume_l: 48 },
    description: 'Wraparound glass with angled RGB intake fans aimed straight at the GPU.'
  }),
  p({
    sku: 'VL-CASE-Y70-TOUCH', name: 'HYTE Y70 Touch Infinite', brand: 'HYTE', category: 'CASE',
    price: 369, cost: 296, stock: 4, bin: 'F1-12', days: 67, weight: 16500, perf: 9000,
    specs: { form_factor_support: ['E-ATX', 'ATX', 'MATX', 'ITX'], psu_form_factor_support: ['ATX'], max_gpu_length_mm: 422, max_cpu_cooler_height_mm: 180, supported_radiators_top_mm: [240, 280, 360], supported_radiators_front_mm: [], included_fans: 0, side_panel: 'Panoramic Glass + 14.1" Touchscreen', volume_l: 72, vertical_gpu: true },
    description: 'Panoramic glass with an integrated touchscreen that can display live system telemetry.'
  }),
  p({
    sku: 'VL-CASE-4000D-RS', name: 'Corsair 4000D RS ARGB', brand: 'Corsair', category: 'CASE',
    price: 104, cost: 77, stock: 27, bin: 'F2-02', days: 113, overstock: true, weight: 7800, perf: 7600,
    specs: { form_factor_support: ['ATX', 'MATX', 'ITX'], psu_form_factor_support: ['ATX'], max_gpu_length_mm: 360, max_cpu_cooler_height_mm: 170, supported_radiators_top_mm: [240, 280], supported_radiators_front_mm: [240, 280, 360], included_fans: 3, side_panel: 'Tempered Glass', volume_l: 47 },
    description: 'Proven airflow mid-tower. 360mm GPU limit — tight with flagship 4-fan cards.'
  }),
  p({
    sku: 'VL-CASE-A4H2O', name: 'Lian Li A4-H2O', brand: 'Lian Li', category: 'CASE',
    price: 159, cost: 118, stock: 7, bin: 'F2-06', days: 76, weight: 3200, perf: 7800,
    specs: { form_factor_support: ['ITX'], psu_form_factor_support: ['SFX'], max_gpu_length_mm: 322, max_cpu_cooler_height_mm: 55, supported_radiators_top_mm: [240], supported_radiators_front_mm: [], included_fans: 0, side_panel: 'Mesh / Glass', volume_l: 11 },
    description: '11-litre sandwich-layout SFF chassis with PCIe 4.0 riser and 240mm AIO support.'
  }),
  p({
    sku: 'VL-CASE-KING95PRO', name: 'Montech KING 95 PRO', brand: 'Montech', category: 'CASE',
    price: 139, sale: 119, cost: 98, stock: 22, bin: 'F2-11', days: 167, overstock: true, clearance: true, weight: 12100, perf: 7900,
    specs: { form_factor_support: ['E-ATX', 'ATX', 'MATX', 'ITX'], psu_form_factor_support: ['ATX'], max_gpu_length_mm: 420, max_cpu_cooler_height_mm: 175, supported_radiators_top_mm: [240, 280, 360], supported_radiators_front_mm: [240, 280, 360], included_fans: 6, side_panel: 'Curved Tempered Glass', volume_l: 68 },
    description: 'Curved-glass dual-chamber with six ARGB fans included. Leftover clearance.'
  }),

  /* =============================== PSU ============================= */
  p({
    sku: 'VL-PSU-RM850X-SHIFT', name: 'Corsair RM850x Shift ATX 3.1', brand: 'Corsair', category: 'PSU',
    price: 139, cost: 106, stock: 25, bin: 'G1-02', days: 52, weight: 1900, perf: 8200,
    specs: { wattage: 850, efficiency: '80+ Gold', atx_version: '3.1', pcie_12v2x6_connectors: 1, modular: 'Full (side connectors)', form_factor: 'ATX', fan_mm: 140, warranty_years: 10 },
    description: 'Side-mounted modular connectors for clean dual-chamber routing.'
  }),
  p({
    sku: 'VL-PSU-RM1000X', name: 'Corsair RM1000x ATX 3.1', brand: 'Corsair', category: 'PSU',
    price: 189, cost: 145, stock: 18, bin: 'G1-05', days: 61, weight: 1950, perf: 8600,
    specs: { wattage: 1000, efficiency: '80+ Gold', atx_version: '3.1', pcie_12v2x6_connectors: 1, modular: 'Full', form_factor: 'ATX', fan_mm: 140, warranty_years: 10 },
    description: 'Cybenetics Platinum-rated 1000W with native 12V-2x6.'
  }),
  p({
    sku: 'VL-PSU-VERTEX-GX1200', name: 'Seasonic Vertex GX-1200 ATX 3.1', brand: 'Seasonic', category: 'PSU',
    price: 269, cost: 211, stock: 8, bin: 'G1-09', days: 74, weight: 2300, perf: 8900,
    specs: { wattage: 1200, efficiency: '80+ Gold', atx_version: '3.1', pcie_12v2x6_connectors: 1, modular: 'Full', form_factor: 'ATX', fan_mm: 135, warranty_years: 12 },
    description: '1200W with a 12-year warranty and excellent transient response.'
  }),
  p({
    sku: 'VL-PSU-DP14-1000', name: 'be quiet! Dark Power 14 1000W', brand: 'be quiet!', category: 'PSU',
    price: 279, cost: 219, stock: 6, bin: 'G1-12', days: 58, weight: 2400, perf: 9100,
    specs: { wattage: 1000, efficiency: '80+ Titanium', atx_version: '3.1', pcie_12v2x6_connectors: 1, modular: 'Full', form_factor: 'ATX', fan_mm: 135, warranty_years: 10 },
    description: 'Titanium efficiency and near-silent operation under gaming loads.'
  }),
  p({
    sku: 'VL-PSU-A850G', name: 'MSI MPG A850G PCIE5', brand: 'MSI', category: 'PSU',
    price: 119, sale: 109, cost: 89, stock: 34, bin: 'G2-03', days: 139, overstock: true, weight: 1800, perf: 7900,
    specs: { wattage: 850, efficiency: '80+ Gold', atx_version: '3.0', pcie_12v2x6_connectors: 1, modular: 'Full', form_factor: 'ATX', fan_mm: 135, warranty_years: 10 },
    description: 'Dependable 850W ATX 3.0 unit. Overstock allocation.'
  }),
  p({
    sku: 'VL-PSU-GFA3-750', name: 'Thermaltake Toughpower GF A3 750W', brand: 'Thermaltake', category: 'PSU',
    price: 99, cost: 74, stock: 21, bin: 'G2-07', days: 95, weight: 1700, perf: 7300,
    specs: { wattage: 750, efficiency: '80+ Gold', atx_version: '3.1', pcie_12v2x6_connectors: 1, modular: 'Full', form_factor: 'ATX', fan_mm: 120, warranty_years: 10 },
    description: 'Compact 750W ATX 3.1 for 1080p and mid-range 1440p rigs.'
  }),
  p({
    sku: 'VL-PSU-HX1500I', name: 'Corsair HX1500i ATX 3.1', brand: 'Corsair', category: 'PSU',
    price: 349, cost: 276, stock: 5, bin: 'G1-15', days: 49, weight: 2900, perf: 9300,
    specs: { wattage: 1500, efficiency: '80+ Platinum', atx_version: '3.1', pcie_12v2x6_connectors: 2, modular: 'Full', form_factor: 'ATX', fan_mm: 140, warranty_years: 10 },
    description: '1500W digital PSU with iCUE power telemetry for dual-GPU AI workstations.'
  }),
  p({
    sku: 'VL-PSU-THOR-1600', name: 'ASUS ROG Thor 1600W Titanium III', brand: 'ASUS', category: 'PSU',
    price: 549, cost: 441, stock: 3, bin: 'G1-18', days: 81, weight: 3500, perf: 9600,
    specs: { wattage: 1600, efficiency: '80+ Titanium', atx_version: '3.1', pcie_12v2x6_connectors: 2, modular: 'Full', form_factor: 'ATX', fan_mm: 135, warranty_years: 10, oled_display: true },
    description: 'GaN MOSFETs, OLED live wattage readout and two 12V-2x6 connectors.'
  }),
  p({
    sku: 'VL-PSU-SP850-SFX', name: 'Lian Li SP850 SFX', brand: 'Lian Li', category: 'PSU',
    price: 159, cost: 121, stock: 9, bin: 'G2-12', days: 69, weight: 980, perf: 8400,
    specs: { wattage: 850, efficiency: '80+ Gold', atx_version: '3.1', pcie_12v2x6_connectors: 1, modular: 'Full', form_factor: 'SFX', fan_mm: 92, warranty_years: 7 },
    description: '850W in the SFX footprint for SFF foundry rigs.'
  }),

  /* ============================ CASE_FAN =========================== */
  p({
    sku: 'VL-FAN-UNITL120-3', name: 'Lian Li UNI FAN TL 120 (3-Pack)', brand: 'Lian Li', category: 'CASE_FAN',
    price: 89, cost: 64, stock: 30, bin: 'H1-02', days: 57, weight: 600, perf: 8200,
    specs: { size_mm: 120, pack: 3, airflow_cfm: 64.5, static_pressure_mmh2o: 2.95, rpm_max: 2600, rgb: true, connector: 'Daisy-chain' },
    description: 'Daisy-chained interlocking fans — fewer cables behind the motherboard tray.'
  }),
  p({
    sku: 'VL-FAN-NFA12X25G2', name: 'Noctua NF-A12x25 G2 PWM', brand: 'Noctua', category: 'CASE_FAN',
    price: 39, cost: 27, stock: 48, bin: 'H1-05', days: 40, weight: 180, perf: 9100,
    specs: { size_mm: 120, pack: 1, airflow_cfm: 71, static_pressure_mmh2o: 3.2, rpm_max: 2000, rgb: false, connector: '4-pin PWM' },
    description: 'Second-generation reference 120mm fan with 0.5mm tip clearance.'
  }),
  p({
    sku: 'VL-FAN-P12PRO-5', name: 'Arctic P12 Pro PST (5-Pack)', brand: 'Arctic', category: 'CASE_FAN',
    price: 44, cost: 30, stock: 39, bin: 'H1-08', days: 118, overstock: true, weight: 750, perf: 7800,
    specs: { size_mm: 120, pack: 5, airflow_cfm: 77, static_pressure_mmh2o: 4.0, rpm_max: 3000, rgb: false, connector: '4-pin PWM (PST)' },
    description: 'High static pressure value pack for radiator and mesh-front builds.'
  }),

  /* ================================ OS ============================= */
  p({
    sku: 'VL-OS-WIN11-HOME', name: 'Microsoft Windows 11 Home (Foundry Pre-Install)', brand: 'Microsoft', category: 'OS',
    price: 139, cost: 101, stock: 500, bin: 'DIGITAL', days: 10, weight: 0, perf: 5000,
    specs: { edition: 'Home', license: 'OEM Digital', architecture: '64-bit', preinstalled_on_pro_built: true },
    description: 'Activated, debloated and driver-updated during the BIOS/EXPO tuning stage.'
  }),
  p({
    sku: 'VL-OS-WIN11-PRO', name: 'Microsoft Windows 11 Pro (Foundry Pre-Install)', brand: 'Microsoft', category: 'OS',
    price: 199, cost: 146, stock: 500, bin: 'DIGITAL', days: 10, weight: 0, perf: 6000,
    specs: { edition: 'Pro', license: 'OEM Digital', architecture: '64-bit', preinstalled_on_pro_built: true, bitlocker: true, hyper_v: true },
    description: 'BitLocker, Hyper-V and Remote Desktop for workstation rigs.'
  }),

  /* ============================= MONITOR =========================== */
  p({
    sku: 'VL-MON-PG27UCDM', name: 'ASUS ROG Swift OLED PG27UCDM 27" 4K 240Hz', brand: 'ASUS', category: 'MONITOR',
    price: 1099, sale: 999, cost: 842, stock: 7, bin: 'J1-02', days: 72, weight: 6800, perf: 9500,
    specs: { size_in: 27, resolution: '3840x2160', refresh_hz: 240, panel: 'QD-OLED', response_ms: 0.03, hdr: 'DisplayHDR True Black 400', ports: 'DP 1.4, 2x HDMI 2.1, USB-C 90W' },
    description: '4K 240Hz QD-OLED with uniform-brightness mode for competitive and cinematic play.'
  }),
  p({
    sku: 'VL-MON-G60SF-500', name: 'Samsung Odyssey OLED G6 27" QHD 500Hz', brand: 'Samsung', category: 'MONITOR',
    price: 799, cost: 638, stock: 9, bin: 'J1-05', days: 55, weight: 5600, perf: 9200,
    specs: { size_in: 27, resolution: '2560x1440', refresh_hz: 500, panel: 'QD-OLED', response_ms: 0.03, hdr: 'DisplayHDR True Black 400', ports: 'DP 1.4, 2x HDMI 2.1' },
    description: '500Hz QD-OLED — pairs with an X3D CPU for absurd esports frame rates.'
  }),

  /* =========================== PERIPHERAL ========================== */
  p({
    sku: 'VL-PER-WOOTING80HE', name: 'Wooting 80HE Analog Keyboard', brand: 'Wooting', category: 'PERIPHERAL',
    price: 199, cost: 152, stock: 14, bin: 'K1-01', days: 33, weight: 1100, perf: 9300,
    specs: { type: 'Keyboard', layout: '75% (80 keys)', switches: 'Lekker L60 V2 Hall-effect', polling_hz: 8000, rapid_trigger: true, connection: 'USB-C' },
    description: 'Hall-effect rapid trigger with 0.1mm actuation and 8kHz polling.'
  }),
  p({
    sku: 'VL-PER-GPXSL2C', name: 'Logitech G PRO X Superlight 2c', brand: 'Logitech', category: 'PERIPHERAL',
    price: 129, cost: 97, stock: 20, bin: 'K1-04', days: 61, weight: 51, perf: 9000,
    specs: { type: 'Mouse', weight_g: 51, sensor: 'HERO 2', dpi_max: 44000, polling_hz: 8000, connection: 'LIGHTSPEED Wireless' },
    description: '51g compact wireless mouse with 8kHz LIGHTSPEED polling.'
  }),

  /* ========================= INTERNAL_BRACE ======================== */
  p({
    sku: 'VL-PACK-INSTAPAK-BRACE', name: 'Instapak Quick RT Molded GPU Transit Brace + Anti-Sag Bracket', brand: 'Vortex Labs', category: 'INTERNAL_BRACE',
    price: 0, cost: 6.4, stock: 240, bin: 'Z9-PACK', days: 14, weight: 220, perf: 0,
    specs: { material: 'Instapak Quick RT expanding polyurethane foam', applies_to: 'GPU mass >= 1200g on Pro-Built rigs', bracket: 'Adjustable aluminum anti-sag', reusable: false },
    description: 'Auto-injected logistics consumable that eliminates PCIe slot shear during carrier transit. Included in the Pro-Built SLA.'
  })
];

export const PRODUCT_BY_SKU = new Map(SEED_PRODUCTS.map((x) => [x.sku, x]));

export function seedProduct(sku: string): Product {
  const found = PRODUCT_BY_SKU.get(sku);
  if (!found) throw new Error(`Unknown seed SKU ${sku}`);
  return found;
}
