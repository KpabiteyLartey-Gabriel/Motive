'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { SectionHeader, EmptyState, StatusBadge } from '@/components/dashboard/DashboardUI';
import { complianceApi, vehiclesApi } from '@/lib/api';
import { LEGAL_NAV, LEGAL_ROLES } from '@/lib/legalNav';

const DOC_TYPES = ['INSURANCE', 'ROADWORTHINESS', 'VEHICLE_REGISTRATION', 'DRIVERS_LICENSE', 'BUSINESS_LICENSE', 'TAX_CLEARANCE', 'OTHER'];
const FILTERS = ['', 'VALID', 'EXPIRING_SOON', 'EXPIRED', 'PENDING_RENEWAL'];

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function LegalDocumentsPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: LEGAL_ROLES });
  const [records, setRecords] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ vehicleId: '', documentType: 'INSURANCE', documentNumber: '', issuer: '', expiryDate: '' });
  const [renewal, setRenewal] = useState({});

  const load = () => Promise.all([
    complianceApi.list({ limit: 100, status: statusFilter || undefined }).catch(() => null),
    vehiclesApi.list({ limit: 100 }).catch(() => null),
  ]).then(([docs, v]) => {
    setRecords(docs?.data?.data?.records || []);
    const vs = v?.data?.data?.vehicles || [];
    setVehicles(vs);
    setForm((f) => (f.vehicleId ? f : { ...f, vehicleId: vs[0]?.id || '' }));
  }).finally(() => setFetching(false));

  useEffect(() => { if (user) load(); }, [user, statusFilter]);

  const vehicleName = (id) => {
    const v = vehicles.find((x) => x.id === id);
    return v ? `${v.registrationNumber} — ${v.make} ${v.model}` : (id ? 'Vehicle' : 'Driver document');
  };

  const update = async (id, body, msg) => {
    setBusy(true); setError('');
    try { await complianceApi.updateStatus(id, body); await load(); }
    catch (err) { setError(err.response?.data?.message || 'Could not update document.'); }
    finally { setBusy(false); }
  };

  const add = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await complianceApi.create({ ...form, expiryDate: form.expiryDate || undefined });
      setForm((f) => ({ ...f, documentNumber: '', issuer: '', expiryDate: '' }));
      await load();
    } catch (err) { setError(err.response?.data?.message || 'Could not add document.'); }
    finally { setBusy(false); }
  };

  const expiring = records.filter((r) => ['EXPIRED', 'EXPIRING_SOON', 'PENDING_RENEWAL'].includes(r.status));

  if (loading) return <div className="min-h-screen bg-chalk flex items-center justify-center"><div className="text-neutral-500 text-sm">Loading…</div></div>;

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={LEGAL_NAV} title="Vehicle Paperwork">
      <SectionHeader title="Vehicle Paperwork" description="Insurance, roadworthiness, registration and every document a vehicle needs — monitored across all vehicles" />
      {error && <div className="bg-danger/10 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg mb-4">{Array.isArray(error) ? error.join(', ') : error}</div>}

      {expiring.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-5 py-4 mb-5">
          <span className="text-yellow-500 text-sm font-semibold">{expiring.length} document{expiring.length !== 1 ? 's' : ''} need attention</span>
          <span className="text-yellow-500/70 text-xs ml-2">expired, expiring soon, or pending renewal — renew them below or from the vehicle.</span>
        </div>
      )}

      <form onSubmit={add} className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-4 mb-5">
        <p className="text-sm font-semibold text-neutral-900 dark:text-white mb-3">Add a document for a vehicle</p>
        <div className="grid sm:grid-cols-5 gap-3">
          <select className="input" value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.registrationNumber} — {v.make} {v.model}</option>)}
          </select>
          <select className="input" value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value })}>
            {DOC_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
          <input className="input" placeholder="Document no." value={form.documentNumber} onChange={(e) => setForm({ ...form, documentNumber: e.target.value })} />
          <input className="input" placeholder="Issuer (e.g. insurer, DVLA)" value={form.issuer} onChange={(e) => setForm({ ...form, issuer: e.target.value })} />
          <input className="input" type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
        </div>
        <button disabled={busy || !form.vehicleId} className="mt-3 text-xs font-medium px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 disabled:opacity-40">{busy ? 'Adding…' : 'Add document'}</button>
      </form>

      <div className="flex gap-2 mb-5 flex-wrap">
        {FILTERS.map((s) => (
          <button key={s || 'ALL'} onClick={() => setStatusFilter(s)} className={`text-xs px-3 py-1.5 rounded-lg border ${statusFilter === s ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'border-neutral-300 dark:border-dark-border text-neutral-600 dark:text-neutral-300'}`}>
            {s ? s.replace(/_/g, ' ') : 'All documents'}
          </button>
        ))}
      </div>

      {fetching ? (
        <div className="text-neutral-500 text-sm py-8 text-center">Loading paperwork…</div>
      ) : records.length === 0 ? (
        <EmptyState icon="🗂" title="No documents found" description="Vehicle insurance, roadworthiness and registration records will appear here." />
      ) : (
        <div className="space-y-3">
          {records.map((r) => (
            <div key={r.id} className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">{r.documentType.replace(/_/g, ' ')}{r.documentNumber ? ` · ${r.documentNumber}` : ''}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">{vehicleName(r.vehicleId)}{r.issuer ? ` · Issued by ${r.issuer}` : ''}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">Expires: {fmt(r.expiryDate)} · Last checked: {fmt(r.lastCheckedAt)}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <div className="flex flex-wrap gap-2 items-center mt-3">
                <input type="date" className="input !w-auto text-xs" value={renewal[r.id] || ''} onChange={(e) => setRenewal({ ...renewal, [r.id]: e.target.value })} />
                <button disabled={busy || !renewal[r.id]} onClick={() => update(r.id, { expiryDate: renewal[r.id] })} className="text-xs px-3 py-1.5 rounded-lg border border-green-300 text-green-600 disabled:opacity-40">Renew to date</button>
                {r.status !== 'PENDING_RENEWAL' && (
                  <button disabled={busy} onClick={() => update(r.id, { status: 'PENDING_RENEWAL' })} className="text-xs px-3 py-1.5 rounded-lg border border-yellow-300 text-yellow-600 disabled:opacity-40">Mark pending renewal</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
