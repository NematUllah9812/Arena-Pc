'use client';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { PartCategory } from '@/lib/types';
import { CATEGORY_LABEL, money } from '@/lib/format';
import { ProductImage } from '@/components/hud/ProductImage';
import { useToast } from '@/components/layout/Toasts';
import { CloseIcon, ImageIcon, SearchIcon } from '@/components/ui/Icons';
import { adminFetch } from './adminFetch';
import { ProductPhotos } from './ProductPhotos';

export interface InventoryRow {
  id: string;
  sku: string;
  slug: string;
  name: string;
  category: PartCategory;
  base: number;
  sale: number | null;
  cost: number;
  stock: number;
  reserved: number;
  bin: string;
  days: number;
  overstock: boolean;
  clearance: boolean;
  active: boolean;
  primary: string;
  photos: string[];
}

type Filter = 'all' | 'low' | 'photos' | 'hidden';
const FILTERS: [Filter, string][] = [
  ['all', 'All'],
  ['low', 'Low stock'],
  ['photos', 'Needs photos'],
  ['hidden', 'Hidden']
];

const dollars = (c: number | null) => (c == null ? '' : (c / 100).toFixed(2));
const cents = (s: string) => (s.trim() === '' ? null : Math.round(Number(s) * 100));

export function InventoryTable({ rows: initial, canPrice, initialFilter = 'all' }: { rows: InventoryRow[]; canPrice: boolean; initialFilter?: Filter }) {
  const [rows, setRows] = useState(initial);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<PartCategory | ''>('');
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  const categories = useMemo(() => [...new Set(initial.map((r) => r.category))], [initial]);
  const counts = useMemo(
    () => ({
      all: rows.length,
      low: rows.filter((r) => r.active && r.stock - r.reserved <= 3).length,
      photos: rows.filter((r) => r.photos.length === 0 && r.category !== 'INTERNAL_BRACE').length,
      hidden: rows.filter((r) => !r.active).length
    }),
    [rows]
  );

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (t && !`${r.sku} ${r.name} ${r.bin}`.toLowerCase().includes(t)) return false;
      if (cat && r.category !== cat) return false;
      if (filter === 'low') return r.active && r.stock - r.reserved <= 3;
      if (filter === 'photos') return r.photos.length === 0 && r.category !== 'INTERNAL_BRACE';
      if (filter === 'hidden') return !r.active;
      return true;
    });
  }, [rows, q, cat, filter]);

  const open = rows.find((r) => r.id === openId) ?? null;
  const patch = (id: string, next: Partial<InventoryRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...next } : r)));

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenId(null);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [openId]);

  const savePricing = async (e: FormEvent<HTMLFormElement>, r: InventoryRow) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const res = await adminFetch<{ product: { base_price_cents: number; sale_price_cents: number | null } }>('/admin/api/products', {
      method: 'PATCH',
      json: { kind: 'pricing', productId: r.id, basePriceCents: cents(String(f.get('base'))), salePriceCents: cents(String(f.get('sale'))), overrideToken: String(f.get('token') ?? '').trim() || null }
    });
    setBusy(false);
    if (!res.ok) return push({ title: 'Price not saved', body: res.error ?? 'Unknown error', tone: 'error' });
    patch(r.id, { base: res.product.base_price_cents, sale: res.product.sale_price_cents });
    push({ title: 'Price saved', body: r.name });
  };

  const saveInventory = async (e: FormEvent<HTMLFormElement>, r: InventoryRow) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const res = await adminFetch<{ product: { stock_quantity: number; warehouse_bin: string; overstock_priority: boolean; is_leftover_clearance: boolean; is_active: boolean } }>('/admin/api/products', {
      method: 'PATCH',
      json: {
        kind: 'inventory',
        productId: r.id,
        stockQuantity: Number(f.get('stock')),
        warehouseBin: String(f.get('bin')).trim().toUpperCase(),
        overstockPriority: f.get('overstock') === 'on',
        isLeftoverClearance: f.get('clearance') === 'on',
        isActive: f.get('active') === 'on'
      }
    });
    setBusy(false);
    if (!res.ok) return push({ title: 'Stock not saved', body: res.detail ?? res.error ?? 'Unknown error', tone: 'error' });
    const p = res.product;
    patch(r.id, { stock: p.stock_quantity, bin: p.warehouse_bin, overstock: p.overstock_priority, clearance: p.is_leftover_clearance, active: p.is_active });
    push({ title: 'Stock saved', body: r.name });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative w-full max-w-xs">
          <SearchIcon size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input className="hud-input w-full pl-9" placeholder="Search name, SKU or bin" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select className="hud-select w-auto" value={cat} onChange={(e) => setCat(e.target.value as PartCategory | '')} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(([f, l]) => (
            <button key={f} type="button" className={`chip gap-1.5 ${filter === f ? 'is-active' : ''}`} onClick={() => setFilter(f)}>
              {l} <span className="tabular opacity-70">{counts[f]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-hairline bg-white">
        <table className="data-grid min-w-[900px]">
          <thead>
            <tr>
              <th className="w-[64px]" />
              <th>Product</th>
              <th>Category</th>
              <th className="text-right">Price</th>
              <th className="text-right">Cost</th>
              <th className="text-right">Margin</th>
              <th className="text-right">In stock</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const eff = r.sale ?? r.base;
              const margin = eff > 0 ? ((eff - r.cost) / eff) * 100 : 0;
              const avail = r.stock - r.reserved;
              return (
                <tr key={r.id} className="cursor-pointer" onClick={() => setOpenId(r.id)}>
                  <td>
                    <div className="relative h-11 w-11 overflow-hidden rounded-md border border-hairline bg-white">
                      <ProductImage src={r.primary} alt="" sizes="44px" />
                      {r.photos.length === 0 ? <span className="absolute inset-x-0 bottom-0 bg-[#fffbeb]/90 text-center text-[0.55rem] font-semibold text-tolerance">STOCK</span> : null}
                    </div>
                  </td>
                  <td className="max-w-[340px]">
                    <span className="block truncate font-medium text-primary">{r.name}</span>
                    <span className="text-xs text-muted">
                      {r.sku} · Bin {r.bin}
                    </span>
                  </td>
                  <td className="text-secondary">{CATEGORY_LABEL[r.category]}</td>
                  <td className="tabular text-right">
                    {r.sale != null ? (
                      <>
                        <span className="font-medium text-tungsten">{money(r.sale)}</span>
                        <span className="block text-xs text-muted line-through">{money(r.base)}</span>
                      </>
                    ) : (
                      money(r.base)
                    )}
                  </td>
                  <td className="tabular text-right text-muted">{money(r.cost)}</td>
                  <td className={`tabular text-right ${margin < 0 ? 'text-conflict' : margin < 8 ? 'text-tolerance' : 'text-verified'}`}>{margin.toFixed(1)}%</td>
                  <td className="tabular text-right">
                    <span className={avail <= 0 ? 'font-medium text-conflict' : avail <= 3 ? 'font-medium text-tolerance' : ''}>{avail}</span>
                    {r.reserved ? <span className="block text-xs text-muted">{r.reserved} in carts</span> : null}
                  </td>
                  <td>
                    <span className="flex flex-wrap gap-1">
                      {r.active ? <span className="badge badge-verified">Listed</span> : <span className="badge badge-muted">Hidden</span>}
                      {r.clearance ? <span className="badge badge-tungsten">Clearance</span> : null}
                    </span>
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      className="btn-ghost size-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenId(r.id);
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!list.length ? <p className="p-8 text-center text-sm text-muted">No products match these filters.</p> : null}
      </div>
      <p className="text-xs text-muted">
        Showing {list.length} of {rows.length} products
      </p>

      {/* Edit drawer */}
      {open ? (
        <div className="fixed inset-0 z-[150] flex justify-end" role="dialog" aria-modal="true" aria-label={`Edit ${open.name}`}>
          <button type="button" className="absolute inset-0 bg-[#0f172a]/30" aria-label="Close" onClick={() => setOpenId(null)} />
          <div className="relative flex h-full w-full max-w-[560px] flex-col bg-white shadow-2xl">
            <div className="flex items-start gap-3 border-b border-hairline px-6 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">
                  {CATEGORY_LABEL[open.category]} · {open.sku}
                </p>
                <h2 className="mt-0.5 text-lg leading-snug font-semibold">{open.name}</h2>
                <a href={`/product/${open.slug}`} target="_blank" rel="noopener" className="text-xs text-volt hover:underline">
                  View in store
                </a>
              </div>
              <button type="button" className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-chassis hover:text-primary" onClick={() => setOpenId(null)} aria-label="Close">
                <CloseIcon size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <section className="border-b border-hairline px-6 py-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <ImageIcon size={17} className="text-muted" /> Photos
                </h3>
                <ProductPhotos key={open.id} productId={open.id} productName={open.name} initial={open.photos} onChange={(photos, primary) => patch(open.id, { photos, primary })} />
              </section>

              <form key={`inv-${open.id}`} onSubmit={(e) => saveInventory(e, open)} className="grid grid-cols-2 gap-4 border-b border-hairline px-6 py-5">
                <h3 className="col-span-2 text-sm font-semibold">Stock &amp; visibility</h3>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm text-secondary">Units on hand</span>
                  <input name="stock" type="number" min={open.reserved} defaultValue={open.stock} className="hud-input" />
                  {open.reserved ? <span className="text-xs text-muted">{open.reserved} currently held in carts</span> : null}
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm text-secondary">Warehouse bin</span>
                  <input name="bin" defaultValue={open.bin} className="hud-input" pattern="[A-Za-z0-9\-]{2,16}" />
                </label>
                <div className="col-span-2 flex flex-col gap-2.5 text-sm text-secondary">
                  <label className="flex items-center gap-2.5">
                    <input type="checkbox" name="active" defaultChecked={open.active} className="hud-check" /> Show in store
                  </label>
                  <label className="flex items-center gap-2.5">
                    <input type="checkbox" name="clearance" defaultChecked={open.clearance} className="hud-check" /> Mark as clearance
                  </label>
                  <label className="flex items-center gap-2.5">
                    <input type="checkbox" name="overstock" defaultChecked={open.overstock} className="hud-check" /> Overstocked — prefer in suggested builds
                  </label>
                </div>
                <button type="submit" className="btn-overclock size-sm col-span-2 justify-self-start" disabled={busy}>
                  Save stock
                </button>
              </form>

              {canPrice ? (
                <form key={`price-${open.id}`} onSubmit={(e) => savePricing(e, open)} className="grid grid-cols-2 gap-4 px-6 py-5">
                  <div className="col-span-2">
                    <h3 className="text-sm font-semibold">Pricing</h3>
                    <p className="mt-0.5 text-xs text-muted">
                      Cost {money(open.cost)} · lowest allowed price {money(Math.ceil(open.cost * 0.6))} · in stock {open.days} days
                    </p>
                  </div>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm text-secondary">Regular price ($)</span>
                    <input name="base" type="number" step="0.01" min="1" defaultValue={dollars(open.base)} className="hud-input" required />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm text-secondary">Sale price ($)</span>
                    <input name="sale" type="number" step="0.01" min="1" defaultValue={dollars(open.sale)} className="hud-input" placeholder="No sale" />
                  </label>
                  <details className="col-span-2 text-sm">
                    <summary className="cursor-pointer text-secondary">Pricing below the minimum?</summary>
                    <label className="mt-2 flex flex-col gap-1.5">
                      <span className="text-xs text-muted">Enter an approval code from another admin (Team &amp; security page).</span>
                      <input name="token" className="hud-input text-xs" autoComplete="off" placeholder="Approval code" />
                    </label>
                  </details>
                  <button type="submit" className="btn-overclock size-sm col-span-2 justify-self-start" disabled={busy}>
                    Save price
                  </button>
                </form>
              ) : (
                <p className="px-6 py-5 text-sm text-muted">Only owners and pricing managers can change prices.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
