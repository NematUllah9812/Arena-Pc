'use client';
import { useState, type FormEvent } from 'react';
import type { AdminRole, PriceOverrideApproval } from '@/lib/types';
import { formatDateTime, money } from '@/lib/format';
import { HudCard } from '@/components/hud/HudCard';
import { useToast } from '@/components/layout/Toasts';
import { adminFetch } from './adminFetch';

interface Row {
  id: string;
  codename: string;
  role: AdminRole;
  roleLabel: string;
  locked: boolean;
  lastLogin: string | null;
  created: string;
  transports: string[];
}

export function VaultManager({ selfId, admins: initial, overrides: initialOverrides, products }: { selfId: string; admins: Row[]; overrides: PriceOverrideApproval[]; products: { id: string; label: string; floor: number }[] }) {
  const [admins, setAdmins] = useState(initial);
  const [overrides, setOverrides] = useState(initialOverrides);
  const [invite, setInvite] = useState<string | null>(null);
  const [overrideProduct, setOverrideProduct] = useState(products[0]?.id ?? '');
  const { push } = useToast();

  const issueInvite = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const codename = String(f.get('codename')).trim().toUpperCase();
    const res = await adminFetch<{ token: string }>('/admin/api/vault/invite', { method: 'POST', json: { codename, role: f.get('role') } });
    if (!res.ok) return push({ title: 'Invite failed', body: res.error, tone: 'error' });
    setInvite(`${window.location.origin}/admin/gate?codename=${encodeURIComponent(codename)}&invite=${encodeURIComponent(res.token)}`);
  };

  const toggleLock = async (r: Row) => {
    const res = await adminFetch('/admin/api/vault/lock', { method: 'POST', json: { adminId: r.id, locked: !r.locked } });
    if (!res.ok) return push({ title: 'Lock failed', body: res.error, tone: 'error' });
    setAdmins((as) => as.map((a) => (a.id === r.id ? { ...a, locked: !r.locked } : a)));
  };

  const issueOverride = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const res = await adminFetch<{ value: PriceOverrideApproval }>('/admin/api/override', { method: 'POST', json: { productId: overrideProduct, minPriceCents: Math.round(Number(f.get('min')) * 100) } });
    if (!res.ok) return push({ title: 'Override refused', body: res.error, tone: 'error' });
    setOverrides((o) => [res.value, ...o]);
    push({ title: 'Override token issued', body: 'Valid 30 minutes; must be consumed by a different operator.' });
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="overflow-x-auto border border-hairline">
        <table className="data-grid w-full min-w-[720px]">
          <thead>
            <tr>
              <th>Codename</th>
              <th>Role</th>
              <th>Authenticator</th>
              <th>Last login</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id}>
                <td className="font-mono">
                  {a.codename}
                  {a.id === selfId ? <span className="ml-2 text-xs text-muted">(you)</span> : null}
                </td>
                <td>{a.roleLabel}</td>
                <td className="font-mono text-xs text-secondary">Passkey{a.transports.length ? ` · ${a.transports.join('/')}` : ''} + TOTP</td>
                <td className="font-mono text-xs">{a.lastLogin ? formatDateTime(a.lastLogin) : 'never'}</td>
                <td>{a.locked ? <span className="badge badge-conflict">Locked</span> : <span className="badge badge-verified">Active</span>}</td>
                <td>
                  {a.id !== selfId ? (
                    <button type="button" className="btn-ghost size-sm tone-tungsten" onClick={() => toggleLock(a)}>
                      {a.locked ? 'Unlock' : 'Lock'}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <HudCard innerClassName="p-5">
          <form onSubmit={issueInvite} className="flex flex-col gap-3">
            <p className="hud-eyebrow">Issue operator invite (24h, single codename)</p>
            <div className="grid grid-cols-2 gap-3">
              <input name="codename" className="hud-input uppercase" placeholder="CODENAME" required pattern="[A-Za-z][A-Za-z0-9_\-]{2,31}" />
              <select name="role" className="hud-select">
                <option value="LEAD_TECHNICIAN">Lead Technician</option>
                <option value="INVENTORY_COMMANDER">Inventory Commander</option>
                <option value="PRICING_OPS">Pricing Ops</option>
                <option value="OVERSEER">Overseer</option>
              </select>
            </div>
            <button type="submit" className="btn-overclock size-sm self-start">
              Mint invite
            </button>
            {invite ? (
              <div className="border border-hairline bg-void p-3">
                <p className="hud-label mb-1">Deliver out-of-band. Recipient still needs the perimeter knock.</p>
                <p className="font-mono text-[0.62rem] break-all text-volt select-all">{invite}</p>
              </div>
            ) : null}
          </form>
        </HudCard>

        <HudCard tone="tungsten" innerClassName="p-5">
          <form onSubmit={issueOverride} className="flex flex-col gap-3">
            <p className="hud-eyebrow">Dual-admin price override</p>
            <p className="text-xs text-secondary">Pre-authorise one below-floor price. A second operator must consume the token within 30 minutes; it cannot be used by you.</p>
            <select className="hud-select" value={overrideProduct} onChange={(e) => setOverrideProduct(e.target.value)}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} (floor {money(p.floor)})
                </option>
              ))}
            </select>
            <input name="min" type="number" step="0.01" min="1" className="hud-input" placeholder="Minimum approved price (USD)" required />
            <button type="submit" className="btn-overclock tone-tungsten size-sm self-start">
              Issue token
            </button>
          </form>
          {overrides.length ? (
            <ul className="mt-4 flex flex-col gap-2 font-mono text-[0.62rem]">
              {overrides.slice(0, 6).map((o) => (
                <li key={o.token} className="border-b border-hairline pb-2">
                  <span className="break-all text-volt select-all">{o.token}</span>
                  <span className="block text-muted">
                    ≥ {money(o.min_price_cents)} · by {o.approver_codename} · {o.consumed_at ? `consumed ${formatDateTime(o.consumed_at)}` : `expires ${formatDateTime(o.expires_at)}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </HudCard>
      </div>
    </div>
  );
}
