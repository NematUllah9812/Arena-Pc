import 'server-only';
import { FEES } from '@/lib/config/company';
import { buildSeedOrders } from '@/lib/data/build-seed-orders';
import { SEED_PRODUCTS } from '@/lib/data/seed-catalog';
import { SEED_PACKAGES, materializeDeals } from '@/lib/data/seed-commerce';
import type {
  AdminAuditLog,
  AdminVaultUser,
  BuildBayTelemetryLog,
  CatalogQuery,
  FlashDeal,
  InventoryReservation,
  Order,
  PriceOverrideApproval,
  Product,
  SyndicatePackage
} from '@/lib/types';
import type {
  AdvanceStageInput,
  CreateAdminInput,
  CreateDealInput,
  InventoryUpdateInput,
  MutationResult,
  PlaceOrderInput,
  PlaceOrderResult,
  PricingUpdateInput,
  Repository,
  ReserveResult
} from './types';
import {
  checkPriceFloor,
  computeFacets,
  effectivePrice,
  filterAndSortProducts,
  randomOrderNumber,
  randomToken,
  resolvePackage,
  toPublicProduct
} from './shared';

interface MemoryState {
  products: Map<string, Product>;
  deals: Map<string, FlashDeal>;
  packages: SyndicatePackage[];
  reservations: Map<string, InventoryReservation>;
  orders: Map<string, Order>;
  logs: BuildBayTelemetryLog[];
  admins: Map<string, AdminVaultUser>;
  audit: AdminAuditLog[];
  overrides: PriceOverrideApproval[];
  proofs: Map<string, { bytes: Uint8Array; contentType: string }>;
}

const clone = <T,>(v: T): T => structuredClone(v);

function createState(): MemoryState {
  const now = Date.now();
  const products = new Map(SEED_PRODUCTS.map((p) => [p.id, clone(p)]));
  const { orders, logs } = buildSeedOrders([...products.values()], now);
  return {
    products,
    deals: new Map(materializeDeals(now).map((d) => [d.id, d])),
    packages: clone(SEED_PACKAGES),
    reservations: new Map(),
    orders: new Map(orders.map((o) => [o.id, o])),
    logs,
    admins: new Map(),
    audit: [],
    overrides: [],
    proofs: new Map()
  };
}

// Survive Next.js per-route module instances & dev HMR.
const g = globalThis as unknown as { __vortexMemoryState?: MemoryState };
function state(): MemoryState {
  if (!g.__vortexMemoryState) g.__vortexMemoryState = createState();
  return g.__vortexMemoryState;
}

const nowIso = () => new Date().toISOString();

export class MemoryRepository implements Repository {
  readonly mode = 'memory' as const;

  /* ---------------------------- catalog ---------------------------- */
  private publicProducts() {
    this.expireSync();
    return [...state().products.values()].map(toPublicProduct);
  }

