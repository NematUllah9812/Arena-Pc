import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  AdminAuditLog,
  AdminVaultUser,
  BuildBayTelemetryLog,
  CatalogQuery,
  FlashDeal,
  FlashDealWithProduct,
  HardwareFacet,
  InventoryReservation,
  Order,
  PriceOverrideApproval,
  Product,
  PublicProduct,
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
import { filterAndSortProducts, resolvePackage, toPublicProduct } from './shared';

/** Every products column except the generated search_vector. */
const PRODUCT_COLUMNS =
  'id,sku,name,slug,brand,category,base_price_cents,sale_price_cents,cost_price_cents,dual_admin_price_override_token,' +
  'stock_quantity,reserved_quantity,warehouse_bin,days_in_inventory,overstock_priority,is_leftover_clearance,is_active,' +
  'weight_grams,performance_score,gaming_tier_weight,workstation_tier_weight,tdp_watts,primary_image_url,gallery_urls,' +
  'model_3d_glb_url,specs,description,created_at,updated_at';

const PROOF_BUCKET = 'build-bay-proofs';

function normalizeProduct(row: Record<string, unknown>): Product {
  const p = row as unknown as Product;
  return {
    ...p,
    gaming_tier_weight: Number(p.gaming_tier_weight ?? 1),
    workstation_tier_weight: Number(p.workstation_tier_weight ?? 1),
    gallery_urls: p.gallery_urls ?? [],
    specs: p.specs ?? {}
  };
}

function normalizeAdmin(row: Record<string, unknown>): AdminVaultUser {
  const a = row as unknown as AdminVaultUser;
  return {
    ...a,
    webauthn_sign_count: Number(a.webauthn_sign_count ?? 0),
    webauthn_transports: a.webauthn_transports ?? [],
    allowed_ips: (a.allowed_ips ?? []).map(String)
  };
}

function errMessage(e: unknown): string {
  if (!e) return 'UNKNOWN_ERROR';
  if (typeof e === 'string') return e;
  const m = (e as { message?: string }).message;
  return m ?? JSON.stringify(e);
}

