/* ------------------------------------------------------------------ */
/* VORTEX LABS — shared domain types (mirrors supabase/migrations DDL) */
/* ------------------------------------------------------------------ */

export const PART_CATEGORIES = [
  'CPU',
  'CPU_COOLER',
  'MOTHERBOARD',
  'RAM',
  'STORAGE',
  'GPU',
  'CASE',
  'PSU',
  'CASE_FAN',
  'OS',
  'MONITOR',
  'PERIPHERAL',
  'INTERNAL_BRACE'
] as const;
export type PartCategory = (typeof PART_CATEGORIES)[number];

export const BUILD_TIERS = ['ESPORTS_1080P', 'COMPETITIVE_1440P', 'APEX_4K', 'WORKSTATION_AI', 'EXTREME_CUSTOM_LOOP'] as const;
export type BuildTier = (typeof BUILD_TIERS)[number];

export type FulfillmentMode = 'DIY_PARTS_ONLY' | 'PRO_BUILT_FOUNDRY_RIG';

export const BUILD_BAY_STAGES = [
  'ORDER_CONFIRMED',
  'PARTS_ALLOCATED_BIN_LOCKED',
  'BENCH_ASSEMBLY_IN_PROGRESS',
  'BIOS_FLASH_AND_EXPO_TUNING',
  'OCCT_THERMAL_BURN_IN_4HR',
  'INSTAPAK_FOAM_CRATING',
  'DISPATCHED_CARRIER',
  'DELIVERED'
] as const;
export type BuildBayStage = (typeof BUILD_BAY_STAGES)[number];

export type ConfidenceTier = 'VERIFIED_FIT' | 'TIGHT_TOLERANCE' | 'HARD_CONFLICT';

/** Polymorphic spec bag (JSONB `specs` column). Keys are category specific. */
export type ProductSpecs = Record<string, any>;

