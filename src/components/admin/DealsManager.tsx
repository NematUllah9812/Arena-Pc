'use client';
import { useState, type FormEvent } from 'react';
import type { FlashDealWithProduct } from '@/lib/types';
import { formatDateTime, money } from '@/lib/format';
import { useToast } from '@/components/layout/Toasts';
import { adminFetch } from './adminFetch';

type Opt = { id: string; label: string; base: number; floor: number; days: number; stock: number };

const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export function DealsManager({ initial, products }: { initial: FlashDealWithProduct[]; products: Opt[] }) {
  const [deals, setDeals] = useState(initial);
  const [sel, setSel] = useState(products[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const { push } = useToast();
  const p = products.find((x) => x.id === sel);

  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const res = await adminFetch<{ value: FlashDealWithProduct }>('/admin/api/deals', {
      method: 'POST',
      json: {
        productId: sel,
        dealTitle: String(f.get('title')),
        dealPriceCents: Math.round(Number(f.get('price')) * 100),
        maxClaims: Number(f.get('claims')),
        startsAt: new Date(String(f.get('starts'))).toISOString(),
        expiresAt: new Date(String(f.get('expires'))).toISOString(),
        bannerAccentHex: '#2563EB'
      }
    });
    setBusy(false);
    if (!res.ok) return push({ title: 'Couldn’t create deal', body: res.detail ?? res.error, tone: 'error' });
    push({ title: 'Deal created' });
    window.location.reload();
  };

  const toggle = async (d: FlashDealWithProduct) => {
    const res = await adminFetch('/admin/api/deals', { method: 'PATCH', json: { dealId: d.id, active: !d.is_active } });
    if (!res.ok) return push({ title: 'Couldn’t update deal', body: res.error, tone: 'error' });
    setDeals((ds) => ds.map((x) => (x.id === d.id ? { ...x, is_active: !d.is_active } : x)));
  };

  const now = new Date();
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <section className="rounded-xl border border-hairline bg-white p-5">
        <form onSubmit={create} className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">New deal</h2>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-secondary">Product <span className="font-normal text-muted">(oldest stock first)</span></span>
            <select className="hud-select" value={sel} onChange={(e) => setSel(e.target.value)}>
              {products.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label} — {o.stock} in stock, {o.days} days old
                </option>
              ))}
            </select>
          </label>
          {p ? (
            <p className="text-xs text-muted">
              Regular price {money(p.base)} · lowest allowed {money(p.floor)}
            </p>
          ) : null}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-secondary">Deal name</span>
            <input name="title" className="hud-input" required minLength={3} maxLength={80} placeholder="Weekend deal" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-secondary">Deal price ($)</span>
              <input name="price" type="number" step="0.01" min={p ? p.floor / 100 : 1} className="hud-input" required />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-secondary">Units available</span>
              <input name="claims" type="number" min={1} max={500} defaultValue={25} className="hud-input" required />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-secondary">Starts</span>
              <input name="starts" type="datetime-local" defaultValue={localInput(now)} className="hud-input" required />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-secondary">Ends</span>
              <input name="expires" type="datetime-local" defaultValue={localInput(new Date(now.getTime() + 24 * 3600e3))} className="hud-input" required />
            </label>
          </div>
          <button type="submit" className="btn-overclock" disabled={busy || !sel}>
            {busy ? 'Creating…' : 'Create deal'}
          </button>
        </form>
      </section>

      <div className="overflow-x-auto rounded-xl border border-hairline bg-white">
        <table className="data-grid min-w-[720px]">
          <thead>
            <tr>
              <th>Deal</th>
              <th className="text-right">Price</th>
              <th className="text-right">Sold</th>
              <th>Runs</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {deals.map((d) => {
              const live = d.is_active && new Date(d.starts_at) <= now && new Date(d.expires_at) > now;
              return (
                <tr key={d.id}>
                  <td>
                    <span className="block font-medium">
                      {d.deal_title}
                    </span>
                    <span className="text-xs text-muted">{d.product.name}</span>
                  </td>
                  <td className="tabular text-right">
                    {money(d.deal_price_cents)}
                    <span className="block text-xs text-muted line-through">{money(d.product.base_price_cents)}</span>
                  </td>
                  <td className="tabular text-right">
                    {d.claimed_count}
                    <span className="text-muted"> / {d.max_claims}</span>
                    {d.reserved_claims ? <span className="block text-xs text-muted">{d.reserved_claims} in carts</span> : null}
                  </td>
                  <td className="text-xs text-secondary">
                    {formatDateTime(d.starts_at)}
                    <br />to {formatDateTime(d.expires_at)}
                  </td>
                  <td>{live ? <span className="badge badge-verified">Live</span> : d.is_active ? <span className="badge badge-cryo">Scheduled</span> : <span className="badge badge-muted">Off</span>}</td>
                  <td>
                    <button type="button" className="btn-ghost size-sm" onClick={() => toggle(d)}>
                      {d.is_active ? 'Turn off' : 'Turn on'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
