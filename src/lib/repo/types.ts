import type {
  AdminAuditLog,
  AdminRole,
  AdminVaultUser,
  BuildBayStage,
  BuildBayTelemetryLog,
  CatalogQuery,
  ConfidenceTier,
  FlashDeal,
  FlashDealWithProduct,
  FulfillmentMode,
  HardwareFacet,
  InventoryReservation,
  ManifestSnapshot,
  Order,
  PriceOverrideApproval,
  Product,
  PublicProduct,
  ShippingAddress,
  SyndicatePackageResolved,
  TelemetryMetrics
} from '@/lib/types';

export type ReserveError = 'SKU_LOCKED_OR_UNAVAILABLE' | 'INSUFFICIENT_STOCK' | 'FLASH_DEAL_DEPLETED' | 'INVALID_QUANTITY';

export type ReserveResult =
  | { success: true; reservation_id: string; locked_price_cents: number; expires_at: string }
  | { success: false; error: ReserveError };

export interface PlaceOrderInput {
  sessionId: string;
  reservationIds: string[];
  customerEmail: string;
  customerName: string;
  shippingAddress: ShippingAddress;
  fulfillmentMode: FulfillmentMode;
  includesBiosPreflash: boolean;
  includesFoamBrace: boolean;
  assemblyFeeCents: number;
  servicesFeeCents: number;
  subtotalCents: number;
  totalChargedCents: number;
  estimatedDispatchDate: string;
  manifestSnapshot: ManifestSnapshot;
  compatibilityConfidence: ConfidenceTier;
  requiresTechClearanceCheck: boolean;
  syndicatePackageSlug: string | null;
}

export type PlaceOrderResult =
  | { ok: true; order: Order }
  | { ok: false; error: 'RESERVATION_EXPIRED' | 'RESERVATION_MISMATCH' | 'SUBTOTAL_MISMATCH' | 'EMPTY_CART' | 'DB_ERROR'; detail?: string };

export interface AdvanceStageInput {
  orderId: string;
  toStage: BuildBayStage;
  technicianCode: string;
  metrics: TelemetryMetrics;
  proofScreenshotUrl: string | null;
  notes: string | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  adminId: string;
  ip: string;
}

export interface PricingUpdateInput {
  adminId: string;
  productId: string;
  basePriceCents: number;
  salePriceCents: number | null;
  overrideToken: string | null;
  ip: string;
}

export interface InventoryUpdateInput {
  adminId: string;
  productId: string;
  stockQuantity: number;
  warehouseBin: string;
  overstockPriority: boolean;
  isLeftoverClearance: boolean;
  isActive: boolean;
  ip: string;
}

export interface ProductImagesInput {
  adminId: string;
  productId: string;
  /** Ordered photo list; first entry becomes the main photo. Empty = fall back to the category photo. */
  photos: string[];
  ip: string;
}

export interface CreateDealInput {
  adminId: string;
  productId: string;
  dealTitle: string;
  dealPriceCents: number;
  maxClaims: number;
  startsAt: string;
  expiresAt: string;
  bannerAccentHex: string;
  ip: string;
}

export interface CreateAdminInput {
  codename: string;
  role: AdminRole;
  webauthnCredentialId: string;
  webauthnPublicKey: string;
  webauthnSignCount: number;
  webauthnTransports: string[];
  totpSecretEncrypted: string;
}

export type MutationResult<T = void> = { ok: true; value: T } | { ok: false; error: string };

export interface Repository {
  readonly mode: 'memory' | 'supabase';

  /* Catalog (storefront-safe) */
  listProducts(q: CatalogQuery): Promise<PublicProduct[]>;
  getProductBySlug(slug: string): Promise<PublicProduct | null>;
  getProductsByIds(ids: string[]): Promise<PublicProduct[]>;
  getFacets(): Promise<HardwareFacet[]>;
  listFlashDeals(opts?: { includeUpcoming?: boolean; includeInactive?: boolean }): Promise<FlashDealWithProduct[]>;
  getFlashDeal(id: string): Promise<FlashDeal | null>;
  listPackages(): Promise<SyndicatePackageResolved[]>;
  getPackage(slug: string): Promise<SyndicatePackageResolved | null>;

  /* Internal catalog — includes cost columns (Auto-Forge + Overseer only) */
  listProductsInternal(): Promise<Product[]>;
  getProductInternal(id: string): Promise<Product | null>;

  /* Atomic reservation ledger */
  reserve(sessionId: string, productId: string, quantity: number, flashDealId?: string | null): Promise<ReserveResult>;
  listActiveReservations(sessionId: string): Promise<InventoryReservation[]>;
  releaseReservations(sessionId: string): Promise<number>;
  placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult>;
  sweepExpiredReservations(): Promise<number>;
  refreshFacets(): Promise<void>;

  /* Orders & Build Bay telemetry */
  getOrderByNumber(orderNumber: string): Promise<Order | null>;
  listTelemetryLogs(orderId: string): Promise<BuildBayTelemetryLog[]>;
  listOrders(opts?: { stage?: BuildBayStage; limit?: number }): Promise<Order[]>;
  advanceOrderStage(input: AdvanceStageInput): Promise<MutationResult<Order>>;
  storeProof(orderNumber: string, bytes: Uint8Array, contentType: string, ext: string): Promise<string>;
  readProof?(id: string): Promise<{ bytes: Uint8Array; contentType: string } | null>;

  /* Overseer vault */
  countAdmins(): Promise<number>;
  getAdminByCodename(codename: string): Promise<AdminVaultUser | null>;
  getAdminById(id: string): Promise<AdminVaultUser | null>;
  listAdmins(): Promise<AdminVaultUser[]>;
  createAdmin(input: CreateAdminInput): Promise<MutationResult<AdminVaultUser>>;
  recordAdminLogin(id: string, signCount: number): Promise<void>;
  setAdminLocked(actorId: string, targetId: string, locked: boolean, ip: string): Promise<MutationResult>;

  updateProductPricing(input: PricingUpdateInput): Promise<MutationResult<Product>>;
  updateProductInventory(input: InventoryUpdateInput): Promise<MutationResult<Product>>;
  /** Product photos: upload bytes (already WebP), persist ordered list, delete a stored object. */
  storeProductImage(productId: string, bytes: Uint8Array): Promise<string>;
  deleteProductImage(url: string): Promise<void>;
  updateProductImages(input: ProductImagesInput): Promise<MutationResult<Product>>;
  createFlashDeal(input: CreateDealInput): Promise<MutationResult<FlashDeal>>;
  setFlashDealActive(adminId: string, dealId: string, active: boolean, ip: string): Promise<MutationResult>;
  issuePriceOverride(approverId: string, productId: string, minPriceCents: number, ip: string): Promise<MutationResult<PriceOverrideApproval>>;
  listPriceOverrides(): Promise<PriceOverrideApproval[]>;

  writeAudit(entry: Omit<AdminAuditLog, 'id' | 'executed_at' | 'admin_codename'>): Promise<void>;
  listAuditLogs(limit?: number): Promise<AdminAuditLog[]>;
}