  async listProducts(q: CatalogQuery) {
    return filterAndSortProducts(this.publicProducts(), q);
  }
  async getProductBySlug(slug: string) {
    return this.publicProducts().find((p) => p.slug === slug && p.is_active) ?? null;
  }
  async getProductsByIds(ids: string[]) {
    const set = new Set(ids);
    return this.publicProducts().filter((p) => set.has(p.id));
  }
  async getFacets() {
    return computeFacets([...state().products.values()].filter((p) => p.category !== 'INTERNAL_BRACE'));
  }
  async listFlashDeals(opts: { includeUpcoming?: boolean; includeInactive?: boolean } = {}) {
    this.expireSync();
    const now = Date.now();
    const products = new Map(this.publicProducts().map((p) => [p.id, p]));
    return [...state().deals.values()]
      .filter((d) => (opts.includeInactive ? true : d.is_active))
      .filter((d) => {
        if (opts.includeInactive) return true;
        const s = new Date(d.starts_at).getTime();
        const e = new Date(d.expires_at).getTime();
        return e > now && (opts.includeUpcoming ? true : s <= now);
      })
      .map((d) => ({ ...clone(d), product: products.get(d.product_id)! }))
      .filter((d) => d.product)
      .sort((a, b) => a.expires_at.localeCompare(b.expires_at));
  }
  async getFlashDeal(id: string) {
    const d = state().deals.get(id);
    return d ? clone(d) : null;
  }
  async listPackages() {
    const products = this.publicProducts();
    return state()
      .packages.filter((p) => p.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((p) => resolvePackage(p, products));
  }
  async getPackage(slug: string) {
    const pkg = state().packages.find((p) => p.slug === slug && p.is_active);
    return pkg ? resolvePackage(pkg, this.publicProducts()) : null;
  }
  async listProductsInternal() {
    this.expireSync();
    return [...state().products.values()].map(clone);
  }
  async getProductInternal(id: string) {
    const p = state().products.get(id);
    return p ? clone(p) : null;
  }

  /* ----------------------- reservation ledger ---------------------- */
  /** Reclaim expired leases (mirrors the pg_cron sweep). */
  private expireSync(): number {
    const s = state();
    const now = Date.now();
    let n = 0;
    for (const r of s.reservations.values()) {
      if (r.status === 'ACTIVE' && new Date(r.expires_at).getTime() <= now) {
        r.status = 'EXPIRED';
        this.releaseHold(r);
        n++;
      }
    }
    return n;
  }

  private releaseHold(r: InventoryReservation) {
    const s = state();
    const p = s.products.get(r.product_id);
    if (p) p.reserved_quantity = Math.max(0, p.reserved_quantity - r.quantity);
    if (r.flash_deal_id) {
      const d = s.deals.get(r.flash_deal_id);
      if (d) d.reserved_claims = Math.max(0, d.reserved_claims - r.quantity);
    }
  }

  async reserve(sessionId: string, productId: string, quantity: number, flashDealId?: string | null): Promise<ReserveResult> {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) return { success: false, error: 'INVALID_QUANTITY' };
    this.expireSync();
    const s = state();
    const product = s.products.get(productId);
    if (!product || !product.is_active || product.category === 'INTERNAL_BRACE') return { success: false, error: 'SKU_LOCKED_OR_UNAVAILABLE' };
    if (product.stock_quantity - product.reserved_quantity < quantity) return { success: false, error: 'INSUFFICIENT_STOCK' };

    let locked = effectivePrice(product);
    let deal: FlashDeal | undefined;
    if (flashDealId) {
      deal = s.deals.get(flashDealId);
      const now = Date.now();
      if (
        !deal ||
        deal.product_id !== productId ||
        !deal.is_active ||
        new Date(deal.starts_at).getTime() > now ||
        new Date(deal.expires_at).getTime() <= now ||
        deal.max_claims - deal.claimed_count - deal.reserved_claims < quantity
      ) {
        return { success: false, error: 'FLASH_DEAL_DEPLETED' };
      }
      deal.reserved_claims += quantity;
      locked = deal.deal_price_cents;
    }

    product.reserved_quantity += quantity;
    const expires = new Date(Date.now() + FEES.RESERVATION_TTL_MINUTES * 60_000).toISOString();
    const r: InventoryReservation = {
      id: crypto.randomUUID(),
      session_id: sessionId,
      product_id: productId,
      flash_deal_id: flashDealId ?? null,
      quantity,
      locked_price_cents: locked,
      status: 'ACTIVE',
      expires_at: expires,
      created_at: nowIso()
    };
    s.reservations.set(r.id, r);
    return { success: true, reservation_id: r.id, locked_price_cents: locked, expires_at: expires };
  }

  async listActiveReservations(sessionId: string) {
    this.expireSync();
    return [...state().reservations.values()].filter((r) => r.session_id === sessionId && r.status === 'ACTIVE').map(clone);
  }

  async releaseReservations(sessionId: string) {
    let n = 0;
    for (const r of state().reservations.values()) {
      if (r.session_id === sessionId && r.status === 'ACTIVE') {
        r.status = 'RELEASED';
        this.releaseHold(r);
        n++;
      }
    }
    return n;
  }

