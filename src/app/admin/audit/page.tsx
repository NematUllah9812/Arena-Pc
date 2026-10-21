import { getRepo } from '@/lib/repo';
import { requireAdminPage } from '@/lib/security/admin';
import { formatDateTime } from '@/lib/format';
import { AdminShell } from '@/components/admin/AdminShell';
import { auditLabel } from '@/components/admin/audit-labels';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Activity log' };

const fmt = (v: unknown) => (v == null ? '—' : JSON.stringify(v).replace(/[{}"]/g, '').replace(/,/g, ', ').replace(/:/g, ': '));

export default async function AuditPage() {
  const admin = await requireAdminPage('audit');
  const logs = await getRepo().listAuditLogs(300);
  return (
    <AdminShell admin={admin} active="/admin/audit" title="Activity log" description="Every change made in the admin area. Entries can’t be edited or deleted.">
      <div className="overflow-x-auto rounded-xl border border-hairline bg-white">
        <table className="data-grid min-w-[900px]">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>What</th>
              <th>Item</th>
              <th>Change</th>
              <th>IP address</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap text-muted">{formatDateTime(l.executed_at)}</td>
                <td className="font-medium">{l.admin_codename ?? l.admin_id.slice(0, 8)}</td>
                <td>{auditLabel(l.action_type)}</td>
                <td className="text-secondary">{l.target_id ? String(l.target_id).slice(0, 24) : l.target_entity}</td>
                <td className="max-w-[420px] text-xs text-secondary">
                  <details>
                    <summary className="cursor-pointer text-volt">Show details</summary>
                    <p className="mt-1 break-words">
                      <span className="text-muted">Before:</span> {fmt(l.previous_state)}
                    </p>
                    <p className="break-words">
                      <span className="text-muted">After:</span> {fmt(l.new_state)}
                    </p>
                  </details>
                </td>
                <td className="whitespace-nowrap text-muted">{l.ip_address}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!logs.length ? <p className="p-6 text-center text-sm text-muted">No activity yet.</p> : null}
      </div>
    </AdminShell>
  );
}
