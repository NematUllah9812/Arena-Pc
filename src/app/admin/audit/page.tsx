import { getRepo } from '@/lib/repo';
import { requireAdminPage } from '@/lib/security/admin';
import { formatDateTime } from '@/lib/format';
import { AdminShell } from '@/components/admin/AdminShell';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Audit Ledger' };

export default async function AuditPage() {
  const admin = await requireAdminPage('audit');
  const logs = await getRepo().listAuditLogs(300);
  return (
    <AdminShell admin={admin} active="/admin/audit">
      <h1 className="hud-title mb-2 text-3xl">Audit Ledger</h1>
      <p className="mb-6 text-sm text-secondary">Append-only. Database triggers reject UPDATE and DELETE on this table.</p>
      <div className="overflow-x-auto border border-hairline">
        <table className="data-grid w-full min-w-[960px]">
          <thead>
            <tr>
              <th>When</th>
              <th>Operator</th>
              <th>Action</th>
              <th>Target</th>
              <th>Before → After</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="font-mono text-xs whitespace-nowrap">{formatDateTime(l.executed_at)}</td>
                <td className="font-mono text-xs">{l.admin_codename ?? l.admin_id.slice(0, 8)}</td>
                <td className="font-mono text-xs text-tungsten">{l.action_type}</td>
                <td className="font-mono text-xs">
                  {l.target_entity}
                  {l.target_id ? <span className="text-muted"> · {String(l.target_id).slice(0, 18)}</span> : null}
                </td>
                <td className="max-w-[420px] font-mono text-[0.62rem] text-secondary">
                  <span className="text-muted">{l.previous_state ? JSON.stringify(l.previous_state) : '∅'}</span> → {l.new_state ? JSON.stringify(l.new_state) : '∅'}
                </td>
                <td className="font-mono text-xs">{l.ip_address}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
