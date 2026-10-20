-- =====================================================================
-- VORTEX LABS — Atomic RPCs, circuit breakers & immutable audit (Spec §4, §7)
-- =====================================================================

-- ---------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vortex_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_orders_touch ON public.orders;
CREATE TRIGGER trg_orders_touch BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.vortex_touch_updated_at();

-- ---------------------------------------------------------------------
-- RING 4 — DATABASE-LEVEL PRICE-FLOOR CIRCUIT BREAKER
-- Effective price may not fall below 60% of wholesale cost unless a token
-- issued by a *different* OVERSEER (price_override_approvals) is supplied.
-- Tokens are single-use, SKU-bound, time-boxed and floor-bound.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_product_price_floor()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_effective_price INTEGER;
  v_min_allowed_price INTEGER;
  v_approval public.price_override_approvals%ROWTYPE;
  v_actor TEXT := NULLIF(current_setting('vortex.acting_admin_id', true), '');
BEGIN
  NEW.updated_at := NOW();

  -- Logistics consumables are bundled into the assembly SLA.
  IF NEW.category = 'INTERNAL_BRACE' THEN
    RETURN NEW;
  END IF;

  -- Stock / reservation updates that don't touch pricing never re-trip the breaker.
  IF TG_OP = 'UPDATE'
     AND NEW.base_price_cents = OLD.base_price_cents
     AND NEW.sale_price_cents IS NOT DISTINCT FROM OLD.sale_price_cents
     AND NEW.cost_price_cents = OLD.cost_price_cents THEN
    RETURN NEW;
  END IF;

  v_effective_price := COALESCE(NEW.sale_price_cents, NEW.base_price_cents);
  v_min_allowed_price := FLOOR(NEW.cost_price_cents * 0.60);

  IF v_effective_price < v_min_allowed_price THEN
    IF NEW.dual_admin_price_override_token IS NULL OR LENGTH(NEW.dual_admin_price_override_token) < 32 THEN
      RAISE EXCEPTION 'PRICE_FLOOR_CIRCUIT_BREAKER_TRIPPED: Effective price (% cents) is more than 40%% below wholesale cost (% cents). Dual-Overseer cryptographic override token required.',
        v_effective_price, NEW.cost_price_cents;
    END IF;

    SELECT * INTO v_approval
    FROM public.price_override_approvals
    WHERE token = NEW.dual_admin_price_override_token AND product_id = NEW.id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'OVERRIDE_TOKEN_INVALID: token not issued for this SKU.';
    ELSIF v_approval.consumed_at IS NOT NULL THEN
      RAISE EXCEPTION 'OVERRIDE_TOKEN_CONSUMED: token already used.';
    ELSIF v_approval.expires_at <= NOW() THEN
      RAISE EXCEPTION 'OVERRIDE_TOKEN_EXPIRED.';
    ELSIF v_effective_price < v_approval.min_price_cents THEN
      RAISE EXCEPTION 'OVERRIDE_BELOW_APPROVED_FLOOR: approved minimum is % cents.', v_approval.min_price_cents;
    ELSIF v_actor IS NULL OR v_actor::uuid = v_approval.approver_admin_id THEN
      RAISE EXCEPTION 'OVERRIDE_REQUIRES_SECOND_OVERSEER: approver cannot apply their own token.';
    END IF;

    UPDATE public.price_override_approvals
    SET consumed_at = NOW(), consumed_by_admin_id = v_actor::uuid
    WHERE token = v_approval.token;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_price_floor ON public.products;
CREATE TRIGGER trg_enforce_price_floor
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.enforce_product_price_floor();

-- Flash deals obey the same 60% floor (no override path for deals).
CREATE OR REPLACE FUNCTION public.enforce_flash_deal_price_floor()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_cost INTEGER;
BEGIN
  SELECT cost_price_cents INTO v_cost FROM public.products WHERE id = NEW.product_id;
  IF NEW.deal_price_cents < FLOOR(v_cost * 0.60) THEN
    RAISE EXCEPTION 'PRICE_FLOOR_CIRCUIT_BREAKER_TRIPPED: flash deal price (% cents) is more than 40%% below wholesale cost (% cents).', NEW.deal_price_cents, v_cost;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_flash_deal_price_floor ON public.flash_deals;
