'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { evaluateBuildCompatibilityV2, manifestFromParts, type CompatibilityReportV2 } from '@/lib/engine/compatibility-engine-v2';
import { quoteOrder, type OrderQuote } from '@/lib/engine/pricing';
import type { FulfillmentMode, PartCategory, PublicProduct } from '@/lib/types';
import { playClick } from '@/components/layout/feedback';
import { useToast } from '@/components/layout/Toasts';

export const CART_STORAGE_KEY = 'vortex.cart.v2';
const SINGLE_SLOT: PartCategory[] = ['CPU', 'MOTHERBOARD', 'CPU_COOLER', 'PSU', 'CASE'];

export interface CartLine {
  productId: string;
  sku: string;
  slug: string;
  name: string;
  brand: string;
  category: PartCategory;
  image: string;
  unitPriceCents: number;
  basePriceCents: number;
  quantity: number;
  flashDealId: string | null;
  weightGrams: number;
  tdpWatts: number;
  specs: Record<string, unknown>;
  bin: string;
}

export interface CartLease {
  expiresAt: string;
  lockedPrices: Record<string, number>;
}

interface CartState {
  lines: CartLine[];
  mode: FulfillmentMode;
  packageSlug: string | null;
  optInBios: boolean;
  lease: CartLease | null;
}

const EMPTY: CartState = { lines: [], mode: 'PRO_BUILT_FOUNDRY_RIG', packageSlug: null, optInBios: false, lease: null };

export function lineFromProduct(p: PublicProduct, opts: { quantity?: number; flashDealId?: string | null; dealPriceCents?: number } = {}): CartLine {
  return {
    productId: p.id,
    sku: p.sku,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    category: p.category,
    image: p.primary_image_url,
    unitPriceCents: opts.dealPriceCents ?? p.sale_price_cents ?? p.base_price_cents,
    basePriceCents: p.base_price_cents,
    quantity: opts.quantity ?? 1,
    flashDealId: opts.flashDealId ?? null,
    weightGrams: p.weight_grams,
    tdpWatts: p.tdp_watts,
    specs: p.specs,
    bin: p.warehouse_bin
  };
}

interface CartApi extends CartState {
  hydrated: boolean;
  count: number;
  subtotalCents: number;
  report: CompatibilityReportV2 | null;
  quote: OrderQuote;
  isPackageIntact: boolean;
  add: (p: PublicProduct, opts?: { quantity?: number; flashDealId?: string | null; dealPriceCents?: number; silent?: boolean }) => void;
  replaceWith: (lines: CartLine[], opts?: { packageSlug?: string | null; mode?: FulfillmentMode }) => void;
  setQuantity: (productId: string, flashDealId: string | null, qty: number) => void;
  remove: (productId: string, flashDealId: string | null) => void;
  clear: () => void;
  setMode: (m: FulfillmentMode) => void;
  setOptInBios: (v: boolean) => void;
  setLease: (lease: CartLease | null) => void;
  refreshPrices: (products: PublicProduct[]) => void;
}

const Ctx = createContext<CartApi | null>(null);