export class SupabaseRepository implements Repository {
  readonly mode = 'supabase' as const;
  private readonly db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'x-application-name': 'vortex-labs-foundry' } }
    });
  }

  /* ---------------------------- catalog ---------------------------- */
  private async allProducts(): Promise<Product[]> {
    const { data, error } = await this.db.from('products').select(PRODUCT_COLUMNS).neq('category', 'INTERNAL_BRACE');
    if (error) throw new Error(`CATALOG_READ_FAILED: ${error.message}`);
    return (data ?? []).map((r) => normalizeProduct(r as unknown as Record<string, unknown>));
  }

  async listProducts(q: CatalogQuery): Promise<PublicProduct[]> {
    const products = (await this.allProducts()).map(toPublicProduct);
    let ranked: string[] | undefined;
    const term = q.q?.trim();
    if (term) {
      const { data, error } = await this.db.rpc('catalog_search', { p_query: term, p_limit: 200 });
      if (!error && Array.isArray(data)) ranked = (data as { id: string }[]).map((r) => r.id);
    }
    return filterAndSortProducts(products, q, ranked);
  }

  async getProductBySlug(slug: string) {
    const { data, error } = await this.db
      .from('products')
      .select(PRODUCT_COLUMNS)
      .eq('slug', slug)
      .eq('is_active', true)
      .neq('category', 'INTERNAL_BRACE')
      .maybeSingle();
    if (error || !data) return null;
    return toPublicProduct(normalizeProduct(data as unknown as Record<string, unknown>));
  }

  async getProductsByIds(ids: string[]) {
    if (!ids.length) return [];
    const { data, error } = await this.db.from('products').select(PRODUCT_COLUMNS).in('id', ids.slice(0, 200));
    if (error) throw new Error(`CATALOG_READ_FAILED: ${error.message}`);
    return (data ?? []).map((r) => toPublicProduct(normalizeProduct(r as unknown as Record<string, unknown>)));
  }

  async getFacets(): Promise<HardwareFacet[]> {
    const { data, error } = await this.db.from('mv_hardware_facets').select('*');
    if (error) return [];
    return (data ?? []).map((f) => ({
      ...(f as HardwareFacet),
      cpu_socket: (f as HardwareFacet).cpu_socket || null,
      memory_type: (f as HardwareFacet).memory_type || null,
      form_factor: (f as HardwareFacet).form_factor || null
    }));
  }

  async listFlashDeals(opts: { includeUpcoming?: boolean; includeInactive?: boolean } = {}): Promise<FlashDealWithProduct[]> {
    let query = this.db.from('flash_deals').select('*').order('expires_at', { ascending: true });
    const nowIso = new Date().toISOString();
    if (!opts.includeInactive) {
      query = query.eq('is_active', true).gt('expires_at', nowIso);
      if (!opts.includeUpcoming) query = query.lte('starts_at', nowIso);
    }
    const { data, error } = await query;
    if (error) throw new Error(`DEALS_READ_FAILED: ${error.message}`);
    const deals = (data ?? []) as FlashDeal[];
    const products = new Map((await this.getProductsByIds([...new Set(deals.map((d) => d.product_id))])).map((p) => [p.id, p]));
    return deals.filter((d) => products.has(d.product_id)).map((d) => ({ ...d, product: products.get(d.product_id)! }));
  }

  async getFlashDeal(id: string) {
    const { data } = await this.db.from('flash_deals').select('*').eq('id', id).maybeSingle();
    return (data as FlashDeal | null) ?? null;
  }

  async listPackages() {
    const [{ data, error }, products] = await Promise.all([
      this.db.from('syndicate_packages').select('*').eq('is_active', true).order('sort_order'),
      this.allProducts()
    ]);
    if (error) throw new Error(`PACKAGES_READ_FAILED: ${error.message}`);
    const pub = products.map(toPublicProduct);
    return ((data ?? []) as SyndicatePackage[]).map((p) => resolvePackage(p, pub));
  }

  async getPackage(slug: string) {
    const { data } = await this.db.from('syndicate_packages').select('*').eq('slug', slug).eq('is_active', true).maybeSingle();
    if (!data) return null;
    const pkg = data as SyndicatePackage;
    const { data: rows } = await this.db.from('products').select(PRODUCT_COLUMNS).in('sku', pkg.component_skus);
    const pub = (rows ?? []).map((r) => toPublicProduct(normalizeProduct(r as unknown as Record<string, unknown>)));
    return resolvePackage(pkg, pub);
  }

  async listProductsInternal() {
    const { data, error } = await this.db.from('products').select(PRODUCT_COLUMNS).order('category').order('name');
    if (error) throw new Error(`CATALOG_READ_FAILED: ${error.message}`);
    return (data ?? []).map((r) => normalizeProduct(r as unknown as Record<string, unknown>));
  }

  async getProductInternal(id: string) {
    const { data } = await this.db.from('products').select(PRODUCT_COLUMNS).eq('id', id).maybeSingle();
    return data ? normalizeProduct(data as unknown as Record<string, unknown>) : null;
  }

  /* ------------------------ reservation ledger --------------------- */
  async reserve(sessionId: string, productId: string, quantity: number, flashDealId?: string | null): Promise<ReserveResult> {
    const { data, error } = await this.db.rpc('reserve_inventory_atomic', {
      p_session_id: sessionId,
      p_product_id: productId,
      p_quantity: quantity,
      p_flash_deal_id: flashDealId ?? null
    });
    if (error) return { success: false, error: 'SKU_LOCKED_OR_UNAVAILABLE' };
    return data as ReserveResult;
  }

  async listActiveReservations(sessionId: string) {
    const { data, error } = await this.db
      .from('inventory_reservations')
      .select('*')
      .eq('session_id', sessionId)
      .eq('status', 'ACTIVE')
      .gt('expires_at', new Date().toISOString())
      .order('created_at');
    if (error) throw new Error(`RESERVATION_READ_FAILED: ${error.message}`);
    return (data ?? []) as InventoryReservation[];
  }

  async releaseReservations(sessionId: string) {
    const { data, error } = await this.db.rpc('release_session_reservations', { p_session_id: sessionId });
    if (error) throw new Error(`RESERVATION_RELEASE_FAILED: ${error.message}`);
    return Number(data ?? 0);
  }

  async placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
    const { data, error } = await this.db.rpc('place_order_atomic', {
      p_session_id: input.sessionId,
      p_reservation_ids: input.reservationIds,
      p_order: {
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
        estimated_dispatch_date: input.estimatedDispatchDate,
        manifest_snapshot: input.manifestSnapshot,
        compatibility_confidence: input.compatibilityConfidence,
        requires_tech_clearance_check: input.requiresTechClearanceCheck,
        syndicate_package_slug: input.syndicatePackageSlug
      }
    });
    if (error) return { ok: false, error: 'DB_ERROR', detail: error.message };
    const res = data as { ok: boolean; order?: Order; error?: string; detail?: unknown };
    if (!res.ok) return { ok: false, error: res.error as Exclude<PlaceOrderResult, { ok: true }>['error'], detail: res.detail != null ? String(res.detail) : undefined };
    return { ok: true, order: res.order! };
  }

  async sweepExpiredReservations() {
    const { data, error } = await this.db.rpc('expire_stale_reservations');
    if (error) throw new Error(errMessage(error));
    return Number(data ?? 0);
  }

  async refreshFacets() {
    await this.db.rpc('refresh_hardware_facets');
  }

  /* --------------------------- orders ------------------------------ */
  async getOrderByNumber(orderNumber: string) {
    const { data } = await this.db.from('orders').select('*').eq('order_number', orderNumber).maybeSingle();
    return (data as Order | null) ?? null;
  }

  async listTelemetryLogs(orderId: string) {
    const { data, error } = await this.db.from('build_bay_telemetry_logs').select('*').eq('order_id', orderId).order('logged_at');
    if (error) throw new Error(`TELEMETRY_READ_FAILED: ${error.message}`);
    return (data ?? []) as BuildBayTelemetryLog[];
  }

  async listOrders(opts: { stage?: string; limit?: number } = {}) {
    let q = this.db.from('orders').select('*').order('created_at', { ascending: false }).limit(opts.limit ?? 200);
    if (opts.stage) q = q.eq('current_stage', opts.stage);
    const { data, error } = await q;
    if (error) throw new Error(`ORDERS_READ_FAILED: ${error.message}`);
    return (data ?? []) as Order[];
  }

  async advanceOrderStage(input: AdvanceStageInput): Promise<MutationResult<Order>> {
    const { data, error } = await this.db.rpc('advance_order_stage', {
      p_admin_id: input.adminId,
      p_order_id: input.orderId,
      p_to_stage: input.toStage,
      p_technician_code: input.technicianCode,
      p_metrics: input.metrics,
      p_proof_url: input.proofScreenshotUrl,
      p_notes: input.notes,
      p_carrier: input.carrier ?? null,
      p_tracking: input.trackingNumber ?? null,
      p_ip: input.ip
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, value: data as Order };
  }

  async storeProof(orderNumber: string, bytes: Uint8Array, contentType: string, ext: string) {
    const path = `${orderNumber}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const { error } = await this.db.storage.from(PROOF_BUCKET).upload(path, bytes, { contentType, upsert: false, cacheControl: '31536000' });
    if (error) throw new Error(`PROOF_UPLOAD_FAILED: ${error.message}`);
    return this.db.storage.from(PROOF_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  /* ---------------------------- vault ------------------------------ */
  async countAdmins() {
    const { count, error } = await this.db.from('admin_vault_users').select('id', { count: 'exact', head: true });
    if (error) throw new Error(`VAULT_READ_FAILED: ${error.message}`);
    return count ?? 0;
  }

  async getAdminByCodename(codename: string) {
    const { data } = await this.db.from('admin_vault_users').select('*').ilike('codename', codename.replace(/[%_\\]/g, '')).maybeSingle();
    return data ? normalizeAdmin(data) : null;
  }

  async getAdminById(id: string) {
    const { data } = await this.db.from('admin_vault_users').select('*').eq('id', id).maybeSingle();
    return data ? normalizeAdmin(data) : null;
  }

  async listAdmins() {
    const { data } = await this.db.from('admin_vault_users').select('*').order('created_at');
    return (data ?? []).map(normalizeAdmin);
  }

  async createAdmin(input: CreateAdminInput): Promise<MutationResult<AdminVaultUser>> {
    const { data, error } = await this.db
      .from('admin_vault_users')
      .insert({
        codename: input.codename,
        role: input.role,
        webauthn_credential_id: input.webauthnCredentialId,
        webauthn_public_key: input.webauthnPublicKey,
        webauthn_sign_count: input.webauthnSignCount,
        webauthn_transports: input.webauthnTransports,
        totp_secret_encrypted: input.totpSecretEncrypted
      })
      .select('*')
      .single();
    if (error) return { ok: false, error: error.code === '23505' ? 'CODENAME_TAKEN' : error.message };
    return { ok: true, value: normalizeAdmin(data) };
  }

  async recordAdminLogin(id: string, signCount: number) {
    await this.db.from('admin_vault_users').update({ webauthn_sign_count: signCount, last_login_at: new Date().toISOString() }).eq('id', id);
  }

  async setAdminLocked(actorId: string, targetId: string, locked: boolean, ip: string): Promise<MutationResult> {
    const { data, error } = await this.db.rpc('admin_set_locked', { p_actor_id: actorId, p_target_id: targetId, p_locked: locked, p_ip: ip });
    if (error) return { ok: false, error: error.message };
    const res = data as { ok: boolean; error?: string };
    return res.ok ? { ok: true, value: undefined } : { ok: false, error: res.error ?? 'UNKNOWN' };
  }

  async updateProductPricing(input: PricingUpdateInput): Promise<MutationResult<Product>> {
    const { data, error } = await this.db.rpc('admin_update_product_pricing', {
      p_admin_id: input.adminId,
      p_product_id: input.productId,
      p_base_price_cents: input.basePriceCents,
      p_sale_price_cents: input.salePriceCents,
      p_override_token: input.overrideToken ?? '',
      p_ip: input.ip
    });
    if (error) return { ok: false, error: error.message };
    const res = data as { ok: boolean; product?: Record<string, unknown>; error?: string };
    return res.ok ? { ok: true, value: normalizeProduct(res.product!) } : { ok: false, error: res.error ?? 'UNKNOWN' };
  }

  async updateProductInventory(input: InventoryUpdateInput): Promise<MutationResult<Product>> {
    const { data, error } = await this.db.rpc('admin_update_product_inventory', {
      p_admin_id: input.adminId,
      p_product_id: input.productId,
      p_stock: input.stockQuantity,
      p_bin: input.warehouseBin,
      p_overstock: input.overstockPriority,
      p_clearance: input.isLeftoverClearance,
      p_active: input.isActive,
      p_ip: input.ip
    });
    if (error) return { ok: false, error: error.message };
    const res = data as { ok: boolean; product?: Record<string, unknown>; error?: string };
    return res.ok ? { ok: true, value: normalizeProduct(res.product!) } : { ok: false, error: res.error ?? 'UNKNOWN' };
  }

  async createFlashDeal(input: CreateDealInput): Promise<MutationResult<FlashDeal>> {
    const { data, error } = await this.db.rpc('admin_create_flash_deal', {
      p_admin_id: input.adminId,
      p_product_id: input.productId,
      p_title: input.dealTitle,
      p_price: input.dealPriceCents,
      p_max_claims: input.maxClaims,
      p_starts: input.startsAt,
      p_expires: input.expiresAt,
      p_accent: input.bannerAccentHex,
      p_ip: input.ip
    });
    if (error) return { ok: false, error: error.message };
    const res = data as { ok: boolean; deal?: FlashDeal; error?: string };
    return res.ok ? { ok: true, value: res.deal! } : { ok: false, error: res.error ?? 'UNKNOWN' };
  }

  async setFlashDealActive(adminId: string, dealId: string, active: boolean, ip: string): Promise<MutationResult> {
    const { data, error } = await this.db.rpc('admin_set_flash_deal_active', { p_admin_id: adminId, p_deal_id: dealId, p_active: active, p_ip: ip });
    if (error) return { ok: false, error: error.message };
    const res = data as { ok: boolean; error?: string };
    return res.ok ? { ok: true, value: undefined } : { ok: false, error: res.error ?? 'UNKNOWN' };
  }

  async issuePriceOverride(approverId: string, productId: string, minPriceCents: number, ip: string): Promise<MutationResult<PriceOverrideApproval>> {
    const { data, error } = await this.db.rpc('issue_price_override', { p_approver_id: approverId, p_product_id: productId, p_min_price_cents: minPriceCents, p_ip: ip });
    if (error) return { ok: false, error: error.message.includes('ROLE_FORBIDDEN') ? 'ONLY_OVERSEERS_MAY_ISSUE_OVERRIDES' : error.message };
    const res = data as { ok: boolean; approval?: PriceOverrideApproval; error?: string };
    return res.ok ? { ok: true, value: res.approval! } : { ok: false, error: res.error ?? 'UNKNOWN' };
  }

  async listPriceOverrides() {
    const [{ data }, admins] = await Promise.all([
      this.db.from('price_override_approvals').select('*').order('created_at', { ascending: false }).limit(50),
      this.listAdmins()
    ]);
    const names = new Map(admins.map((a) => [a.id, a.codename]));
    return ((data ?? []) as Omit<PriceOverrideApproval, 'approver_codename'>[]).map((o) => ({
      ...o,
      approver_codename: names.get(o.approver_admin_id) ?? 'UNKNOWN'
    }));
  }

  async writeAudit(entry: Omit<AdminAuditLog, 'id' | 'executed_at' | 'admin_codename'>) {
    const { error } = await this.db.from('admin_audit_logs').insert(entry);
    if (error) throw new Error(`AUDIT_WRITE_FAILED: ${error.message}`);
  }

  async listAuditLogs(limit = 200) {
    const [{ data }, admins] = await Promise.all([
      this.db.from('admin_audit_logs').select('*').order('executed_at', { ascending: false }).limit(limit),
      this.listAdmins()
    ]);
    const names = new Map(admins.map((a) => [a.id, a.codename]));
    return ((data ?? []) as AdminAuditLog[]).map((a) => ({ ...a, admin_codename: names.get(a.admin_id) }));
  }
}
