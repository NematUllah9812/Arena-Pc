'use client';
import { useState, type FormEvent } from 'react';
import type { FlashDealWithProduct } from '@/lib/types';
import { formatDateTime, money } from '@/lib/format';
import { HudCard } from '@/components/hud/HudCard';
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
        bannerAccentHex: String(f.get('accent')).toUpperCase()
      }
    });
    setBusy(false);
    if (!res.ok) return push({ title: 'Deal rejected', body: res.detail ?? res.error, tone: 'error' });
    push({ title: 'Deal armed', body: 'Reload to see it in the live board.' });
    window.location.reload();
  };

  const toggle = async (d: FlashDealWithProduct) => {
    const res = await adminFetch('/admin/api/deals', { method: 'PATCH', json: { dealId: d.id, active: !d.is_active } });
    if (!res.ok) return push({ title: 'Toggle failed', body: res.error, tone: 'error' });
    setDeals((ds) => ds.map((x) => (x.id === d.id ? { ...x, is_active: !d.is_active } : x)));
  };

  const now = new Date();
  return (
    <div className="grid gap-8 xl:grid-cols-[420px_1fr]">
      <HudCard tone="tungsten" innerClassName="p-5">
        <form onSubmit={create} className="flex flex-col gap-3">
          <p className="hud-eyebrow">Arm a new drop</p>
          <label className="flex flex-col gap-1">
            <span className="hud-label">SKU (sorted by age in inventory)</span>
            <select className="hud-select" value={sel} onChange={(e) => setSel(e.target.value)}>
              {products.map((o) => (
                <option key={o.id} value={o.id}>
                  [{o.days}d · {o.stock} avail] {o.label}
                </option>
              ))}
            </select>
          </label>
          {p ? (
            <p className="font-mono text-[0.65rem] text-muted">
              List {money(p.base)} · floor {money(p.floor)} (60% of cost)
            </p>
          ) : null}
          <label className="flex flex-col gap-1">
            <span className="hud-label">Title</span>
            <input name="title" className="hud-input" required minLength={3} maxLength={80} placeholder="Midnight Liquidation" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="hud-label">Deal price (USD)</span>
              <input name="price" type="number" step="0.01" min={p ? p.floor / 100 : 1} className="hud-input" required />
            </label>
            <label className="flex flex-col gap-1">
              <span className="hud-label">Max claims</span>
              <input name="claims" type="number" min={1} max={500} defaultValue={25} className="hud-input" required />
            </label>
            <label className="flex flex-col gap-1">
              <span className="hud-label">Starts</span>
              <input name="starts" type="datetime-local" defaultValue={localInput(now)} className="hud-input" required />
            </label>
            <label className="flex flex-col gap-1">
              <span className="hud-label">Expires</span>
              <input name="expires" type="datetime-local" defaultValue={localInput(new Date(now.getTime() + 24 * 3600e3))} className="hud-input" required />
            </label>
          </div>
          <label className="flex items-center gap-3">
            <span className="hud-label">Accent</span>
            <input name="accent" type="color" defaultValue="#FF3B00" className="h-8 w-14 border border-hairline bg-void" />
          </label>
          <button type="submit" className="btn-overclock tone-tungsten" disabled={busy || !sel}>
            Arm deal
          </button>
        </form>
      </HudCard>

      <div className="overflow-x-auto border border-hairline">
        <table className="data-grid w-full min-w-[760px]">
          <thead>
            <tr>
              <th>Deal</th>
              <th className="text-right">Price</th>
              <th className="text-right">Claims</th>
              <th>Window</th>
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
                    <span className="block" style={{ color: d.banner_accent_hex }}>
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
                    <span className="text-muted">+{d.reserved_claims}</span>/{d.max_claims}
                  </td>
                  <td className="font-mono text-[0.65rem] text-secondary">
                    {formatDateTime(d.starts_at)}
                    <br />→ {formatDateTime(d.expires_at)}
                  </td>
                  <td>{live ? <span className="badge badge-verified">Live</span> : d.is_active ? <span className="badge badge-cryo">Armed</span> : <span className="badge badge-muted">Disarmed</span>}</td>
                  <td>
                    <button type="button" className="btn-ghost size-sm" onClick={() => toggle(d)}>
                      {d.is_active ? 'Disarm' : 'Arm'}
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