CREATE TRIGGER trg_flash_deal_price_floor
BEFORE INSERT OR UPDATE OF deal_price_cents, product_id ON public.flash_deals
FOR EACH ROW EXECUTE FUNCTION public.enforce_flash_deal_price_floor();

-- ---------------------------------------------------------------------
-- IMMUTABLE AUDIT LOG
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.block_audit_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ADMIN_AUDIT_LOG_IMMUTABLE: audit rows cannot be modified or deleted.';
END $$;

DROP TRIGGER IF EXISTS trg_audit_immutable ON public.admin_audit_logs;
CREATE TRIGGER trg_audit_immutable
BEFORE UPDATE OR DELETE ON public.admin_audit_logs
FOR EACH ROW EXECUTE FUNCTION public.block_audit_mutation();

DROP TRIGGER IF EXISTS trg_audit_no_truncate ON public.admin_audit_logs;
CREATE TRIGGER trg_audit_no_truncate
BEFORE TRUNCATE ON public.admin_audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION public.block_audit_mutation();

-- ---------------------------------------------------------------------
-- Admin role guard (defense in depth — the app server checks too)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vortex_assert_admin(p_admin_id UUID, p_roles TEXT[])
RETURNS public.admin_vault_users LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin public.admin_vault_users%ROWTYPE;
BEGIN
  SELECT * INTO v_admin FROM public.admin_vault_users WHERE id = p_admin_id;
  IF NOT FOUND OR v_admin.is_locked THEN
    RAISE EXCEPTION 'OVERSEER_SESSION_INVALID';
  END IF;
  IF NOT (v_admin.role = ANY (p_roles)) THEN
    RAISE EXCEPTION 'OVERSEER_ROLE_FORBIDDEN: % may not perform this action.', v_admin.role;
  END IF;
  RETURN v_admin;
END $$;

-- ---------------------------------------------------------------------
-- RESERVATION LEDGER
-- ---------------------------------------------------------------------