async function releaseLease() {
  try {
    await fetch('/api/cart/release', { method: 'POST', keepalive: true });
  } catch {
    /* best effort */
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CartState>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const { push } = useToast();
  const leaseRef = useRef<CartLease | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartState;
        const lease = parsed.lease && new Date(parsed.lease.expiresAt).getTime() > Date.now() ? parsed.lease : null;
        setState({ ...EMPTY, ...parsed, lease });
      }
    } catch {
      /* corrupted storage */
    }
    setHydrated(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY && e.newValue) {
        try {
          setState({ ...EMPTY, ...(JSON.parse(e.newValue) as CartState) });
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    leaseRef.current = state.lease;
    if (hydrated) localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  /** Any change to the bill of materials invalidates the server-side lease. */
  const mutate = useCallback((fn: (s: CartState) => CartState) => {
    setState((prev) => {
      const next = fn(prev);
      if (prev.lease && next.lines !== prev.lines) {
        void releaseLease();
        return { ...next, lease: null };
      }
      return next;
    });
  }, []);

  const add = useCallback<CartApi['add']>(
    (p, opts = {}) => {
      if (p.available_quantity <= 0) {
        push({ title: 'SKU depleted', body: `${p.name} has no unreserved stock right now.`, tone: 'error' });
        return;
      }
      const line = lineFromProduct(p, opts);
      let replaced: string | null = null;
      mutate((s) => {
        let lines = [...s.lines];
        if (SINGLE_SLOT.includes(p.category)) {
          const existing = lines.find((l) => l.category === p.category && l.productId !== p.id);
          if (existing) {
            replaced = existing.name;
            lines = lines.filter((l) => l !== existing);
          }
        }
        const idx = lines.findIndex((l) => l.productId === line.productId && l.flashDealId === line.flashDealId);
        if (idx >= 0) {
          const max = SINGLE_SLOT.includes(p.category) ? 1 : 10;
          lines[idx] = { ...lines[idx], quantity: Math.min(max, lines[idx].quantity + line.quantity) };
        } else lines.push(line);
        return { ...s, lines, packageSlug: null };
      });
      playClick('thock');
      if (!opts.silent)
        push({
          title: replaced ? 'Slot swapped' : 'Added to manifest',
          body: replaced ? `${p.name} replaced ${replaced}.` : `${p.name} · ${opts.flashDealId ? 'flash-deal price locks at checkout' : 'locks for 10 min at checkout'}`
        });
    },
    [mutate, push]
  );

  const replaceWith = useCallback<CartApi['replaceWith']>(
    (lines, opts = {}) => {
      mutate((s) => ({ ...s, lines, packageSlug: opts.packageSlug ?? null, mode: opts.mode ?? s.mode }));
      playClick('confirm');
    },
    [mutate]
  );

  const setQuantity = useCallback<CartApi['setQuantity']>(
    (productId, flashDealId, qty) => {
      mutate((s) => {
        const lines = s.lines
          .map((l) => (l.productId === productId && l.flashDealId === flashDealId ? { ...l, quantity: Math.max(0, Math.min(SINGLE_SLOT.includes(l.category) ? 1 : 10, qty)) } : l))
          .filter((l) => l.quantity > 0);
        return { ...s, lines, packageSlug: null };
      });
      playClick();
    },
    [mutate]
  );

  const remove = useCallback<CartApi['remove']>(
    (productId, flashDealId) => {
      mutate((s) => ({ ...s, lines: s.lines.filter((l) => !(l.productId === productId && l.flashDealId === flashDealId)), packageSlug: null }));
      playClick();
    },
    [mutate]
  );

  const clear = useCallback(() => mutate(() => ({ ...EMPTY, mode: state.mode })), [mutate, state.mode]);
  const setMode = useCallback((m: FulfillmentMode) => setState((s) => ({ ...s, mode: m })), []);
  const setOptInBios = useCallback((v: boolean) => setState((s) => ({ ...s, optInBios: v })), []);
  const setLease = useCallback((lease: CartLease | null) => setState((s) => ({ ...s, lease })), []);
  const refreshPrices = useCallback((products: PublicProduct[]) => {
    const map = new Map(products.map((p) => [p.id, p]));
    setState((s) => ({
      ...s,
      lines: s.lines.map((l) => {
        const p = map.get(l.productId);
        if (!p || l.flashDealId) return l;
        return { ...l, unitPriceCents: p.sale_price_cents ?? p.base_price_cents, basePriceCents: p.base_price_cents, specs: p.specs, bin: p.warehouse_bin };
      })
    }));
  }, []);

  // Expire lease client-side.
  useEffect(() => {
    if (!state.lease) return;
    const ms = new Date(state.lease.expiresAt).getTime() - Date.now();
    const t = setTimeout(() => {
      setState((s) => ({ ...s, lease: null }));
      push({ title: 'Inventory lock expired', body: 'Your 10-minute reservation lapsed. Re-lock to continue checkout.', tone: 'warn' });
    }, Math.max(0, ms));
    return () => clearTimeout(t);
  }, [state.lease, push]);

  const derived = useMemo(() => {
    const count = state.lines.reduce((a, l) => a + l.quantity, 0);
    const subtotalCents = state.lines.reduce((a, l) => a + (state.lease?.lockedPrices[`${l.productId}:${l.flashDealId ?? ''}`] ?? l.unitPriceCents) * l.quantity, 0);
    const parts = state.lines.map((l) => ({
      part: { id: l.productId, sku: l.sku, name: l.name, category: l.category, tdp_watts: l.tdpWatts, weight_grams: l.weightGrams, specs: l.specs },
      quantity: l.quantity
    }));
    const report = state.lines.length ? evaluateBuildCompatibilityV2(manifestFromParts(parts, state.mode)) : null;
    const isPackageIntact = Boolean(state.packageSlug) && state.lines.every((l) => l.quantity === 1 && !l.flashDealId);
    const quote = quoteOrder({
      partsSubtotalCents: subtotalCents,
      fulfillmentMode: state.mode,
      isSyndicatePackage: isPackageIntact,
      optInBiosPreflash: state.optInBios,
      report
    });
    return { count, subtotalCents, report, quote, isPackageIntact };
  }, [state]);

  const api: CartApi = {
    ...state,
    ...derived,
    hydrated,
    add,
    replaceWith,
    setQuantity,
    remove,
    clear,
    setMode,
    setOptInBios,
    setLease,
    refreshPrices
  };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useCart(): CartApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCart must be used inside <CartProvider>');
  return v;
}
