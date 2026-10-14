'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/useAuth';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { ADMIN_NAV, AdminTable, AdminPagination, fmt } from '@/components/dashboard/AdminHelpers';
import { adminApi } from '@/lib/api';

const RESOURCES = [
  'user', 'driver', 'owner', 'company', 'vehicle',
  'contract', 'payment', 'dispute',
];

const ACTION_COLORS = {
  CREATE:   'text-success',
  UPDATE:   'text-graphite dark:text-paper',
  DELETE:   'text-danger',
  LOGIN:    'text-neutral-300',
  LOGOUT:   'text-neutral-500',
  VERIFY:   'text-accent',
  APPROVE:  'text-success',
  REJECT:   'text-danger',
  SUSPEND:  'text-warning',
  ACTIVATE: 'text-success',
  PAYMENT_SUCCESS: 'text-success',
  PAYMENT_FAILED:  'text-danger',
  CONTRACT_CREATE: 'text-graphite dark:text-paper',
  DISPUTE_CREATE:  'text-warning',
  DISPUTE_RESOLVE: 'text-success',
  OWNERSHIP_TRANSFER_COMPLETE: 'text-accent',
};

function ActionBadge({ action }) {
  const color = ACTION_COLORS[action] || 'text-neutral-400';
  return (
    <span className={`text-xs font-mono font-medium ${color}`}>
      {action}
    </span>
  );
}

function LogDrawer({ log, onClose }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-chalk dark:bg-paper dark:bg-dark-surface border-l border-concrete dark:border-dark-border z-50 flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-concrete dark:border-dark-border">
          <h2 className="text-base font-medium text-graphite dark:text-paper">Audit Entry</h2>
          <button onClick={onClose} className="text-fog hover:text-graphite dark:hover:text-paper transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 px-6 py-6 space-y-6">
          {/* Summary */}
          <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-xl divide-y divide-neutral-200 dark:divide-dark-border">
            {[
              { label: 'Log ID',     value: log.id },
              { label: 'Action',     value: <ActionBadge action={log.action} /> },
              { label: 'Resource',   value: log.resource },
              { label: 'Record ID',  value: log.resourceId || '—' },
              { label: 'Actor',      value: log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : 'System' },
              { label: 'Actor ID',   value: log.actorId || '—' },
              { label: 'IP Address', value: log.ipAddress || '—' },
              { label: 'Timestamp',  value: new Date(log.createdAt).toLocaleString('en-GB') },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between px-4 py-3 gap-4">
                <span className="text-xs text-fog flex-shrink-0">{label}</span>
                <span className="text-xs text-steel dark:text-neutral-300 text-right break-all">{value}</span>
              </div>
            ))}
          </div>

          {/* Previous data */}
          {log.previousData && (
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-2">Previous State</p>
              <pre className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-4 text-xs text-neutral-300 overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(log.previousData, null, 2)}
              </pre>
            </div>
          )}

          {/* New data */}
          {log.newData && (
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-2">New State</p>
              <pre className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-4 text-xs text-neutral-300 overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(log.newData, null, 2)}
              </pre>
            </div>
          )}

          {/* Metadata */}
          {log.metadata && (
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-2">Metadata</p>
              <pre className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-4 text-xs text-neutral-300 overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function AdminAuditPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['ADMIN', 'SUPER_ADMIN'] });
  const [logs, setLogs]             = useState([]);
  const [pagination, setPagination] = useState(null);
  const [fetching, setFetching]     = useState(false);
  const [resource, setResource]     = useState('');
  const [action, setAction]         = useState('');
  const [page, setPage]             = useState(1);
  const [selected, setSelected]     = useState(null);

  const load = useCallback(() => {
    if (!user) return;
    setFetching(true);
    adminApi
      .listAuditLogs({
        page, limit: 30,
        resource: resource || undefined,
        action: action || undefined,
      })
      .then((res) => {
        setLogs(res.data.data.logs);
        setPagination(res.data.data.pagination);
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user, page, resource, action]);

  useEffect(() => { load(); }, [load]);

  const COLS = [
    {
      key: 'createdAt', label: 'Time',
      render: (l) => (
        <span className="text-neutral-400 text-xs">
          {new Date(l.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
        </span>
      ),
    },
    {
      key: 'action', label: 'Action',
      render: (l) => <ActionBadge action={l.action} />,
    },
    {
      key: 'resource', label: 'Resource',
      render: (l) => (
        <span className="text-neutral-300 text-xs capitalize">{l.resource}</span>
      ),
    },
    {
      key: 'actor', label: 'Actor', hidden: 'hidden sm:table-cell',
      render: (l) => (
        <span className="text-neutral-400 text-xs">
          {l.actor ? `${l.actor.firstName} ${l.actor.lastName}` : 'System'}
        </span>
      ),
    },
    {
      key: 'resourceId', label: 'Record ID', hidden: 'hidden md:table-cell',
      render: (l) => (
        <span className="text-neutral-600 text-xs font-mono truncate max-w-[120px] block">
          {l.resourceId || '—'}
        </span>
      ),
    },
  ];

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={ADMIN_NAV} title="Audit Log">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium text-graphite dark:text-paper mb-1" style={{ letterSpacing: "-0.02em" }}>Audit Log</h2>
          <p className="text-sm text-steel dark:text-neutral-500">
            {pagination ? `${pagination.total} event${pagination.total !== 1 ? 's' : ''}` : 'Loading…'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <select
          className="input w-44"
          value={resource}
          onChange={(e) => { setResource(e.target.value); setPage(1); }}
        >
          <option value="">All resources</option>
          {RESOURCES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Filter by action (e.g. VERIFY)…"
          className="input flex-1"
          value={action}
          onChange={(e) => { setAction(e.target.value.toUpperCase()); setPage(1); }}
        />
      </div>

      <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card overflow-hidden">
        <AdminTable columns={COLS} rows={logs} loading={fetching} onRowClick={setSelected} />
      </div>
      <AdminPagination pagination={pagination} page={page} setPage={setPage} />

      {selected && (
        <LogDrawer log={selected} onClose={() => setSelected(null)} />
      )}
    </DashboardShell>
  );
}
