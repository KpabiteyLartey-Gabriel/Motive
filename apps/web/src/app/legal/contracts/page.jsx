'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { SectionHeader, EmptyState, StatusBadge } from '@/components/dashboard/DashboardUI';
import { contractsApi } from '@/lib/api';
import { LEGAL_NAV, LEGAL_ROLES } from '@/lib/legalNav';

const STATUSES = ['DRAFT', 'PENDING_SIGNATURES', 'ACTIVE', 'SUSPENDED', 'TERMINATED', 'EXPIRED', 'COMPLETED', 'IN_DISPUTE'];
const TYPES = ['WORK_AND_PAY', 'RENTAL', 'DRIVING_ON'];

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function LegalContractsPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: LEGAL_ROLES });
  const [contracts, setContracts] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [selected, setSelected] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => contractsApi.list({ limit: 100, status: statusFilter || undefined })
    .then((r) => setContracts(r.data?.data?.contracts || []))
    .catch(() => {})
    .finally(() => setFetching(false));

  useEffect(() => { if (user) load(); }, [user, statusFilter]);

  const filtered = search.trim()
    ? contracts.filter((c) => {
        const q = search.toLowerCase();
        return c.contractNumber?.toLowerCase().includes(q) || c.title?.toLowerCase().includes(q)
          || c.vehicle?.registrationNumber?.toLowerCase().includes(q) || c.type?.toLowerCase().includes(q);
      })
    : contracts;

  const act = async (fn, okMsg) => {
    setBusy(true); setError('');
    try { await fn(); await load(); }
    catch (err) { setError(err.response?.data?.message || 'Action failed.'); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="min-h-screen bg-chalk flex items-center justify-center"><div className="text-neutral-500 text-sm">Loading…</div></div>;

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={LEGAL_NAV} title="Contracts">
      <SectionHeader title="Contracts" description="Monitor and manage every contract, grouped by the vehicle it covers" />
      {error && <div className="bg-danger/10 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg mb-4">{Array.isArray(error) ? error.join(', ') : error}</div>}

      <div className="flex flex-wrap gap-3 mb-5">
        <input className="input max-w-xs" placeholder="Search contract no, vehicle, title…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input !w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {fetching ? (
        <div className="text-neutral-500 text-sm py-8 text-center">Loading contracts…</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="📄" title="No contracts found" description="Contracts created for vehicles will appear here for legal monitoring." />
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <div key={c.id} className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3 cursor-pointer" onClick={() => setSelected(selected?.id === c.id ? null : c)}>
                <div>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">{c.title || c.contractNumber}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {c.contractNumber} · {c.type?.replace(/_/g, ' ')} · Vehicle: {c.vehicle ? `${c.vehicle.registrationNumber} — ${c.vehicle.make} ${c.vehicle.model}` : '—'}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">{fmt(c.startDate)} – {fmt(c.endDate)} · Parties: {(c.parties || []).map((p) => p.role.replace(/_/g, ' ')).join(', ') || '—'}</p>
                </div>
                <StatusBadge status={c.status} />
              </div>

              {selected?.id === c.id && (
                <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-dark-border">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs mb-4">
                    <div><p className="text-neutral-500">Signed parties</p><p className="text-neutral-900 dark:text-white mt-0.5">{(c.parties || []).filter((p) => p.signedAt).length} / {(c.parties || []).length} signed</p></div>
                    <div><p className="text-neutral-500">Created</p><p className="text-neutral-900 dark:text-white mt-0.5">{fmt(c.createdAt)}</p></div>
                    <div><p className="text-neutral-500">Description</p><p className="text-neutral-900 dark:text-white mt-0.5">{c.description || '—'}</p></div>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-xs text-neutral-500">Legal actions:</span>
                    <select disabled={busy} className="input !w-auto text-xs" value={c.status} onChange={(e) => act(() => contractsApi.updateStatus(c.id, e.target.value))}>
                      {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                    </select>
                    {!['TERMINATED', 'COMPLETED', 'EXPIRED'].includes(c.status) && (
                      <button disabled={busy} className="text-xs px-3 py-1.5 rounded-lg border border-red-300 text-red-500 disabled:opacity-40"
                        onClick={() => { const reason = window.prompt('Reason for termination:'); if (reason) act(() => contractsApi.terminate(c.id, reason)); }}>
                        Terminate contract
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
