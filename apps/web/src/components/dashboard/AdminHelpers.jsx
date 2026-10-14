// Shared admin nav — imported by every admin page
export const ADMIN_NAV = [
  { href: '/admin/dashboard',   icon: 'dashboard',   label: 'Dashboard' },
  { href: '/admin/users',       icon: 'users',       label: 'Users' },
  { href: '/admin/drivers',     icon: 'drivers',     label: 'Drivers' },
  { href: '/admin/owners',      icon: 'profile',     label: 'Owners' },
  { href: '/admin/companies',   icon: 'companies',   label: 'Companies' },
  { href: '/admin/vehicles',    icon: 'vehicle',     label: 'Vehicles' },
  { href: '/admin/contracts',   icon: 'contract',    label: 'Contracts' },
  { href: '/admin/payments',    icon: 'payments',    label: 'Payments' },
  { href: '/admin/disputes',    icon: 'disputes',    label: 'Disputes' },
  { href: '/admin/maintenance', icon: 'maintenance', label: 'Maintenance' },
  { href: '/admin/tracking',    icon: 'tracking',    label: 'Tracking' },
  { href: '/admin/incidents',   icon: 'incidents',   label: 'Incidents' },
  { href: '/admin/compliance',  icon: 'compliance',  label: 'Compliance' },
  { href: '/admin/audit',       icon: 'audit',       label: 'Audit Log' },
  { href: '/admin/settings',    icon: 'settings',    label: 'Settings' },
];

export function fmt(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function AdminTable({ columns, rows, loading, onRowClick }) {
  if (loading) {
    return <div className="py-16 text-center text-sm text-fog">Loading…</div>;
  }
  if (!rows.length) {
    return <div className="py-16 text-center text-sm text-fog">No records found.</div>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-concrete dark:border-dark-border bg-chalk dark:bg-dark-elevated">
          {columns.map((c) => (
            <th
              key={c.key}
              className={`px-4 py-3 text-left text-xs font-medium text-fog uppercase tracking-widest ${c.hidden || ''}`}
            >
              {c.label}
            </th>
          ))}
          {onRowClick && <th className="px-4 py-3" />}
        </tr>
      </thead>
      <tbody className="divide-y divide-concrete dark:divide-dark-border">
        {rows.map((row, i) => (
          <tr
            key={row.id || i}
            className={`transition-colors ${
              onRowClick
                ? 'cursor-pointer hover:bg-chalk dark:hover:bg-dark-elevated'
                : ''
            }`}
            onClick={() => onRowClick && onRowClick(row)}
          >
            {columns.map((c) => (
              <td key={c.key} className={`px-4 py-3 ${c.hidden || ''}`}>
                {c.render
                  ? c.render(row)
                  : <span className="text-steel dark:text-neutral-300">{row[c.key] ?? '—'}</span>
                }
              </td>
            ))}
            {onRowClick && (
              <td className="px-4 py-3 text-right text-xs text-fog hover:text-graphite dark:hover:text-paper transition-colors">
                View →
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AdminPagination({ pagination, page, setPage }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-xs text-steel dark:text-neutral-500">
      <span>
        Showing {(pagination.page - 1) * pagination.limit + 1}–
        {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
      </span>
      <div className="flex items-center gap-2">
        <button
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
          className="px-3 py-1.5 rounded-nav border border-concrete dark:border-dark-border text-steel dark:text-neutral-400 hover:text-graphite dark:hover:text-paper disabled:opacity-40 transition-colors"
        >
          ← Prev
        </button>
        <span className="px-2">{page} / {pagination.totalPages}</span>
        <button
          disabled={page >= pagination.totalPages}
          onClick={() => setPage((p) => p + 1)}
          className="px-3 py-1.5 rounded-nav border border-concrete dark:border-dark-border text-steel dark:text-neutral-400 hover:text-graphite dark:hover:text-paper disabled:opacity-40 transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
