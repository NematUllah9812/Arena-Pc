'use client';
import { useState, type FormEvent } from 'react';
import type { AdminRole, PriceOverrideApproval } from '@/lib/types';
import { formatDateTime, money } from '@/lib/format';
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
    if (!res.ok) return push({ title: 'Couldn’t create invite', body: res.error, tone: 'error' });
    setInvite(`${window.location.origin}/admin/gate?codename=${encodeURIComponent(codename)}&invite=${encodeURIComponent(res.token)}`);
  };

  const toggleLock = async (r: Row) => {
    const res = await adminFetch('/admin/api/vault/lock', { method: 'POST', json: { adminId: r.id, locked: !r.locked } });
    if (!res.ok) return push({ title: 'Couldn’t update access', body: res.error, tone: 'error' });
    setAdmins((as) => as.map((a) => (a.id === r.id ? { ...a, locked: !r.locked } : a)));
  };

  const issueOverride = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const res = await adminFetch<{ value: PriceOverrideApproval }>('/admin/api/override', { method: 'POST', json: { productId: overrideProduct, minPriceCents: Math.round(Number(f.get('min')) * 100) } });
    if (!res.ok) return push({ title: 'Couldn’t create approval', body: res.error, tone: 'error' });
    setOverrides((o) => [res.value, ...o]);
    push({ title: 'Approval code created', body: 'Valid for 30 minutes. Another admin must use it.' });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-x-auto rounded-xl border border-hairline bg-white">
        <table className="data-grid min-w-[720px]">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Sign-in method</th>
              <th>Last login</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id}>
                <td className="font-medium">
                  {a.codename}
                  {a.id === selfId ? <span className="ml-2 text-xs text-muted">(you)</span> : null}
                </td>
                <td>{a.roleLabel}</td>
                <td className="text-secondary">Passkey + authenticator app</td>
                <td className="text-secondary">{a.lastLogin ? formatDateTime(a.lastLogin) : 'Never'}</td>
                <td>{a.locked ? <span className="badge badge-conflict">Locked</span> : <span className="badge badge-verified">Active</span>}</td>
                <td>
                  {a.id !== selfId ? (
                    <button type="button" className="btn-ghost size-sm" onClick={() => toggleLock(a)}>
                      {a.locked ? 'Unlock' : 'Lock account'}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-hairline bg-white p-5">
          <form onSubmit={issueInvite} className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">Invite a team member</h2>
            <p className="-mt-1 text-sm text-secondary">The invite link works once and expires in 24 hours.</p>
            <div className="grid grid-cols-2 gap-3">
              <input name="codename" className="hud-input" placeholder="Username" required pattern="[A-Za-z][A-Za-z0-9_\-]{2,31}" />
              <select name="role" className="hud-select">
                <option value="LEAD_TECHNICIAN">Lead technician</option>
                <option value="INVENTORY_COMMANDER">Inventory manager</option>
                <option value="PRICING_OPS">Pricing manager</option>
                <option value="OVERSEER">Owner (full access)</option>
              </select>
            </div>
            <button type="submit" className="btn-overclock size-sm self-start">
              Create invite link
            </button>
            {invite ? (
              <div className="rounded-lg border border-hairline bg-chassis p-3">
                <p className="mb-1 text-xs text-muted">Send this privately. They&rsquo;ll also need the secret admin entry link.</p>
                <p className="text-xs break-all text-volt select-all">{invite}</p>
              </div>
            ) : null}
          </form>
        </section>

        <section className="rounded-xl border border-hairline bg-white p-5">
          <form onSubmit={issueOverride} className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">Approve a below-minimum price</h2>
            <p className="-mt-1 text-sm text-secondary">Prices below 60% of cost need a second admin. Create an approval code here; a different admin enters it within 30 minutes when changing the price.</p>
            <select className="hud-select" value={overrideProduct} onChange={(e) => setOverrideProduct(e.target.value)}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} (minimum {money(p.floor)})
                </option>
              ))}
            </select>
            <input name="min" type="number" step="0.01" min="1" className="hud-input" placeholder="Lowest approved price ($)" required />
            <button type="submit" className="btn-overclock size-sm self-start">
              Create approval code
            </button>
          </form>
          {overrides.length ? (
            <ul className="mt-4 flex flex-col gap-2 text-xs">
              {overrides.slice(0, 6).map((o) => (
                <li key={o.token} className="border-b border-hairline pb-2">
                  <span className="break-all text-volt select-all">{o.token}</span>
                  <span className="block text-muted">
                    From {money(o.min_price_cents)} · by {o.approver_codename} · {o.consumed_at ? `used ${formatDateTime(o.consumed_at)}` : `expires ${formatDateTime(o.expires_at)}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  );
}
