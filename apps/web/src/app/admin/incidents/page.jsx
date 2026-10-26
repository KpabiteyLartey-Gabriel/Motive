'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/useAuth';
import { StatusBadge } from '@/components/dashboard/DashboardUI';
import { AdminTable, AdminPagination, fmt } from '@/components/dashboard/AdminHelpers';
import { adminApi } from '@/lib/api';

const INCIDENT_STATUSES = ['REPORTED', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED'];
const INCIDENT_TYPES    = ['ACCIDENT', 'BREAKDOWN', 'THEFT', 'DAMAGE', 'TRAFFIC', 'OTHER'];

function IncidentDrawer({ incident, onClose }) {
  const evidence = incident.evidence || [];
  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-chalk dark:bg-paper dark:bg-dark-surface border-l border-concrete dark:border-dark-border z-50 flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-concrete dark:border-dark-border">
          <h2 className="text-base font-medium text-graphite dark:text-paper">Incident Details</h2>
          <button onClick={onClose} className="text-fog hover:text-graphite dark:hover:text-paper transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 px-6 py-6 space-y-6">
          <div>
            <p className="text-xs text-neutral-500 font-mono mb-2">{incident.incidentNumber}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={incident.status} />
              <span className="text-xs text-neutral-400">{incident.type?.replace(/_/g, ' ')}</span>
            </div>
          </div>

          <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-xl divide-y divide-neutral-200 dark:divide-dark-border">
            {[
              { label: 'Title',            value: incident.title },
              { label: 'Vehicle ID',       value: incident.vehicleId || '—' },
              { label: 'Driver ID',        value: incident.driverId || '—' },
              { label: 'Contract ID',      value: incident.contractId || '—' },
              { label: 'Location',         value: incident.location || '—' },
              { label: 'Police Reference', value: incident.policeReference || '—' },
              { label: 'Insurance Claim',  value: incident.insuranceClaim || '—' },
              { label: 'Est. Damage',      value: incident.estimatedDamage != null ? `GHS ${Number(incident.estimatedDamage).toLocaleString()}` : '—' },
              { label: 'Incident Date',    value: fmt(incident.incidentDate) },
              { label: 'Reported',         value: fmt(incident.createdAt) },
              { label: 'Resolved',         value: incident.resolvedAt ? fmt(incident.resolvedAt) : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between px-4 py-3 gap-4">
                <span className="text-xs text-fog flex-shrink-0">{label}</span>
                <span className="text-xs text-steel dark:text-neutral-300 text-right break-all">{value}</span>
              </div>
            ))}
          </div>

          {incident.description && (
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-2">Description</p>
              <p className="text-xs text-neutral-300 leading-relaxed">{incident.description}</p>
            </div>
          )}

          {incident.resolutionNotes && (
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-2">Resolution</p>
              <p className="text-xs text-neutral-300 leading-relaxed">{incident.resolutionNotes}</p>
            </div>
          )}

          {evidence.length > 0 && (
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-2">Evidence ({evidence.length})</p>
              <div className="space-y-1">
                {evidence.map((e) => (
                  <div key={e.id} className="flex items-center justify-between bg-chalk dark:bg-dark-elevated rounded-lg px-3 py-2 text-xs">
                    <span className="text-neutral-300">{e.fileName}</span>
                    <span className="text-neutral-500 ml-2">{e.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function AdminIncidentsPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['ADMIN', 'SUPER_ADMIN'] });
  const [incidents, setIncidents]   = useState([]);
  const [pagination, setPagination] = useState(null);
  const [fetching, setFetching]     = useState(false);
  const [statusFilter, setStatus]   = useState('');
  const [typeFilter, setType]       = useState('');
  const [page, setPage]             = useState(1);
  const [selected, setSelected]     = useState(null);

  const load = useCallback(() => {
    if (!user) return;
    setFetching(true);
    adminApi
      .listIncidents({ page, limit: 20, status: statusFilter || undefined, type: typeFilter || undefined })
      .then((res) => {
        setIncidents(res.data.data.incidents);
        setPagination(res.data.data.pagination);
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user, page, statusFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="min-h-screen bg-chalk flex items-center justify-center">
      <div className="text-neutral-500 text-sm">Loading…</div>
    </div>
  );

  const COLS = [
    {
      key: 'title', label: 'Title',
      render: (i) => <span className="text-graphite dark:text-paper font-medium text-xs">{i.title}</span>,
    },
    {
      key: 'type', label: 'Type',
      render: (i) => <span className="text-neutral-400 text-xs">{i.type?.replace(/_/g, ' ')}</span>,
    },
    {
      key: 'status', label: 'Status',
      render: (i) => <StatusBadge status={i.status} />,
    },
    {
      key: 'incidentDate', label: 'Date', hidden: 'hidden md:table-cell',
      render: (i) => <span className="text-neutral-500 text-xs">{fmt(i.incidentDate)}</span>,
    },
    {
      key: 'evidence', label: 'Evidence', hidden: 'hidden lg:table-cell',
      render: (i) => <span className="text-neutral-400 text-xs">{i.evidence?.length ?? 0} file{i.evidence?.length !== 1 ? 's' : ''}</span>,
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium text-graphite dark:text-paper mb-1" style={{ letterSpacing: "-0.02em" }}>Incidents</h2>
          <p className="text-sm text-steel dark:text-neutral-500">
            {pagination ? `${pagination.total} incident${pagination.total !== 1 ? 's' : ''}` : 'Loading…'}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <select className="input w-52" value={statusFilter} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {INCIDENT_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select className="input w-52" value={typeFilter} onChange={(e) => { setType(e.target.value); setPage(1); }}>
          <option value="">All types</option>
          {INCIDENT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card overflow-hidden">
        <AdminTable columns={COLS} rows={incidents} loading={fetching} onRowClick={setSelected} />
      </div>
      <AdminPagination pagination={pagination} page={page} setPage={setPage} />

      {selected && <IncidentDrawer incident={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
