-- =====================================================================
-- VORTEX LABS // PROJECT HYPERION — Schema v2.0 (Spec §4)
-- Supabase PostgreSQL. Idempotent where practical.
--
-- Deviations from the written spec (all intentional fixes):
--  * gen_random_uuid() (core) instead of uuid_generate_v4(); extensions live
--    in the `extensions` schema as Supabase requires.
--  * mv_hardware_facets coalesces nullable spec keys *inside* the view so the
--    unique index is column-only — REFRESH ... CONCURRENTLY rejects expression
--    indexes, so the spec's COALESCE() index could never refresh concurrently.
--  * products.description, orders shipping/totals columns, WebAuthn public
--    key + counter columns, and a price_override_approvals ledger were added
--    so every spec feature has somewhere to persist its data.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS btree_gin WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. ENUMERATIONS -----------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.part_category AS ENUM (
    'CPU', 'CPU_COOLER', 'MOTHERBOARD', 'RAM', 'STORAGE',
    'GPU', 'CASE', 'PSU', 'CASE_FAN', 'OS', 'MONITOR', 'PERIPHERAL', 'INTERNAL_BRACE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.build_tier AS ENUM (
    'ESPORTS_1080P', 'COMPETITIVE_1440P', 'APEX_4K', 'WORKSTATION_AI', 'EXTREME_CUSTOM_LOOP'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fulfillment_mode AS ENUM (
    'DIY_PARTS_ONLY',           -- Ships unbuilt in retail boxes (optional $15 BIOS pre-flash)
    'PRO_BUILT_FOUNDRY_RIG'     -- Full assembly ($149 fee), cable management, 72h burn-in, foam brace
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.build_bay_stage AS ENUM (
    'ORDER_CONFIRMED',
    'PARTS_ALLOCATED_BIN_LOCKED',
    'BENCH_ASSEMBLY_IN_PROGRESS',
    'BIOS_FLASH_AND_EXPO_TUNING',
    'OCCT_THERMAL_BURN_IN_4HR',
    'INSTAPAK_FOAM_CRATING',
    'DISPATCHED_CARRIER',
    'DELIVERED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. HARDWARE CATALOG -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(32) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  brand VARCHAR(64) NOT NULL,
  category public.part_category NOT NULL,

  -- Pricing, Cost & P&L Margin Protection
  base_price_cents INTEGER NOT NULL CHECK (base_price_cents >= 0),
  sale_price_cents INTEGER CHECK (sale_price_cents >= 0),
  cost_price_cents INTEGER NOT NULL CHECK (cost_price_cents >= 0),   -- column-privilege protected
  dual_admin_price_override_token TEXT,                              -- required if price < 60% of cost

  -- Inventory & Warehouse Velocity
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  warehouse_bin VARCHAR(32) NOT NULL DEFAULT 'A1-01',
  days_in_inventory INTEGER NOT NULL DEFAULT 0,
  overstock_priority BOOLEAN NOT NULL DEFAULT FALSE,
  is_leftover_clearance BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Physical Mass & Performance Telemetry
  weight_grams INTEGER NOT NULL DEFAULT 500,
  performance_score INTEGER NOT NULL DEFAULT 0,
  gaming_tier_weight NUMERIC(4,2) DEFAULT 1.00,
  workstation_tier_weight NUMERIC(4,2) DEFAULT 1.00,
  tdp_watts INTEGER NOT NULL DEFAULT 0,

  -- Media
  primary_image_url TEXT NOT NULL,
  gallery_urls TEXT[] DEFAULT '{}',
  model_3d_glb_url TEXT,

  -- Polymorphic hardware specs + copy
  specs JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,

  -- Full-text search vector
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(brand, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(sku, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(specs::text, '')), 'C')
  ) STORED,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reserved_within_stock CHECK (reserved_quantity <= stock_quantity)
);

CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_specs_gin ON public.products USING GIN (specs jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_products_search_vector ON public.products USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_products_trgm_name ON public.products USING GIN (name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_price ON public.products ((COALESCE(sale_price_cents, base_price_cents)));

-- 3. FLASH DEALS ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.flash_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  deal_title VARCHAR(128) NOT NULL,
  deal_price_cents INTEGER NOT NULL CHECK (deal_price_cents > 0),
  max_claims INTEGER NOT NULL CHECK (max_claims > 0),
  claimed_count INTEGER NOT NULL DEFAULT 0 CHECK (claimed_count >= 0),
  reserved_claims INTEGER NOT NULL DEFAULT 0 CHECK (reserved_claims >= 0),
  starts_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  banner_accent_hex VARCHAR(7) DEFAULT '#FF3B00',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_deal_window CHECK (expires_at > starts_at),
  CONSTRAINT valid_claim_cap CHECK (claimed_count + reserved_claims <= max_claims)
);
CREATE INDEX IF NOT EXISTS idx_flash_deals_window ON public.flash_deals (expires_at) WHERE is_active = TRUE;

-- 4. SYNDICATE PACKAGE OFFERS (assembly fee waived) -------------------
CREATE TABLE IF NOT EXISTS public.syndicate_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(64) NOT NULL,
  tier public.build_tier NOT NULL,
  tagline VARCHAR(128) NOT NULL,
  description TEXT NOT NULL,
  hero_accent_hex VARCHAR(7) NOT NULL DEFAULT '#D4FF00',
  component_skus TEXT[] NOT NULL,
  target_fps_note TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. ATOMIC CART & FLASH-DEAL RESERVATION LEDGER (10-minute TTL) ------
CREATE TABLE IF NOT EXISTS public.inventory_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(128) NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  flash_deal_id UUID REFERENCES public.flash_deals(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  locked_price_cents INTEGER NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CONVERTED', 'EXPIRED', 'RELEASED')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reservations_expiry ON public.inventory_reservations(expires_at) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_reservations_session ON public.inventory_reservations(session_id) WHERE status = 'ACTIVE';

-- 6. ORDERS, LOGISTICS SPLIT & BUILD BAY TELEMETRY --------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(24) UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  customer_email VARCHAR(255) NOT NULL,
  customer_name VARCHAR(160) NOT NULL DEFAULT '',
  shipping_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  fulfillment_type public.fulfillment_mode NOT NULL DEFAULT 'PRO_BUILT_FOUNDRY_RIG',

  includes_bios_preflash_service BOOLEAN NOT NULL DEFAULT FALSE,
  includes_foam_gpu_brace BOOLEAN NOT NULL DEFAULT FALSE,
  assembly_fee_cents INTEGER NOT NULL DEFAULT 14900,
  services_fee_cents INTEGER NOT NULL DEFAULT 0,
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  total_charged_cents INTEGER NOT NULL,

  current_stage public.build_bay_stage NOT NULL DEFAULT 'ORDER_CONFIRMED',
  assigned_technician_code VARCHAR(32),
  estimated_dispatch_date DATE NOT NULL,
  carrier VARCHAR(16),
  carrier_tracking_number VARCHAR(128),

  manifest_snapshot JSONB NOT NULL,
  compatibility_confidence VARCHAR(24) NOT NULL CHECK (compatibility_confidence IN ('VERIFIED_FIT', 'TIGHT_TOLERANCE')),
  requires_tech_clearance_check BOOLEAN NOT NULL DEFAULT FALSE,
  syndicate_package_slug VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_stage ON public.orders(current_stage, created_at DESC);

CREATE TABLE IF NOT EXISTS public.build_bay_telemetry_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  stage public.build_bay_stage NOT NULL,
  technician_code VARCHAR(32) NOT NULL,
  telemetry_metrics JSONB DEFAULT '{
    "idle_cpu_temp_c": null,
    "peak_occt_cpu_temp_c": null,
    "peak_furmark_gpu_temp_c": null,
    "expo_xmp_profile_verified": null,
    "time_spy_score": null,
    "bios_version_flashed": null
  }'::jsonb,
  proof_screenshot_url TEXT,
  technician_notes TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_telemetry_order ON public.build_bay_telemetry_logs(order_id, logged_at);

-- 7. STEALTH ADMIN VAULT (WebAuthn passkey enforced) & AUDIT TRAIL -----
CREATE TABLE IF NOT EXISTS public.admin_vault_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  codename VARCHAR(64) UNIQUE NOT NULL,
  role VARCHAR(32) NOT NULL CHECK (role IN ('OVERSEER', 'INVENTORY_COMMANDER', 'PRICING_OPS', 'LEAD_TECHNICIAN')),
  webauthn_credential_id TEXT UNIQUE NOT NULL,
  webauthn_public_key TEXT NOT NULL,
  webauthn_sign_count BIGINT NOT NULL DEFAULT 0,
  webauthn_transports TEXT[] NOT NULL DEFAULT '{}',
  totp_secret_encrypted TEXT NOT NULL,             -- AES-256-GCM, key held only by the app server
  allowed_ips INET[] DEFAULT '{}',
  last_login_at TIMESTAMPTZ,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.admin_vault_users(id),
  action_type VARCHAR(64) NOT NULL,
  target_entity VARCHAR(64) NOT NULL,
  target_id TEXT,
  previous_state JSONB,
  new_state JSONB,
  ip_address INET NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_executed ON public.admin_audit_logs(executed_at DESC);

-- Dual-Overseer price override ledger (Ring 4)
CREATE TABLE IF NOT EXISTS public.price_override_approvals (
  token TEXT PRIMARY KEY CHECK (length(token) >= 32),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  min_price_cents INTEGER NOT NULL CHECK (min_price_cents >= 0),
  approver_admin_id UUID NOT NULL REFERENCES public.admin_vault_users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  consumed_by_admin_id UUID REFERENCES public.admin_vault_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. CONCURRENT MATERIALIZED VIEW FOR FACETED SEARCH COUNTS -----------
DROP MATERIALIZED VIEW IF EXISTS public.mv_hardware_facets;
CREATE MATERIALIZED VIEW public.mv_hardware_facets AS
SELECT
  category,
  brand,
  COALESCE(specs->>'socket', '') AS cpu_socket,
  COALESCE(specs->>'memory_type', '') AS memory_type,
  COALESCE(specs->>'form_factor', '') AS form_factor,
  is_leftover_clearance,
  COUNT(*)::int AS total_skus,
  (COUNT(*) FILTER (WHERE (stock_quantity - reserved_quantity) > 0))::int AS in_stock_skus,
  MIN(COALESCE(sale_price_cents, base_price_cents))::int AS min_price_cents,
  MAX(COALESCE(sale_price_cents, base_price_cents))::int AS max_price_cents
FROM public.products
WHERE is_active = TRUE AND category <> 'INTERNAL_BRACE'
GROUP BY 1, 2, 3, 4, 5, 6;

CREATE UNIQUE INDEX idx_mv_hardware_facets_unique
  ON public.mv_hardware_facets (category, brand, cpu_socket, memory_type, form_factor, is_leftover_clearance);
