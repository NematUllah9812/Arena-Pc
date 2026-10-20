-- =====================================================================
-- VORTEX LABS — Row Level Security, column privileges, realtime, storage, cron
-- The Next.js server talks to Postgres with the service role (bypasses RLS)
-- and only ever ships storefront-safe projections to the browser. The anon
-- role (used by the browser for Realtime) can read public catalog data only.
-- =====================================================================

-- 1. RLS everywhere ----------------------------------------------------
ALTER TABLE public.products                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flash_deals              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syndicate_packages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_reservations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.build_bay_telemetry_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_vault_users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_override_approvals ENABLE ROW LEVEL SECURITY;

-- Supabase grants ALL on new public tables to anon/authenticated by default — strip it.
REVOKE ALL ON public.products, public.flash_deals, public.syndicate_packages, public.inventory_reservations,
              public.orders, public.build_bay_telemetry_logs, public.admin_vault_users, public.admin_audit_logs,
              public.price_override_approvals
FROM anon, authenticated;

-- 2. Public catalog reads (cost / override columns are NOT granted) -----
GRANT SELECT (
  id, sku, name, slug, brand, category, base_price_cents, sale_price_cents,
  stock_quantity, reserved_quantity, warehouse_bin, days_in_inventory, overstock_priority, is_leftover_clearance, is_active,
  weight_grams, performance_score, gaming_tier_weight, workstation_tier_weight, tdp_watts,
  primary_image_url, gallery_urls, model_3d_glb_url, specs, description, created_at, updated_at
) ON public.products TO anon, authenticated;

DROP POLICY IF EXISTS "catalog_public_read" ON public.products;
CREATE POLICY "catalog_public_read" ON public.products
  FOR SELECT TO anon, authenticated
  USING (is_active = TRUE AND category <> 'INTERNAL_BRACE');

GRANT SELECT ON public.flash_deals TO anon, authenticated;
DROP POLICY IF EXISTS "flash_deals_public_read" ON public.flash_deals;
CREATE POLICY "flash_deals_public_read" ON public.flash_deals
  FOR SELECT TO anon, authenticated
  USING (is_active = TRUE);

GRANT SELECT ON public.syndicate_packages TO anon, authenticated;
DROP POLICY IF EXISTS "packages_public_read" ON public.syndicate_packages;
CREATE POLICY "packages_public_read" ON public.syndicate_packages
  FOR SELECT TO anon, authenticated
  USING (is_active = TRUE);

-- Orders, leases, telemetry, vault, audit & override ledger: no anon/auth policies
-- (deny-by-default). Only the service role (server) can touch them.

-- 3. Storefront-safe projection -----------------------------------------
CREATE OR REPLACE VIEW public.products_public WITH (security_invoker = true) AS
SELECT
  id, sku, name, slug, brand, category, base_price_cents, sale_price_cents,
  stock_quantity, reserved_quantity, GREATEST(0, stock_quantity - reserved_quantity) AS available_quantity,
  warehouse_bin, days_in_inventory, overstock_priority, is_leftover_clearance, is_active,
  weight_grams, performance_score, gaming_tier_weight, workstation_tier_weight, tdp_watts,
  primary_image_url, gallery_urls, model_3d_glb_url, specs, description, created_at, updated_at
FROM public.products
WHERE is_active = TRUE AND category <> 'INTERNAL_BRACE';

GRANT SELECT ON public.products_public TO anon, authenticated;
GRANT SELECT ON public.mv_hardware_facets TO anon, authenticated;

-- 4. Function privileges: only the server may mutate ---------------------
REVOKE EXECUTE ON FUNCTION
  public.reserve_inventory_atomic(VARCHAR, UUID, INTEGER, UUID),
  public.release_session_reservations(VARCHAR),
  public.expire_stale_reservations(),
  public.vortex_reclaim_expired_for_product(UUID),
  public.place_order_atomic(VARCHAR, UUID[], JSONB),
  public.advance_order_stage(UUID, UUID, public.build_bay_stage, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, INET),
  public.admin_update_product_pricing(UUID, UUID, INTEGER, INTEGER, TEXT, INET),
  public.admin_update_product_inventory(UUID, UUID, INTEGER, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, INET),
  public.admin_create_flash_deal(UUID, UUID, TEXT, INTEGER, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, INET),
  public.admin_set_flash_deal_active(UUID, UUID, BOOLEAN, INET),
  public.issue_price_override(UUID, UUID, INTEGER, INET),
  public.admin_set_locked(UUID, UUID, BOOLEAN, INET),
  public.vortex_assert_admin(UUID, TEXT[]),
  public.refresh_hardware_facets()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.catalog_search(TEXT, INTEGER) TO anon, authenticated;

-- 5. Realtime: live flash-deal claim ticker ------------------------------
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.flash_deals;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. Storage bucket for OCCT / 3DMark burn-in proofs ----------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('build-bay-proofs', 'build-bay-proofs', TRUE, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- 7. Scheduled maintenance (pg_cron) --------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('vortex-expire-reservations', '* * * * *', 'SELECT public.expire_stale_reservations()');
    PERFORM cron.schedule('vortex-refresh-facets', '*/5 * * * *', 'SELECT public.refresh_hardware_facets()');
    PERFORM cron.schedule('vortex-inventory-aging', '15 6 * * *',
      'UPDATE public.products SET days_in_inventory = days_in_inventory + 1 WHERE stock_quantity > 0 AND is_active');
  END IF;
END $$;