  async sweepExpiredReservations() {
    return this.expireSync();
  }
  async refreshFacets() {
    /* computed on read */
  }

  async placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
    this.expireSync();
    const s = state();
    if (!input.reservationIds.length) return { ok: false, error: 'EMPTY_CART' };
    const res = input.reservationIds.map((id) => s.reservations.get(id));
    if (res.some((r) => !r || r.session_id !== input.sessionId)) return { ok: false, error: 'RESERVATION_MISMATCH' };
    if (res.some((r) => r!.status !== 'ACTIVE')) return { ok: false, error: 'RESERVATION_EXPIRED' };
    const subtotal = res.reduce((acc, r) => acc + r!.locked_price_cents * r!.quantity, 0);
    if (subtotal !== input.subtotalCents) return { ok: false, error: 'SUBTOTAL_MISMATCH' };

    // Convert leases → stock decrement (single synchronous critical section).
    for (const r of res as InventoryReservation[]) {
      const p = s.products.get(r.product_id)!;
      p.stock_quantity = Math.max(0, p.stock_quantity - r.quantity);
      p.reserved_quantity = Math.max(0, p.reserved_quantity - r.quantity);
      if (r.flash_deal_id) {
        const d = s.deals.get(r.flash_deal_id);
        if (d) {
          d.reserved_claims = Math.max(0, d.reserved_claims - r.quantity);
          d.claimed_count += r.quantity;
        }
      }
      r.status = 'CONVERTED';
    }

