import { getRepo } from '@/lib/repo';
import { requireAdminPage, ROLE_CAPABILITIES } from '@/lib/security/admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { VaultManager } from '@/components/admin/VaultManager';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Team & security' };

export default async function VaultPage() {
  const admin = await requireAdminPage('vault');
  const repo = getRepo();
  const [admins, overrides, products] = await Promise.all([repo.listAdmins(), repo.listPriceOverrides(), repo.listProductsInternal()]);
  return (
    <AdminShell admin={admin} active="/admin/vault" title="Team & security" description="Who can access the admin area, and approvals for below-minimum prices.">
      <VaultManager
        selfId={admin.id}
        admins={admins.map((a) => ({ id: a.id, codename: a.codename, role: a.role, roleLabel: ROLE_CAPABILITIES[a.role].label, locked: a.is_locked, lastLogin: a.last_login_at, created: a.created_at, transports: a.webauthn_transports }))}
        overrides={overrides}
        products={products.map((p) => ({ id: p.id, label: `${p.sku} — ${p.name}`, floor: Math.ceil(p.cost_price_cents * 0.6) }))}
      />
    </AdminShell>
  );
}
