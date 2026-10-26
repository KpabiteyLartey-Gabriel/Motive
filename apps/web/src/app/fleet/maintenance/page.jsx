'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import { SectionHeader, EmptyState, StatusBadge } from '@/components/dashboard/DashboardUI';
import { maintenanceApi, vehiclesApi } from '@/lib/api';
import { FLEET_ROLES } from '@/lib/fleetNav';

const STATUSES = ['REQUESTED', 'APPROVED', 'SCHEDULED', 'IN_PROGRESS', 'WAITING_FOR_PARTS', 'COMPLETED', 'CANCELLED'];
const TYPES = ['ROUTINE', 'BREAKDOWN', 'ACCIDENT', 'INSPECTION'];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function FleetMaintenancePage() {
  const { user, loading, logout } = useAuth({ requiredRoles: FLEET_ROLES });
  const [requests, setRequests] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [form, setForm] = useState({ vehicleId: '', type: 'ROUTINE', description: '', urgency: 'NORMAL' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => maintenanceApi.list({ limit: 100 })
    .then((r) => setRequests(r.data?.data?.requests || []))
    .catch(() => {})
    .finally(() => setFetching(false));

  useEffect(() => {
    if (!user) return;
    load();
    vehiclesApi.list({ limit: 100 }).then((r) => {
      const vs = r.data?.data?.vehicles || [];
      setVehicles(vs);
      if (vs[0]) setForm((f) => ({ ...f, vehicleId: vs[0].id }));
    }).catch(() => {});
  }, [user]);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await maintenanceApi.create(form);
      setForm((f) => ({ ...f, description: '' }));
      load();
    } catch (err) { setError(err.response?.data?.message || 'Could not create request.'); }
    finally { setBusy(false); }
  };

  const setStatus = async (id, status) => {
    try {
      await maintenanceApi.update(id, { status });
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    } catch (err) { setError(err.response?.data?.message || 'Could not update status.'); }
  };

  if (loading) return <div className="min-h-screen bg-chalk flex items-center justify-center"><div className="text-neutral-500 text-sm">Loading…</div></div>;

  return (
    <>
      <SectionHeader title="Maintenance" description="Raise and progress service, repair and inspection requests" />
      {error && <div className="bg-danger/10 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg mb-4">{Array.isArray(error) ? error.join(', ') : error}</div>}

      <form onSubmit={create} className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-4 mb-5">
        <p className="text-sm font-semibold text-neutral-900 dark:text-white mb-3">New request</p>
        <div className="grid sm:grid-cols-4 gap-3">
          <select className="input" value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.registrationNumber} — {v.make} {v.model}</option>)}
          </select>
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="input" value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })}>
            {['LOW', 'NORMAL', 'HIGH', 'CRITICAL'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button disabled={busy || !form.vehicleId} className="text-xs font-medium px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 disabled:opacity-40">{busy ? 'Creating…' : 'Create request'}</button>
        </div>
        <textarea required className="input mt-3" rows={2} placeholder="Describe the work needed…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </form>

      {fetching ? (
        <div className="text-neutral-500 text-sm py-8 text-center">Loading requests…</div>
      ) : requests.length === 0 ? (
        <EmptyState icon="🔧" title="No maintenance requests" description="Requests you raise or drivers submit will appear here." />
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">{r.type?.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">{r.vehicle?.registrationNumber || ''} · {fmtDate(r.createdAt)} · {r.urgency || 'NORMAL'}</p>
                  <p className="text-xs text-neutral-500 mt-1">{r.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={r.status} />
                  <select className="input !w-auto text-xs" value={r.status} onChange={(e) => setStatus(r.id, e.target.value)}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