    const order: Order = {
      id: crypto.randomUUID(),
      order_number: randomOrderNumber((n) => [...s.orders.values()].some((o) => o.order_number === n)),
      user_id: null,
      customer_email: input.customerEmail,
      customer_name: input.customerName,
      shipping_address: input.shippingAddress,
      fulfillment_type: input.fulfillmentMode,
      includes_bios_preflash_service: input.includesBiosPreflash,
      includes_foam_gpu_brace: input.includesFoamBrace,
      assembly_fee_cents: input.assemblyFeeCents,
      services_fee_cents: input.servicesFeeCents,
      subtotal_cents: input.subtotalCents,
      total_charged_cents: input.totalChargedCents,
      current_stage: 'ORDER_CONFIRMED',
      assigned_technician_code: null,
      estimated_dispatch_date: input.estimatedDispatchDate,
      carrier: null,
      carrier_tracking_number: null,
      manifest_snapshot: input.manifestSnapshot,
      compatibility_confidence: input.compatibilityConfidence,
      requires_tech_clearance_check: input.requiresTechClearanceCheck,
      syndicate_package_slug: input.syndicatePackageSlug,
      created_at: nowIso(),
      updated_at: nowIso()
    };
    s.orders.set(order.id, order);
    s.logs.push({
      id: crypto.randomUUID(),
      order_id: order.id,
      stage: 'ORDER_CONFIRMED',
      technician_code: 'SYSTEM',
      telemetry_metrics: {},
      proof_screenshot_url: null,
      technician_notes: input.requiresTechClearanceCheck
        ? 'Inventory locked via reserve_inventory_atomic. TIGHT_TOLERANCE build flagged for technician clearance check.'
        : 'Inventory locked via reserve_inventory_atomic.',
      logged_at: nowIso()
    });
    return { ok: true, order: clone(order) };
  }

  /* --------------------------- orders ------------------------------ */
  async getOrderByNumber(orderNumber: string) {
    const o = [...state().orders.values()].find((x) => x.order_number === orderNumber);
    return o ? clone(o) : null;
  }
  async listTelemetryLogs(orderId: string) {
    return state()
      .logs.filter((l) => l.order_id === orderId)
      .sort((a, b) => a.logged_at.localeCompare(b.logged_at))
      .map(clone);
  }
  async listOrders(opts: { stage?: string; limit?: number } = {}) {
    let list = [...state().orders.values()];
    if (opts.stage) list = list.filter((o) => o.current_stage === opts.stage);
    list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return list.slice(0, opts.limit ?? 200).map(clone);
  }
  async advanceOrderStage(input: AdvanceStageInput): Promise<MutationResult<Order>> {
    const s = state();
    const order = s.orders.get(input.orderId);
    if (!order) return { ok: false, error: 'ORDER_NOT_FOUND' };
    const prev = { current_stage: order.current_stage, assigned_technician_code: order.assigned_technician_code };
    order.current_stage = input.toStage;
    if (input.toStage === 'BENCH_ASSEMBLY_IN_PROGRESS' || !order.assigned_technician_code) {
      if (input.technicianCode && input.technicianCode !== 'SYSTEM') order.assigned_technician_code = input.technicianCode;
    }
    if (input.carrier) order.carrier = input.carrier;
    if (input.trackingNumber) order.carrier_tracking_number = input.trackingNumber;
    order.updated_at = nowIso();
    s.logs.push({
      id: crypto.randomUUID(),
      order_id: order.id,
      stage: input.toStage,
      technician_code: input.technicianCode,
      telemetry_metrics: input.metrics,
      proof_screenshot_url: input.proofScreenshotUrl,
      technician_notes: input.notes,
      logged_at: nowIso()
    });
    await this.writeAudit({
      admin_id: input.adminId,
      action_type: 'BUILD_BAY_STAGE_ADVANCE',
      target_entity: 'orders',
      target_id: order.order_number,
      previous_state: prev,
      new_state: { current_stage: order.current_stage, assigned_technician_code: order.assigned_technician_code },
      ip_address: input.ip
    });
    return { ok: true, value: clone(order) };
  }
  async storeProof(orderNumber: string, bytes: Uint8Array, contentType: string, ext: string) {
    const id = `${orderNumber}-${randomToken(8)}.${ext}`;
    state().proofs.set(id, { bytes, contentType });
    return `/api/media/proof/${id}`;
  }
  async readProof(id: string) {
    return state().proofs.get(id) ?? null;
  }

  /* ---------------------------- vault ------------------------------ */
  async countAdmins() {
    return state().admins.size;
  }
  async getAdminByCodename(codename: string) {
    const a = [...state().admins.values()].find((x) => x.codename.toLowerCase() === codename.toLowerCase());
    return a ? clone(a) : null;
  }
  async getAdminById(id: string) {
    const a = state().admins.get(id);
    return a ? clone(a) : null;
  }
  async listAdmins() {
    return [...state().admins.values()].map(clone);
  }
  async createAdmin(input: CreateAdminInput): Promise<MutationResult<AdminVaultUser>> {
    if (await this.getAdminByCodename(input.codename)) return { ok: false, error: 'CODENAME_TAKEN' };
    const admin: AdminVaultUser = {
      id: crypto.randomUUID(),
      codename: input.codename,
      role: input.role,
      webauthn_credential_id: input.webauthnCredentialId,
      webauthn_public_key: input.webauthnPublicKey,
      webauthn_sign_count: input.webauthnSignCount,
      webauthn_transports: input.webauthnTransports,
      totp_secret_encrypted: input.totpSecretEncrypted,
      allowed_ips: [],
      last_login_at: null,
      is_locked: false,
      created_at: nowIso()
    };
    state().admins.set(admin.id, admin);
    return { ok: true, value: clone(admin) };
  }
  async recordAdminLogin(id: string, signCount: number) {
    const a = state().admins.get(id);
    if (a) {
      a.webauthn_sign_count = signCount;
      a.last_login_at = nowIso();
    }
  }
  async setAdminLocked(actorId: string, targetId: string, locked: boolean, ip: string): Promise<MutationResult> {
    const a = state().admins.get(targetId);
    if (!a) return { ok: false, error: 'ADMIN_NOT_FOUND' };
    const prev = a.is_locked;
    a.is_locked = locked;
    await this.writeAudit({ admin_id: actorId, action_type: locked ? 'ADMIN_LOCK' : 'ADMIN_UNLOCK', target_entity: 'admin_vault_users', target_id: a.codename, previous_state: { is_locked: prev }, new_state: { is_locked: locked }, ip_address: ip });
    return { ok: true, value: undefined };
  }

  async updateProductPricing(input: PricingUpdateInput): Promise<MutationResult<Product>> {
    const s = state();
    const p = s.products.get(input.productId);
    if (!p) return { ok: false, error: 'PRODUCT_NOT_FOUND' };
    if (input.basePriceCents < 0 || (input.salePriceCents != null && input.salePriceCents < 0)) return { ok: false, error: 'NEGATIVE_PRICE' };
    const verdict = checkPriceFloor(p, input.basePriceCents, input.salePriceCents, input.overrideToken, input.adminId, s.overrides);
    if (!verdict.ok) {
      await this.writeAudit({ admin_id: input.adminId, action_type: 'PRICE_FLOOR_BLOCKED', target_entity: 'products', target_id: p.sku, previous_state: { base: p.base_price_cents, sale: p.sale_price_cents }, new_state: { base: input.basePriceCents, sale: input.salePriceCents, error: verdict.error }, ip_address: input.ip });
      return { ok: false, error: verdict.error };
    }
    const prev = { base_price_cents: p.base_price_cents, sale_price_cents: p.sale_price_cents };
    p.base_price_cents = input.basePriceCents;
    p.sale_price_cents = input.salePriceCents;
    p.dual_admin_price_override_token = verdict.consumeToken;
    p.updated_at = nowIso();
    if (verdict.consumeToken) {
      const a = s.overrides.find((o) => o.token === verdict.consumeToken);
      if (a) a.consumed_at = nowIso();
    }
    await this.writeAudit({ admin_id: input.adminId, action_type: verdict.consumeToken ? 'PRICE_UPDATE_DUAL_OVERRIDE' : 'PRICE_UPDATE', target_entity: 'products', target_id: p.sku, previous_state: prev, new_state: { base_price_cents: p.base_price_cents, sale_price_cents: p.sale_price_cents }, ip_address: input.ip });
    return { ok: true, value: clone(p) };
  }

  async updateProductInventory(input: InventoryUpdateInput): Promise<MutationResult<Product>> {
    const p = state().products.get(input.productId);
    if (!p) return { ok: false, error: 'PRODUCT_NOT_FOUND' };
    if (!Number.isInteger(input.stockQuantity) || input.stockQuantity < 0) return { ok: false, error: 'INVALID_STOCK' };
    if (input.stockQuantity < p.reserved_quantity) return { ok: false, error: `STOCK_BELOW_ACTIVE_RESERVATIONS (${p.reserved_quantity} units leased)` };
    const prev = { stock_quantity: p.stock_quantity, warehouse_bin: p.warehouse_bin, overstock_priority: p.overstock_priority, is_leftover_clearance: p.is_leftover_clearance, is_active: p.is_active };
    p.stock_quantity = input.stockQuantity;
    p.warehouse_bin = input.warehouseBin;
    p.overstock_priority = input.overstockPriority;
    p.is_leftover_clearance = input.isLeftoverClearance;
    p.is_active = input.isActive;
    p.updated_at = nowIso();
    await this.writeAudit({ admin_id: input.adminId, action_type: 'INVENTORY_UPDATE', target_entity: 'products', target_id: p.sku, previous_state: prev, new_state: { stock_quantity: p.stock_quantity, warehouse_bin: p.warehouse_bin, overstock_priority: p.overstock_priority, is_leftover_clearance: p.is_leftover_clearance, is_active: p.is_active }, ip_address: input.ip });
    return { ok: true, value: clone(p) };
  }

  async createFlashDeal(input: CreateDealInput): Promise<MutationResult<FlashDeal>> {
    const p = state().products.get(input.productId);
    if (!p) return { ok: false, error: 'PRODUCT_NOT_FOUND' };
    if (input.dealPriceCents < Math.floor(p.cost_price_cents * FEES.PRICE_FLOOR_RATIO)) return { ok: false, error: 'PRICE_FLOOR_CIRCUIT_BREAKER_TRIPPED: flash deal price is more than 40% below wholesale cost.' };
    if (new Date(input.expiresAt) <= new Date(input.startsAt)) return { ok: false, error: 'INVALID_DEAL_WINDOW' };
    if (input.maxClaims < 1) return { ok: false, error: 'INVALID_CLAIM_CAP' };
    const deal: FlashDeal = {
      id: crypto.randomUUID(),
      product_id: p.id,
      deal_title: input.dealTitle,
      deal_price_cents: input.dealPriceCents,
      max_claims: input.maxClaims,
      claimed_count: 0,
      reserved_claims: 0,
      starts_at: input.startsAt,
      expires_at: input.expiresAt,
      banner_accent_hex: input.bannerAccentHex,
      is_active: true,
      created_at: nowIso()
    };
    state().deals.set(deal.id, deal);
    await this.writeAudit({ admin_id: input.adminId, action_type: 'FLASH_DEAL_CREATE', target_entity: 'flash_deals', target_id: deal.id, previous_state: null, new_state: deal, ip_address: input.ip });
    return { ok: true, value: clone(deal) };
  }

  async setFlashDealActive(adminId: string, dealId: string, active: boolean, ip: string): Promise<MutationResult> {
    const d = state().deals.get(dealId);
    if (!d) return { ok: false, error: 'DEAL_NOT_FOUND' };
    const prev = d.is_active;
    d.is_active = active;
    await this.writeAudit({ admin_id: adminId, action_type: active ? 'FLASH_DEAL_ACTIVATE' : 'FLASH_DEAL_DEACTIVATE', target_entity: 'flash_deals', target_id: dealId, previous_state: { is_active: prev }, new_state: { is_active: active }, ip_address: ip });
    return { ok: true, value: undefined };
  }

  async issuePriceOverride(approverId: string, productId: string, minPriceCents: number, ip: string): Promise<MutationResult<PriceOverrideApproval>> {
    const approver = state().admins.get(approverId);
    const p = state().products.get(productId);
    if (!approver || approver.role !== 'OVERSEER') return { ok: false, error: 'ONLY_OVERSEERS_MAY_ISSUE_OVERRIDES' };
    if (!p) return { ok: false, error: 'PRODUCT_NOT_FOUND' };
    const approval: PriceOverrideApproval = {
      token: randomToken(24),
      product_id: productId,
      min_price_cents: minPriceCents,
      approver_admin_id: approverId,
      approver_codename: approver.codename,
      expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      consumed_at: null,
      created_at: nowIso()
    };
    state().overrides.push(approval);
    await this.writeAudit({ admin_id: approverId, action_type: 'PRICE_OVERRIDE_ISSUED', target_entity: 'products', target_id: p.sku, previous_state: null, new_state: { min_price_cents: minPriceCents, expires_at: approval.expires_at }, ip_address: ip });
    return { ok: true, value: clone(approval) };
  }

  async listPriceOverrides() {
    return [...state().overrides].sort((a, b) => b.created_at.localeCompare(a.created_at)).map(clone);
  }

  async writeAudit(entry: Omit<AdminAuditLog, 'id' | 'executed_at' | 'admin_codename'>) {
    // Append-only: no update/delete API exists for audit rows.
    state().audit.push(Object.freeze({ ...clone(entry), id: crypto.randomUUID(), executed_at: nowIso() }) as AdminAuditLog);
  }

  async listAuditLogs(limit = 200) {
    const admins = state().admins;
    return [...state().audit]
      .reverse()
      .slice(0, limit)
      .map((a) => ({ ...clone(a), admin_codename: admins.get(a.admin_id)?.codename }));
  }
}