/** Full product row — includes protected commercial columns. SERVER ONLY. */
export interface Product {
  id: string;
  sku: string;
  name: string;
  slug: string;
  brand: string;
  category: PartCategory;
  base_price_cents: number;
  sale_price_cents: number | null;
  cost_price_cents: number;
  dual_admin_price_override_token?: string | null;
  stock_quantity: number;
  reserved_quantity: number;
  warehouse_bin: string;
  days_in_inventory: number;
  overstock_priority: boolean;
  is_leftover_clearance: boolean;
  is_active: boolean;
  weight_grams: number;
  performance_score: number;
  gaming_tier_weight: number;
  workstation_tier_weight: number;
  tdp_watts: number;
  primary_image_url: string;
  gallery_urls: string[];
  model_3d_glb_url: string | null;
  specs: ProductSpecs;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

/** Columns that never cross the server → browser boundary (cost, margin, velocity, warehouse ops). */
export const INTERNAL_PRODUCT_KEYS = ['cost_price_cents', 'dual_admin_price_override_token', 'days_in_inventory', 'overstock_priority', 'stock_quantity', 'reserved_quantity'] as const;

/** Storefront-safe projection: no cost / margin / velocity / raw stock columns (customers see available_quantity). */
export type PublicProduct = Omit<Product, (typeof INTERNAL_PRODUCT_KEYS)[number]> & {
  available_quantity: number;
};

export interface FlashDeal {
  id: string;
  product_id: string;
  deal_title: string;
  deal_price_cents: number;
  max_claims: number;
  claimed_count: number;
  reserved_claims: number;
  starts_at: string;
  expires_at: string;
  banner_accent_hex: string;
  is_active: boolean;
  created_at: string;
}

export interface FlashDealWithProduct extends FlashDeal {
  product: PublicProduct;
}

export interface SyndicatePackage {
  id: string;
  slug: string;
  name: string;
  tier: BuildTier;
  tagline: string;
  description: string;
  hero_accent_hex: string;
  component_skus: string[];
  target_fps_note: string;
  is_active: boolean;
  sort_order: number;
}

export interface SyndicatePackageResolved extends SyndicatePackage {
  components: PublicProduct[];
  parts_total_cents: number;
  assembly_fee_waived_cents: number;
  in_stock: boolean;
}

export type ReservationStatus = 'ACTIVE' | 'CONVERTED' | 'EXPIRED' | 'RELEASED';

export interface InventoryReservation {
  id: string;
  session_id: string;
  product_id: string;
  flash_deal_id: string | null;
  quantity: number;
  locked_price_cents: number;
  status: ReservationStatus;
  expires_at: string;
  created_at: string;
}

export interface ShippingAddress {
  full_name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postal_code: string;
  country: string;
}

export interface ManifestLine {
  product_id: string;
  sku: string;
  name: string;
  brand: string;
  category: PartCategory;
  quantity: number;
  unit_price_cents: number;
  flash_deal_id: string | null;
  warehouse_bin: string;
  weight_grams: number;
}

export interface OrderServiceLine {
  code: string;
  name: string;
  price_cents: number;
  reason: string;
}

export interface ManifestSnapshot {
  lines: ManifestLine[];
  services: OrderServiceLine[];
  compatibility: {
    overall: ConfidenceTier;
    estimated_base_wattage: number;
    estimated_peak_transient_wattage: number;
    recommended_psu_wattage: number;
    issues: { code: string; tier: ConfidenceTier; title: string; remediation: string }[];
  } | null;
  syndicate_package_slug: string | null;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string | null;
  customer_email: string;
  customer_name: string;
  shipping_address: ShippingAddress;
  fulfillment_type: FulfillmentMode;
  includes_bios_preflash_service: boolean;
  includes_foam_gpu_brace: boolean;
  assembly_fee_cents: number;
  services_fee_cents: number;
  subtotal_cents: number;
  total_charged_cents: number;
  current_stage: BuildBayStage;
  assigned_technician_code: string | null;
  estimated_dispatch_date: string;
  carrier: string | null;
  carrier_tracking_number: string | null;
  manifest_snapshot: ManifestSnapshot;
  compatibility_confidence: ConfidenceTier;
  requires_tech_clearance_check: boolean;
  syndicate_package_slug: string | null;
  created_at: string;
  updated_at: string;
}

export interface TelemetryMetrics {
  idle_cpu_temp_c?: number | null;
  peak_occt_cpu_temp_c?: number | null;
  peak_furmark_gpu_temp_c?: number | null;
  expo_xmp_profile_verified?: string | null;
  time_spy_score?: number | null;
  bios_version_flashed?: string | null;
  bench_bay_id?: string | null;
  serials?: Record<string, string>;
  thermal_curve?: { t: number; cpu: number; gpu: number }[];
  foam_brace_molded?: boolean;
  crate_sealed?: boolean;
  carrier?: string | null;
  tracking_number?: string | null;
  [key: string]: unknown;
}

export interface BuildBayTelemetryLog {
  id: string;
  order_id: string;
  stage: BuildBayStage;
  technician_code: string;
  telemetry_metrics: TelemetryMetrics;
  proof_screenshot_url: string | null;
  technician_notes: string | null;
  logged_at: string;
}

/** Public, PII-minimised view of an order for the Rig Forge Live tracker. */
export interface PublicTelemetryView {
  order_number: string;
  fulfillment_type: FulfillmentMode;
  current_stage: BuildBayStage;
  stage_sequence: BuildBayStage[];
  assigned_technician_code: string | null;
  estimated_dispatch_date: string;
  carrier: string | null;
  carrier_tracking_number: string | null;
  compatibility_confidence: ConfidenceTier;
  requires_tech_clearance_check: boolean;
  includes_foam_gpu_brace: boolean;
  includes_bios_preflash_service: boolean;
  customer_first_name: string;
  masked_email: string;
  manifest: ManifestSnapshot;
  total_charged_cents: number;
  created_at: string;
  logs: BuildBayTelemetryLog[];
}

export type AdminRole = 'OVERSEER' | 'INVENTORY_COMMANDER' | 'PRICING_OPS' | 'LEAD_TECHNICIAN';

export interface AdminVaultUser {
  id: string;
  codename: string;
  role: AdminRole;
  webauthn_credential_id: string;
  webauthn_public_key: string;
  webauthn_sign_count: number;
  webauthn_transports: string[];
  totp_secret_encrypted: string;
  allowed_ips: string[];
  last_login_at: string | null;
  is_locked: boolean;
  created_at: string;
}

export interface AdminAuditLog {
  id: string;
  admin_id: string;
  admin_codename?: string;
  action_type: string;
  target_entity: string;
  target_id: string | null;
  previous_state: unknown;
  new_state: unknown;
  ip_address: string;
  executed_at: string;
}

export interface PriceOverrideApproval {
  token: string;
  product_id: string;
  min_price_cents: number;
  approver_admin_id: string;
  approver_codename: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
}

export interface HardwareFacet {
  category: PartCategory;
  brand: string;
  cpu_socket: string | null;
  memory_type: string | null;
  form_factor: string | null;
  is_leftover_clearance: boolean;
  total_skus: number;
  in_stock_skus: number;
  min_price_cents: number;
  max_price_cents: number;
}

export interface CatalogQuery {
  category?: PartCategory;
  q?: string;
  brands?: string[];
  socket?: string;
  memoryType?: string;
  formFactor?: string;
  inStockOnly?: boolean;
  clearanceOnly?: boolean;
  minPriceCents?: number;
  maxPriceCents?: number;
  sort?: 'featured' | 'price_asc' | 'price_desc' | 'performance' | 'newest';
  limit?: number;
}
