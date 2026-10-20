'use client';
import { useMemo, useState, type FormEvent } from 'react';
import type { PartCategory } from '@/lib/types';
import { CATEGORY_CODE, money } from '@/lib/format';
import { useToast } from '@/components/layout/Toasts';
import { adminFetch } from './adminFetch';

export interface InventoryRow {
  id: string;
  sku: string;
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
}

const dollars = (c: number | null) => (c == null ? '' : (c / 100).toFixed(2));
const cents = (s: string) => (s.trim() === '' ? null : Math.round(Number(s) * 100));

export function InventoryTable({ rows: initial, canPrice }: { rows: InventoryRow[]; canPrice: boolean }) {
  const [rows, setRows] = useState(initial);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => !t || `${r.sku} ${r.name} ${r.category} ${r.bin}`.toLowerCase().includes(t));
  }, [rows, q]);

  const patch = (id: string, next: Partial<InventoryRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...next } : r)));

  const savePricing = async (e: FormEvent<HTMLFormElement>, r: InventoryRow) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const res = await adminFetch<{ product: { base_price_cents: number; sale_price_cents: number | null } }>('/admin/api/products', {
      method: 'PATCH',
      json: { kind: 'pricing', productId: r.id, basePriceCents: cents(String(f.get('base'))), salePriceCents: cents(String(f.get('sale'))), overrideToken: String(f.get('token') ?? '').trim() || null }
    });
    setBusy(false);
    if (!res.ok) return push({ title: 'Pricing rejected', body: res.error ?? 'Unknown error', tone: 'error' });
    patch(r.id, { base: res.product.base_price_cents, sale: res.product.sale_price_cents });
    push({ title: 'Pricing committed', body: r.sku });
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
    if (!res.ok) return push({ title: 'Inventory rejected', body: res.detail ?? res.error ?? 'Unknown error', tone: 'error' });
    const p = res.product;
    patch(r.id, { stock: p.stock_quantity, bin: p.warehouse_bin, overstock: p.overstock_priority, clearance: p.is_leftover_clearance, active: p.is_active });
    push({ title: 'Inventory committed', body: r.sku });
  };

  return (
    <div className="flex flex-col gap-4">
      <input className="hud-input max-w-sm" placeholder="Filter SKU, name, category, bin…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="overflow-x-auto border border-hairline">
        <table className="data-grid w-full min-w-[960px]">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Component</th>
              <th className="text-right">List</th>
              <th className="text-right">Sale</th>
              <th className="text-right">Cost</th>
              <th className="text-right">Margin</th>
              <th className="text-right">Stock</th>
              <th>Bin</th>
              <th className="text-right">Age</th>
              <th>Flags</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const eff = r.sale ?? r.base;
              const margin = eff > 0 ? ((eff - r.cost) / eff) * 100 : 0;
              const floor = Math.ceil(r.cost * 0.6);
              const avail = r.stock - r.reserved;
              return [
                <tr key={r.id} className={!r.active ? 'opacity-50' : ''}>
                  <td className="font-mono text-xs">
                    <span className="text-muted">{CATEGORY_CODE[r.category]}</span> {r.sku}
                  </td>
                  <td className="max-w-[280px] truncate">{r.name}</td>
                  <td className="tabular text-right">{money(r.base)}</td>
                  <td className="tabular text-right text-tungsten">{r.sale != null ? money(r.sale) : '—'}</td>
                  <td className="tabular text-right text-muted">{money(r.cost)}</td>
                  <td className={`tabular text-right ${margin < 0 ? 'text-conflict' : margin < 8 ? 'text-tolerance' : 'text-verified'}`}>{margin.toFixed(1)}%</td>
                  <td className={`tabular text-right ${avail <= 0 ? 'text-conflict' : avail <= 3 ? 'text-tolerance' : ''}`}>
                    {avail}
                    <span className="text-muted">/{r.stock}</span>
                  </td>
                  <td className="font-mono text-xs">{r.bin}</td>
                  <td className={`tabular text-right ${r.days >= 90 ? 'text-tungsten' : 'text-muted'}`}>{r.days}d</td>
                  <td className="space-x-1">
                    {r.overstock ? <span className="badge badge-cryo">OVR</span> : null}
                    {r.clearance ? <span className="badge badge-tungsten">CLR</span> : null}
                  </td>
                  <td>
                    <button type="button" className={`btn-ghost size-sm ${open === r.id ? 'is-active' : ''}`} onClick={() => setOpen(open === r.id ? null : r.id)}>
                      {open === r.id ? 'Close' : 'Edit'}
                    </button>
                  </td>
                </tr>,
                open === r.id ? (
                  <tr key={`${r.id}-edit`}>
                    <td colSpan={11} className="bg-void">
                      <div className="grid gap-6 p-3 md:grid-cols-2">
                        <form onSubmit={(e) => saveInventory(e, r)} className="grid grid-cols-2 gap-3">
                          <p className="hud-eyebrow col-span-2">Inventory</p>
                          <label className="flex flex-col gap-1">
                            <span className="hud-label">On-hand stock</span>
                            <input name="stock" type="number" min={r.reserved} defaultValue={r.stock} className="hud-input" />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="hud-label">Warehouse bin</span>
                            <input name="bin" defaultValue={r.bin} className="hud-input uppercase" pattern="[A-Za-z0-9\-]{2,16}" />
                          </label>
                          <div className="col-span-2 flex flex-wrap gap-4 text-xs text-secondary">
                            <label className="flex items-center gap-2">
                              <input type="checkbox" name="overstock" defaultChecked={r.overstock} className="hud-check" /> Overstock priority
                            </label>
                            <label className="flex items-center gap-2">
                              <input type="checkbox" name="clearance" defaultChecked={r.clearance} className="hud-check" /> Leftover clearance
                            </label>
                            <label className="flex items-center gap-2">
                              <input type="checkbox" name="active" defaultChecked={r.active} className="hud-check" /> Listed
                            </label>
                          </div>
                          <button type="submit" className="btn-overclock size-sm col-span-2 justify-self-start" disabled={busy}>
                            Commit inventory
                          </button>
                        </form>
                        {canPrice ? (
                          <form onSubmit={(e) => savePricing(e, r)} className="grid grid-cols-2 gap-3">
                            <p className="hud-eyebrow col-span-2">
                              Pricing <span className="text-muted normal-case">· floor {money(floor)}</span>
                            </p>
                            <label className="flex flex-col gap-1">
                              <span className="hud-label">List (USD)</span>
                              <input name="base" type="number" step="0.01" min="1" defaultValue={dollars(r.base)} className="hud-input" required />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="hud-label">Sale (USD, blank = none)</span>
                              <input name="sale" type="number" step="0.01" min="1" defaultValue={dollars(r.sale)} className="hud-input" />
                            </label>
                            <label className="col-span-2 flex flex-col gap-1">
                              <span className="hud-label">Dual-admin override token (only for below-floor prices)</span>
                              <input name="token" className="hud-input font-mono text-xs" autoComplete="off" />
                            </label>
                            <button type="submit" className="btn-overclock size-sm col-span-2 justify-self-start" disabled={busy}>
                              Commit pricing
                            </button>
                          </form>
                        ) : (
                          <p className="text-xs text-muted">Pricing requires the Pricing Ops or Overseer role.</p>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : null
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