-- Release leases for one product (caller must hold the product row lock).
CREATE OR REPLACE FUNCTION public.vortex_reclaim_expired_for_product(p_product_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INTEGER := 0;
BEGIN
  WITH expired AS (
    UPDATE public.inventory_reservations
    SET status = 'EXPIRED'
    WHERE product_id = p_product_id AND status = 'ACTIVE' AND expires_at <= NOW()
    RETURNING quantity, flash_deal_id
  ),
  deal_release AS (
    UPDATE public.flash_deals f
    SET reserved_claims = GREATEST(0, f.reserved_claims - x.qty)
    FROM (SELECT flash_deal_id, SUM(quantity)::int AS qty FROM expired WHERE flash_deal_id IS NOT NULL GROUP BY flash_deal_id) x
    WHERE f.id = x.flash_deal_id
    RETURNING f.id
  ),
  product_release AS (
    UPDATE public.products
    SET reserved_quantity = GREATEST(0, reserved_quantity - COALESCE((SELECT SUM(quantity) FROM expired), 0))
    WHERE id = p_product_id
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM expired;
  RETURN v_count;
END $$;

-- Atomic RPC to reserve stock & prevent race conditions during flash drops.
-- Fixes vs. spec: the row lock is taken *before* reclaiming expired leases
-- (no lost update), and expired flash-deal claims are released too.
CREATE OR REPLACE FUNCTION public.reserve_inventory_atomic(
  p_session_id VARCHAR(128),
  p_product_id UUID,
  p_quantity INTEGER,
  p_flash_deal_id UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_product public.products%ROWTYPE;
  v_deal public.flash_deals%ROWTYPE;
  v_locked_price INTEGER;
  v_reservation_id UUID;
  v_expires TIMESTAMPTZ := NOW() + INTERVAL '10 minutes';
BEGIN
  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_QUANTITY');
  END IF;

  -- 1. Lock product row exclusively without blocking unrelated SKUs
  SELECT * INTO v_product
  FROM public.products
  WHERE id = p_product_id AND is_active = TRUE AND category <> 'INTERNAL_BRACE'
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'SKU_LOCKED_OR_UNAVAILABLE');
  END IF;

  -- 2. Reclaim expired leases for this SKU, then re-read the locked row
  PERFORM public.vortex_reclaim_expired_for_product(p_product_id);
  SELECT * INTO v_product FROM public.products WHERE id = p_product_id;

  IF (v_product.stock_quantity - v_product.reserved_quantity) < p_quantity THEN
    RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_STOCK');
  END IF;

  v_locked_price := COALESCE(v_product.sale_price_cents, v_product.base_price_cents);

  -- 3. Flash deal cap
  IF p_flash_deal_id IS NOT NULL THEN
    SELECT * INTO v_deal
    FROM public.flash_deals
    WHERE id = p_flash_deal_id
      AND product_id = p_product_id
      AND is_active = TRUE
      AND NOW() BETWEEN starts_at AND expires_at
    FOR UPDATE;

    IF NOT FOUND OR (v_deal.max_claims - v_deal.claimed_count - v_deal.reserved_claims) < p_quantity THEN
      RETURN jsonb_build_object('success', false, 'error', 'FLASH_DEAL_DEPLETED');
    END IF;

    UPDATE public.flash_deals SET reserved_claims = reserved_claims + p_quantity WHERE id = p_flash_deal_id;
    v_locked_price := v_deal.deal_price_cents;
  END IF;

  -- 4. Increment reserved_quantity & insert 10-minute lease
  UPDATE public.products SET reserved_quantity = reserved_quantity + p_quantity WHERE id = p_product_id;

  INSERT INTO public.inventory_reservations (session_id, product_id, flash_deal_id, quantity, locked_price_cents, expires_at)
  VALUES (p_session_id, p_product_id, p_flash_deal_id, p_quantity, v_locked_price, v_expires)
  RETURNING id INTO v_reservation_id;

  RETURN jsonb_build_object(
    'success', true,
    'reservation_id', v_reservation_id,
    'locked_price_cents', v_locked_price,
    'expires_at', v_expires
  );
END $$;

-- Release every ACTIVE lease held by a cart session.
CREATE OR REPLACE FUNCTION public.release_session_reservations(p_session_id VARCHAR(128))
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; v_count INTEGER := 0;
BEGIN
  FOR r IN
    SELECT * FROM public.inventory_reservations
    WHERE session_id = p_session_id AND status = 'ACTIVE'
    ORDER BY product_id
    FOR UPDATE
  LOOP
    UPDATE public.inventory_reservations SET status = 'RELEASED' WHERE id = r.id;
    UPDATE public.products SET reserved_quantity = GREATEST(0, reserved_quantity - r.quantity) WHERE id = r.product_id;
    IF r.flash_deal_id IS NOT NULL THEN
      UPDATE public.flash_deals SET reserved_claims = GREATEST(0, reserved_claims - r.quantity) WHERE id = r.flash_deal_id;
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

-- Global sweep (pg_cron, every minute).
CREATE OR REPLACE FUNCTION public.expire_stale_reservations()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; v_count INTEGER := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT product_id FROM public.inventory_reservations
    WHERE status = 'ACTIVE' AND expires_at <= NOW()
    ORDER BY product_id
  LOOP
    PERFORM 1 FROM public.products WHERE id = r.product_id FOR UPDATE;
    v_count := v_count + public.vortex_reclaim_expired_for_product(r.product_id);
  END LOOP;
  RETURN v_count;
END $$;

-- ---------------------------------------------------------------------
-- ATOMIC CHECKOUT: convert leases → stock decrement → order + log
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.place_order_atomic(
  p_session_id VARCHAR(128),
  p_reservation_ids UUID[],
  p_order JSONB
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_expected INTEGER := COALESCE(array_length(p_reservation_ids, 1), 0);
  v_valid INTEGER;
  v_subtotal INTEGER;
  v_order_number TEXT;
  v_order public.orders%ROWTYPE;
  r RECORD;
BEGIN
  IF v_expected = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'EMPTY_CART');
  END IF;

  -- Lock product rows first (deterministic order → no deadlocks), then leases.
  PERFORM 1 FROM public.products
  WHERE id IN (SELECT product_id FROM public.inventory_reservations WHERE id = ANY (p_reservation_ids))
  ORDER BY id FOR UPDATE;

  PERFORM 1 FROM public.inventory_reservations WHERE id = ANY (p_reservation_ids) FOR UPDATE;

  IF EXISTS (SELECT 1 FROM public.inventory_reservations WHERE id = ANY (p_reservation_ids) AND session_id <> p_session_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'RESERVATION_MISMATCH');
  END IF;

  SELECT COUNT(*), COALESCE(SUM(locked_price_cents * quantity), 0)
  INTO v_valid, v_subtotal
  FROM public.inventory_reservations
  WHERE id = ANY (p_reservation_ids) AND session_id = p_session_id AND status = 'ACTIVE' AND expires_at > NOW();

  IF v_valid <> v_expected THEN
    RETURN jsonb_build_object('ok', false, 'error', 'RESERVATION_EXPIRED');
  END IF;
  IF v_subtotal <> (p_order->>'subtotal_cents')::int THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SUBTOTAL_MISMATCH', 'detail', v_subtotal);
  END IF;

  FOR r IN SELECT * FROM public.inventory_reservations WHERE id = ANY (p_reservation_ids) ORDER BY product_id LOOP
    UPDATE public.products
    SET stock_quantity = stock_quantity - r.quantity,
        reserved_quantity = GREATEST(0, reserved_quantity - r.quantity)
    WHERE id = r.product_id;
    IF r.flash_deal_id IS NOT NULL THEN
      UPDATE public.flash_deals
      SET reserved_claims = GREATEST(0, reserved_claims - r.quantity),
          claimed_count = claimed_count + r.quantity
      WHERE id = r.flash_deal_id;
    END IF;
    UPDATE public.inventory_reservations SET status = 'CONVERTED' WHERE id = r.id;
  END LOOP;

  LOOP
    v_order_number := 'VL-ORD-' || (10000 + floor(random() * 90000))::int;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.orders WHERE order_number = v_order_number);
  END LOOP;

  INSERT INTO public.orders (
    order_number, customer_email, customer_name, shipping_address, fulfillment_type,
    includes_bios_preflash_service, includes_foam_gpu_brace, assembly_fee_cents, services_fee_cents,
    subtotal_cents, total_charged_cents, current_stage, estimated_dispatch_date,
    manifest_snapshot, compatibility_confidence, requires_tech_clearance_check, syndicate_package_slug
  ) VALUES (
    v_order_number,
    p_order->>'customer_email',
    p_order->>'customer_name',
    COALESCE(p_order->'shipping_address', '{}'::jsonb),
    (p_order->>'fulfillment_type')::public.fulfillment_mode,
    COALESCE((p_order->>'includes_bios_preflash_service')::boolean, false),
    COALESCE((p_order->>'includes_foam_gpu_brace')::boolean, false),
    COALESCE((p_order->>'assembly_fee_cents')::int, 0),
    COALESCE((p_order->>'services_fee_cents')::int, 0),
    v_subtotal,
    (p_order->>'total_charged_cents')::int,
    'ORDER_CONFIRMED',
    (p_order->>'estimated_dispatch_date')::date,
    p_order->'manifest_snapshot',
    p_order->>'compatibility_confidence',
    COALESCE((p_order->>'requires_tech_clearance_check')::boolean, false),
    NULLIF(p_order->>'syndicate_package_slug', '')
  ) RETURNING * INTO v_order;

  INSERT INTO public.build_bay_telemetry_logs (order_id, stage, technician_code, telemetry_metrics, technician_notes)
  VALUES (
    v_order.id, 'ORDER_CONFIRMED', 'SYSTEM', '{}'::jsonb,
    CASE WHEN v_order.requires_tech_clearance_check
      THEN 'Inventory locked via reserve_inventory_atomic. TIGHT_TOLERANCE build flagged for technician clearance check.'
      ELSE 'Inventory locked via reserve_inventory_atomic.' END
  );

  RETURN jsonb_build_object('ok', true, 'order', to_jsonb(v_order));
END $$;

-- ---------------------------------------------------------------------
-- BUILD BAY STAGE ADVANCE (technician console)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.advance_order_stage(
  p_admin_id UUID,
  p_order_id UUID,
  p_to_stage public.build_bay_stage,
  p_technician_code TEXT,
  p_metrics JSONB,
  p_proof_url TEXT,
  p_notes TEXT,
  p_carrier TEXT,
  p_tracking TEXT,
  p_ip INET
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prev public.orders%ROWTYPE; v_order public.orders%ROWTYPE;
BEGIN
  PERFORM public.vortex_assert_admin(p_admin_id, ARRAY['OVERSEER', 'LEAD_TECHNICIAN']);

  SELECT * INTO v_prev FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  IF p_to_stage <= v_prev.current_stage THEN
    RAISE EXCEPTION 'STAGE_REGRESSION_BLOCKED: % -> %', v_prev.current_stage, p_to_stage;
  END IF;
  IF p_to_stage = 'OCCT_THERMAL_BURN_IN_4HR' AND COALESCE(p_proof_url, '') = '' THEN
    RAISE EXCEPTION 'BURN_IN_PROOF_REQUIRED: OCCT / 3DMark screenshot upload is mandatory.';
  END IF;

  UPDATE public.orders SET
    current_stage = p_to_stage,
    assigned_technician_code = CASE
      WHEN p_technician_code IS NOT NULL AND p_technician_code <> 'SYSTEM'
           AND (p_to_stage = 'BENCH_ASSEMBLY_IN_PROGRESS' OR assigned_technician_code IS NULL)
      THEN p_technician_code ELSE assigned_technician_code END,
    carrier = COALESCE(NULLIF(p_carrier, ''), carrier),
    carrier_tracking_number = COALESCE(NULLIF(p_tracking, ''), carrier_tracking_number)
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  INSERT INTO public.build_bay_telemetry_logs (order_id, stage, technician_code, telemetry_metrics, proof_screenshot_url, technician_notes)
  VALUES (p_order_id, p_to_stage, p_technician_code, COALESCE(p_metrics, '{}'::jsonb), NULLIF(p_proof_url, ''), NULLIF(p_notes, ''));

  INSERT INTO public.admin_audit_logs (admin_id, action_type, target_entity, target_id, previous_state, new_state, ip_address)
  VALUES (p_admin_id, 'BUILD_BAY_STAGE_ADVANCE', 'orders', v_order.order_number,
          jsonb_build_object('current_stage', v_prev.current_stage, 'assigned_technician_code', v_prev.assigned_technician_code),
          jsonb_build_object('current_stage', v_order.current_stage, 'assigned_technician_code', v_order.assigned_technician_code),
          p_ip);

  RETURN to_jsonb(v_order);
END $$;

-- ---------------------------------------------------------------------
-- OVERSEER MUTATIONS (audited)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_product_pricing(
  p_admin_id UUID, p_product_id UUID, p_base_price_cents INTEGER, p_sale_price_cents INTEGER, p_override_token TEXT, p_ip INET
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prev public.products%ROWTYPE; v_new public.products%ROWTYPE; v_err TEXT;
BEGIN
  PERFORM public.vortex_assert_admin(p_admin_id, ARRAY['OVERSEER', 'PRICING_OPS']);
  SELECT * INTO v_prev FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'PRODUCT_NOT_FOUND'); END IF;

  BEGIN
    PERFORM set_config('vortex.acting_admin_id', p_admin_id::text, true);
    UPDATE public.products
    SET base_price_cents = p_base_price_cents,
        sale_price_cents = p_sale_price_cents,
        dual_admin_price_override_token = NULLIF(p_override_token, '')
    WHERE id = p_product_id
    RETURNING * INTO v_new;
  EXCEPTION WHEN raise_exception OR check_violation THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    INSERT INTO public.admin_audit_logs (admin_id, action_type, target_entity, target_id, previous_state, new_state, ip_address)
    VALUES (p_admin_id, 'PRICE_FLOOR_BLOCKED', 'products', v_prev.sku,
            jsonb_build_object('base', v_prev.base_price_cents, 'sale', v_prev.sale_price_cents),
            jsonb_build_object('base', p_base_price_cents, 'sale', p_sale_price_cents, 'error', v_err), p_ip);
    RETURN jsonb_build_object('ok', false, 'error', v_err);
  END;

  INSERT INTO public.admin_audit_logs (admin_id, action_type, target_entity, target_id, previous_state, new_state, ip_address)
  VALUES (p_admin_id,
          CASE WHEN NULLIF(p_override_token, '') IS NOT NULL
                    AND COALESCE(p_sale_price_cents, p_base_price_cents) < FLOOR(v_prev.cost_price_cents * 0.60)
               THEN 'PRICE_UPDATE_DUAL_OVERRIDE' ELSE 'PRICE_UPDATE' END,
          'products', v_prev.sku,
          jsonb_build_object('base_price_cents', v_prev.base_price_cents, 'sale_price_cents', v_prev.sale_price_cents),
          jsonb_build_object('base_price_cents', v_new.base_price_cents, 'sale_price_cents', v_new.sale_price_cents), p_ip);

  RETURN jsonb_build_object('ok', true, 'product', to_jsonb(v_new) - 'search_vector');
END $$;

CREATE OR REPLACE FUNCTION public.admin_update_product_inventory(
  p_admin_id UUID, p_product_id UUID, p_stock INTEGER, p_bin TEXT, p_overstock BOOLEAN, p_clearance BOOLEAN, p_active BOOLEAN, p_ip INET
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prev public.products%ROWTYPE; v_new public.products%ROWTYPE;
BEGIN
  PERFORM public.vortex_assert_admin(p_admin_id, ARRAY['OVERSEER', 'INVENTORY_COMMANDER']);
  SELECT * INTO v_prev FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'PRODUCT_NOT_FOUND'); END IF;
  IF p_stock < v_prev.reserved_quantity THEN
    RETURN jsonb_build_object('ok', false, 'error', format('STOCK_BELOW_ACTIVE_RESERVATIONS (%s units leased)', v_prev.reserved_quantity));
  END IF;

  UPDATE public.products
  SET stock_quantity = p_stock, warehouse_bin = p_bin, overstock_priority = p_overstock,
      is_leftover_clearance = p_clearance, is_active = p_active
  WHERE id = p_product_id
  RETURNING * INTO v_new;

  INSERT INTO public.admin_audit_logs (admin_id, action_type, target_entity, target_id, previous_state, new_state, ip_address)
  VALUES (p_admin_id, 'INVENTORY_UPDATE', 'products', v_prev.sku,
          jsonb_build_object('stock_quantity', v_prev.stock_quantity, 'warehouse_bin', v_prev.warehouse_bin, 'overstock_priority', v_prev.overstock_priority, 'is_leftover_clearance', v_prev.is_leftover_clearance, 'is_active', v_prev.is_active),
          jsonb_build_object('stock_quantity', v_new.stock_quantity, 'warehouse_bin', v_new.warehouse_bin, 'overstock_priority', v_new.overstock_priority, 'is_leftover_clearance', v_new.is_leftover_clearance, 'is_active', v_new.is_active),
          p_ip);
  RETURN jsonb_build_object('ok', true, 'product', to_jsonb(v_new) - 'search_vector');
END $$;

CREATE OR REPLACE FUNCTION public.admin_create_flash_deal(
  p_admin_id UUID, p_product_id UUID, p_title TEXT, p_price INTEGER, p_max_claims INTEGER,
  p_starts TIMESTAMPTZ, p_expires TIMESTAMPTZ, p_accent TEXT, p_ip INET
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_deal public.flash_deals%ROWTYPE; v_err TEXT;
BEGIN
  PERFORM public.vortex_assert_admin(p_admin_id, ARRAY['OVERSEER', 'PRICING_OPS']);
  BEGIN
    INSERT INTO public.flash_deals (product_id, deal_title, deal_price_cents, max_claims, starts_at, expires_at, banner_accent_hex)
    VALUES (p_product_id, p_title, p_price, p_max_claims, p_starts, p_expires, p_accent)
    RETURNING * INTO v_deal;
  EXCEPTION WHEN raise_exception OR check_violation OR foreign_key_violation THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    RETURN jsonb_build_object('ok', false, 'error', v_err);
  END;
  INSERT INTO public.admin_audit_logs (admin_id, action_type, target_entity, target_id, previous_state, new_state, ip_address)
  VALUES (p_admin_id, 'FLASH_DEAL_CREATE', 'flash_deals', v_deal.id::text, NULL, to_jsonb(v_deal), p_ip);
  RETURN jsonb_build_object('ok', true, 'deal', to_jsonb(v_deal));
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_flash_deal_active(p_admin_id UUID, p_deal_id UUID, p_active BOOLEAN, p_ip INET)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prev BOOLEAN;
BEGIN
  PERFORM public.vortex_assert_admin(p_admin_id, ARRAY['OVERSEER', 'PRICING_OPS']);
  SELECT is_active INTO v_prev FROM public.flash_deals WHERE id = p_deal_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'DEAL_NOT_FOUND'); END IF;
  UPDATE public.flash_deals SET is_active = p_active WHERE id = p_deal_id;
  INSERT INTO public.admin_audit_logs (admin_id, action_type, target_entity, target_id, previous_state, new_state, ip_address)
  VALUES (p_admin_id, CASE WHEN p_active THEN 'FLASH_DEAL_ACTIVATE' ELSE 'FLASH_DEAL_DEACTIVATE' END, 'flash_deals', p_deal_id::text,
          jsonb_build_object('is_active', v_prev), jsonb_build_object('is_active', p_active), p_ip);
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.issue_price_override(p_approver_id UUID, p_product_id UUID, p_min_price_cents INTEGER, p_ip INET)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_admin public.admin_vault_users%ROWTYPE; v_row public.price_override_approvals%ROWTYPE; v_sku TEXT;
BEGIN
  v_admin := public.vortex_assert_admin(p_approver_id, ARRAY['OVERSEER']);
  SELECT sku INTO v_sku FROM public.products WHERE id = p_product_id;
  IF v_sku IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'PRODUCT_NOT_FOUND'); END IF;

  INSERT INTO public.price_override_approvals (token, product_id, min_price_cents, approver_admin_id, expires_at)
  VALUES (encode(extensions.gen_random_bytes(24), 'hex'), p_product_id, p_min_price_cents, p_approver_id, NOW() + INTERVAL '30 minutes')
  RETURNING * INTO v_row;

  INSERT INTO public.admin_audit_logs (admin_id, action_type, target_entity, target_id, previous_state, new_state, ip_address)
  VALUES (p_approver_id, 'PRICE_OVERRIDE_ISSUED', 'products', v_sku, NULL,
          jsonb_build_object('min_price_cents', p_min_price_cents, 'expires_at', v_row.expires_at), p_ip);

  RETURN jsonb_build_object('ok', true, 'approval', to_jsonb(v_row) || jsonb_build_object('approver_codename', v_admin.codename));
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_locked(p_actor_id UUID, p_target_id UUID, p_locked BOOLEAN, p_ip INET)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_target public.admin_vault_users%ROWTYPE;
BEGIN
  PERFORM public.vortex_assert_admin(p_actor_id, ARRAY['OVERSEER']);
  IF p_actor_id = p_target_id THEN RETURN jsonb_build_object('ok', false, 'error', 'CANNOT_LOCK_SELF'); END IF;
  SELECT * INTO v_target FROM public.admin_vault_users WHERE id = p_target_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'ADMIN_NOT_FOUND'); END IF;
  UPDATE public.admin_vault_users SET is_locked = p_locked WHERE id = p_target_id;
  INSERT INTO public.admin_audit_logs (admin_id, action_type, target_entity, target_id, previous_state, new_state, ip_address)
  VALUES (p_actor_id, CASE WHEN p_locked THEN 'ADMIN_LOCK' ELSE 'ADMIN_UNLOCK' END, 'admin_vault_users', v_target.codename,
          jsonb_build_object('is_locked', v_target.is_locked), jsonb_build_object('is_locked', p_locked), p_ip);
  RETURN jsonb_build_object('ok', true);
END $$;

-- ---------------------------------------------------------------------
-- SEARCH (tsvector + trigram) & FACET REFRESH
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.catalog_search(p_query TEXT, p_limit INTEGER DEFAULT 60)
RETURNS TABLE (id UUID, rank REAL)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT p.id,
         (ts_rank(p.search_vector, websearch_to_tsquery('english', p_query)) * 2
          + similarity(p.name, p_query)
          + CASE WHEN p.sku ILIKE '%' || p_query || '%' THEN 1 ELSE 0 END)::real AS rank
  FROM public.products p
  WHERE p.is_active AND p.category <> 'INTERNAL_BRACE'
    AND (
      p.search_vector @@ websearch_to_tsquery('english', p_query)
      OR p.name % p_query
      OR p.name ILIKE '%' || p_query || '%'
      OR p.sku ILIKE '%' || p_query || '%'
    )
  ORDER BY rank DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 200);
$$;

CREATE OR REPLACE FUNCTION public.refresh_hardware_facets()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_hardware_facets;
END $$;
