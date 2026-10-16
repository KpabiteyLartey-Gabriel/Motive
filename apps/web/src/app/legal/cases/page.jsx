'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/useAuth';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { EmptyState, StatusBadge } from '@/components/dashboard/DashboardUI';
import { disputesApi } from '@/lib/api';

import { LEGAL_NAV, LEGAL_ROLES } from '@/lib/legalNav';

const DISPUTE_STATUSES = ['OPEN', 'AWAITING_RESPONSE', 'UNDER_REVIEW', 'MEDIATION', 'DECISION_PENDING', 'RESOLVED', 'REJECTED', 'ESCALATED', 'CLOSED', 'APPEALED'];
const DISPUTE_TYPES    = ['PAYMENT_DISPUTE', 'CONTRACT_DISPUTE', 'VEHICLE_DAMAGE', 'VEHICLE_CONDITION', 'MAINTENANCE', 'REVENUE_DISAGREEMENT', 'VEHICLE_RETURN', 'OWNERSHIP_TRANSFER', 'OTHER'];

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function LegalCasesPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: LEGAL_ROLES });
  const [disputes, setDisputes]     = useState([]);
  const [pagination, setPagination] = useState(null);
  const [fetching, setFetching]     = useState(false);
  const [statusFilter, setStatus]   = useState('');
  const [typeFilter, setType]       = useState('');
  const [search, setSearch]         = useState('');
  const [page, setPage]             = useState(1);

  const load = useCallback(() => {
    if (!user) return;
    setFetching(true);
    disputesApi
      .list({ page, limit: 25, status: statusFilter || undefined, type: typeFilter || undefined })
      .then((res) => {
        setDisputes(res.data?.data?.disputes || []);
        setPagination(res.data?.data?.pagination || null);
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user, page, statusFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = search.trim()
    ? disputes.filter((d) => {
        const q = search.toLowerCase();
        return (
          d.type?.toLowerCase().includes(q) ||
          d.status?.toLowerCase().includes(q) ||
          d.initiator?.firstName?.toLowerCase().includes(q) ||
          d.initiator?.lastName?.toLowerCase().includes(q) ||
          d.id?.toLowerCase().includes(q)
        );
      })
    : disputes;

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={LEGAL_NAV} title="Cases">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium text-graphite dark:text-paper mb-1" style={{ letterSpacing: "-0.02em" }}>Dispute Cases</h2>
          <p className="text-sm text-steel dark:text-neutral-500">
            {pagination ? `${pagination.total} total case${pagination.total !== 1 ? 's' : ''}` : 'All cases'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          type="text"
          placeholder="Search by name, type, ID…"
          className="input flex-1 max-w-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input w-52" value={statusFilter} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {DISPUTE_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select className="input w-52" value={typeFilter} onChange={(e) => { setType(e.target.value); setPage(1); }}>
          <option value="">All types</option>
          {DISPUTE_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {fetching ? (
        <div className="text-neutral-500 text-sm py-8 text-center">Loading…</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="📋" title="No cases found" description="No dispute cases match the current filters." />
      ) : (
        <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-neutral-200 dark:border-dark-border rounded-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-dark-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 hidden sm:table-cell">Initiator</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 hidden md:table-cell">Respondent</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 hidden md:table-cell">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 hidden lg:table-cell">Assigned</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 hidden lg:table-cell">Opened</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-200 dark:divide-dark-border">
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-chalk dark:hover:bg-dark-elevated transition-colors cursor-pointer" onClick={() => window.location.href = `/legal/case/${d.id}`}>
                  <td className="px-4 py-3 text-xs text-neutral-300">{d.type?.replace(/_/g, ' ') || '—'}</td>
                  <td className="px-4 py-3 text-xs text-white hidden sm:table-cell">
                    {d.initiator ? `${d.initiator.firstName} ${d.initiator.lastName}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-400 hidden md:table-cell">
                    {d.respondent ? `${d.respondent.firstName} ${d.respondent.lastName}` : '—'}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                  <td className="px-4 py-3 text-xs text-neutral-400 hidden md:table-cell">{d.priority || '—'}</td>
                  <td className="px-4 py-3 text-xs hidden lg:table-cell">
                    {d.assignedTo
                      ? <span className="text-neutral-400">{d.assignedTo.firstName} {d.assignedTo.lastName}</span>
                      : <span className="text-yellow-500">Unassigned</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-500 hidden lg:table-cell">{fmt(d.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <a href={`/legal/case/${d.id}`} className="text-xs text-neutral-500 hover:text-white transition-colors" onClick={(e) => e.stopPropagation()}>
                      Open →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-5">
          <p className="text-xs text-neutral-500">
            Page {page} of {pagination.pages}
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 text-xs border border-neutral-200 dark:border-dark-border rounded-lg text-neutral-400 hover:text-white hover:border-neutral-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <button
              disabled={page >= pagination.pages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 text-xs border border-neutral-200 dark:border-dark-border rounded-lg text-neutral-400 hover:text-white hover:border-neutral-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
