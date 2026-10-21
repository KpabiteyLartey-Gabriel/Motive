'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/useAuth';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { StatusBadge } from '@/components/dashboard/DashboardUI';
import { ADMIN_NAV, AdminTable, AdminPagination, fmt } from '@/components/dashboard/AdminHelpers';
import { adminApi, vehiclesApi, resolveVehiclePhoto } from '@/lib/api';
import VehiclePhotos from '@/components/vehicles/VehiclePhotos';

const EVIDENCE_SLOTS = [
  { kind: 'frontPlate', label: 'Front — number plate' },
  { kind: 'rearPlate', label: 'Rear — number plate' },
  { kind: 'vinPlate', label: 'Chassis / VIN plate' },
  { kind: 'registrationCert', label: 'Registration Certificate (DVLA)' },
];

function VerificationReview({ vehicle, onClose, onDecided }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);

  const decide = async (approve) => {
    setBusy(approve ? 'approve' : 'reject');
    setError('');
    try {
      const res = await vehiclesApi.decideVerification(vehicle.id, approve, approve ? undefined : note.trim());
      onDecided(res.data?.data || { ...vehicle, verificationStatus: approve ? 'APPROVED' : 'REJECTED' });
    } catch (e) {
      setError(e.response?.data?.message || 'Could not record the decision.');
    } finally {
      setBusy('');
    }
  };

  const rows = [
    ['Registration number', vehicle.registrationNumber],
    ['Chassis number', vehicle.chassisNumber],
    ['Make / Model', `${vehicle.make || ''} ${vehicle.model || ''}`],
    ['Year', vehicle.year],
    ['Colour', vehicle.color],
    ['Type', vehicle.type],
    ['Fuel / Transmission', `${vehicle.fuelType || '—'} / ${vehicle.transmission || '—'}`],
    ['Region', vehicle.region],
    ['Submitted by', vehicle.owner?.user ? `${vehicle.owner.user.firstName || ''} ${vehicle.owner.user.lastName || ''} (${vehicle.owner.user.email || vehicle.owner.user.phone || ''})` : vehicle.managingCompany?.name || '—'],
    ['Submitted at', vehicle.verificationSubmittedAt ? new Date(vehicle.verificationSubmittedAt).toLocaleString() : '—'],
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-chalk dark:bg-dark-surface border-l border-concrete dark:border-dark-border z-50 flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-concrete dark:border-dark-border">
          <h2 className="text-base font-medium text-graphite dark:text-paper">Verify vehicle identity</h2>
          <button onClick={onClose} className="text-fog hover:text-graphite dark:hover:text-paper">✕</button>
        </div>
        <div className="flex-1 px-6 py-6 space-y-6">
          {error && <div className="bg-danger/10 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>}
          <p className="text-sm text-steel dark:text-neutral-400">Confirm every submitted detail below against the evidence images — the plate photos must show the registration number, the VIN close-up must show the chassis number, and the certificate must agree with all of it (DVLA Vehicle Registration Certificate).</p>
          <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-xl divide-y divide-neutral-200 dark:divide-dark-border">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-start justify-between px-4 py-2.5 gap-4">
                <span className="text-xs text-fog flex-shrink-0">{label}</span>
                <span className="text-xs font-medium text-steel dark:text-neutral-200 text-right break-all">{value || '—'}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-medium text-fog uppercase tracking-widest mb-3">Evidence images</p>
            <div className="grid grid-cols-2 gap-3">
              {EVIDENCE_SLOTS.map((slot) => {
                const url = vehicle.verificationEvidence?.[slot.kind];
                return (
                  <div key={slot.kind} className="border border-neutral-200 dark:border-dark-border rounded-lg p-2">
                    <p className="text-[11px] text-neutral-500 mb-2">{slot.label}</p>
                    {url ? <button type="button" onClick={() => setPreview({ url: resolveVehiclePhoto(url), label: slot.label })} className="block w-full cursor-zoom-in"><img src={resolveVehiclePhoto(url)} alt="" className="w-full h-28 object-cover rounded-md" /></button> : <div className="w-full h-28 rounded-md bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-[11px] text-red-400">Missing</div>}
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-fog uppercase tracking-widest mb-2">If rejecting, say what does not match</p>
            <textarea className="input w-full" rows={3} placeholder="e.g. Chassis number in the VIN photo ends 4221, but 4212 was submitted" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => decide(true)} disabled={!!busy} className="btn-primary text-sm flex-1 disabled:opacity-40">{busy === 'approve' ? 'Verifying…' : 'Verify vehicle'}</button>
            <button onClick={() => decide(false)} disabled={!!busy || !note.trim()} className="px-4 py-2 rounded-lg border border-danger/40 text-danger text-sm font-medium hover:bg-danger/10 disabled:opacity-40">{busy === 'reject' ? 'Rejecting…' : 'Reject'}</button>
          </div>
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 lg:right-[512px] z-[60] bg-black/80 flex flex-col" onClick={() => setPreview(null)}>
          <div className="flex items-center justify-between px-5 py-3">
            <p className="text-sm text-white/90">{preview.label} — {vehicle.make} {vehicle.model} ({vehicle.registrationNumber})</p>
            <button type="button" onClick={() => setPreview(null)} className="text-white/80 hover:text-white text-xl leading-none px-2" aria-label="Close preview">✕</button>
          </div>
          <div className="flex-1 flex items-center justify-center px-6 pb-6 min-h-0">
            <img src={preview.url} alt={preview.label} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
          </div>
          <p className="text-center text-xs text-white/60 pb-4">Click anywhere outside the image to close</p>
        </div>
      )}
    </>
  );
}

const VERIFY_STATUSES = ['AVAILABLE', 'SUSPENDED', 'ARCHIVED'];

const MODEL_LABELS = {
  WORK_AND_PAY: 'Work & Pay',
  RENTAL:       'Rental',
  DRIVING_ON:   'Driving On',
};

function VehicleDrawer({ vehicle, onClose, onStatusChange }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleStatus = async (status) => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.updateVehicleStatus(vehicle.id, status);
      onStatusChange({ ...vehicle, ...res.data.data });
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update status.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-chalk dark:bg-paper dark:bg-dark-surface border-l border-concrete dark:border-dark-border z-50 flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-concrete dark:border-dark-border">
          <h2 className="text-base font-medium text-graphite dark:text-paper">Vehicle Details</h2>
          <button onClick={onClose} className="text-fog hover:text-graphite dark:hover:text-paper transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 px-6 py-6 space-y-6">
          {error && (
            <div className="bg-danger/10 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>
          )}

          {/* Identity */}
          <div>
            <h3 className="font-medium text-graphite dark:text-paper mb-1" style={{ fontSize: "1.125rem", letterSpacing: "-0.015em" }}>
              {vehicle.make} {vehicle.model} ({vehicle.year})
            </h3>
            <p className="text-sm text-steel dark:text-neutral-400 mb-2 font-mono">{vehicle.registrationNumber}</p>
            <div className="flex items-center gap-2">
              <StatusBadge status={vehicle.status} />
              {vehicle.operatingModel && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-chip text-xs font-medium bg-graphite/10 text-graphite dark:text-paper">
                  {MODEL_LABELS[vehicle.operatingModel] || vehicle.operatingModel}
                </span>
              )}
            </div>
          </div>

          <VehiclePhotos vehicle={vehicle} />

          {/* Info */}
          <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-xl divide-y divide-neutral-200 dark:divide-dark-border">
            {[
              { label: 'Vehicle ID',     value: vehicle.id },
              { label: 'VIN',            value: vehicle.vin || '—' },
              { label: 'Type',           value: vehicle.type || '—' },
              { label: 'Fuel',           value: vehicle.fuelType || '—' },
              { label: 'Transmission',   value: vehicle.transmission || '—' },
              { label: 'Color',          value: vehicle.color || '—' },
              { label: 'Mileage',        value: vehicle.mileage ? `${vehicle.mileage.toLocaleString()} km` : '—' },
              { label: 'Region',         value: vehicle.region || '—' },
              { label: 'Est. Value',     value: vehicle.estimatedValue ? `GHS ${parseFloat(vehicle.estimatedValue).toLocaleString()}` : '—' },
              { label: 'Registered',     value: fmt(vehicle.createdAt) },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between px-4 py-3 gap-4">
                <span className="text-xs text-fog flex-shrink-0">{label}</span>
                <span className="text-xs text-steel dark:text-neutral-300 text-right break-all">{value}</span>
              </div>
            ))}
          </div>

          {/* Status actions — only show for pending verification */}
          {vehicle.status === 'PENDING_VERIFICATION' && (
            <div>
              <p className="text-xs font-medium text-fog uppercase tracking-widest mb-3">Verification Decision</p>
              <div className="flex gap-2 flex-wrap">
                {VERIFY_STATUSES.map((s) => (
                  <button
                    key={s}
                    disabled={loading}
                    onClick={() => handleStatus(s)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-40 ${
                      s === 'AVAILABLE' ? 'border-success/40 text-success hover:bg-success/10'
                      : s === 'SUSPENDED' ? 'border-warning/40 text-warning hover:bg-warning/10'
                      : 'border-danger/40 text-danger hover:bg-danger/10'
                    }`}
                  >
                    {loading ? '…' : s.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function AdminVehiclesPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['ADMIN', 'SUPER_ADMIN'] });
  const [vehicles, setVehicles]     = useState([]);
  const [pagination, setPagination] = useState(null);
  const [fetching, setFetching]     = useState(false);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('');
  const [page, setPage]             = useState(1);
  const [selected, setSelected]     = useState(null);

  const load = useCallback(() => {
    if (!user) return;
    setFetching(true);
    adminApi
      .listVehicles({ page, limit: 20, search: search || undefined, status: statusFilter || undefined })
      .then((res) => {
        setVehicles(res.data.data.vehicles);
        setPagination(res.data.data.pagination);
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user, page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const [queue, setQueue]     = useState([]);
  const [review, setReview]   = useState(null);
  const isSuperAdmin = user?.primaryRole === 'SUPER_ADMIN';

  const loadQueue = useCallback(() => {
    if (!user || user.primaryRole !== 'SUPER_ADMIN') return;
    vehiclesApi.verificationQueue()
      .then((res) => setQueue(res.data?.data || []))
      .catch(() => setQueue([]));
  }, [user]);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  const handleDecided = (updated) => {
    setQueue((prev) => prev.filter((v) => v.id !== updated.id));
    setVehicles((prev) => prev.map((v) => (v.id === updated.id ? { ...v, ...updated } : v)));
    setReview(null);
  };

  const handleStatusChange = (updated) => {
    setVehicles((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
    setSelected((prev) => prev?.id === updated.id ? updated : prev);
  };

  const VEHICLE_STATUSES = [
    'DRAFT', 'PENDING_VERIFICATION', 'AVAILABLE', 'ASSIGNED',
    'ACTIVE', 'UNDER_MAINTENANCE', 'SUSPENDED', 'ARCHIVED',
  ];

  const COLS = [
    {
      key: 'vehicle', label: 'Vehicle',
      render: (v) => (
        <div>
          <p className="text-graphite dark:text-paper font-medium text-sm">{v.make} {v.model} ({v.year})</p>
          <p className="text-neutral-500 text-xs font-mono">{v.registrationNumber}</p>
        </div>
      ),
    },
    {
      key: 'type', label: 'Type', hidden: 'hidden md:table-cell',
      render: (v) => <span className="text-neutral-400 text-xs">{v.type}</span>,
    },
    {
      key: 'operatingModel', label: 'Model', hidden: 'hidden lg:table-cell',
      render: (v) => (
        <span className="text-neutral-400 text-xs">
          {v.operatingModel ? MODEL_LABELS[v.operatingModel] || v.operatingModel : '—'}
        </span>
      ),
    },
    {
      key: 'status', label: 'Status',
      render: (v) => <StatusBadge status={v.status} />,
    },
    {
      key: 'verificationStatus', label: 'Verified', hidden: 'hidden md:table-cell',
      render: (v) => <span className={`text-xs font-medium ${v.verificationStatus === 'APPROVED' ? 'text-green-500' : v.verificationStatus === 'PENDING_REVIEW' ? 'text-amber-500' : v.verificationStatus === 'REJECTED' ? 'text-red-500' : 'text-neutral-500'}`}>{(v.verificationStatus || 'NOT_SUBMITTED').replace(/_/g, ' ')}</span>,
    },
    {
      key: 'createdAt', label: 'Added', hidden: 'hidden lg:table-cell',
      render: (v) => <span className="text-neutral-500 text-xs">{fmt(v.createdAt)}</span>,
    },
  ];

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={ADMIN_NAV} title="Vehicles">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium text-graphite dark:text-paper mb-1" style={{ letterSpacing: "-0.02em" }}>Vehicles</h2>
          <p className="text-sm text-steel dark:text-neutral-500">
            {pagination ? `${pagination.total} vehicle${pagination.total !== 1 ? 's' : ''}` : 'Loading…'}
          </p>
        </div>
      </div>

      {isSuperAdmin && (
        <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-4 mb-5">
          <p className="text-sm font-semibold text-graphite dark:text-paper mb-1">Verification queue ({queue.length})</p>
          <p className="text-xs text-neutral-500 mb-3">Vehicles cannot be published until you confirm the submitted registration and chassis numbers, colour, type and year against the owner&apos;s evidence images.</p>
          {queue.length === 0 ? (
            <p className="text-xs text-neutral-500">Nothing waiting for verification.</p>
          ) : (
            <div className="space-y-2">
              {queue.map((v) => (
                <button key={v.id} onClick={() => setReview(v)} className="w-full text-left border border-neutral-200 dark:border-dark-border rounded-lg px-3 py-2.5 hover:border-neutral-500 transition-colors">
                  <span className="text-sm font-medium text-graphite dark:text-paper">{v.make} {v.model} ({v.year})</span>
                  <span className="text-xs text-neutral-500 font-mono ml-2">{v.registrationNumber}</span>
                  <span className="text-xs text-neutral-500 ml-2">Chassis {v.chassisNumber || '—'}</span>
                  <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">Waiting since {v.verificationSubmittedAt ? new Date(v.verificationSubmittedAt).toLocaleDateString() : '—'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          type="text"
          placeholder="Search registration, make or model…"
          className="input flex-1"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className="input w-52"
          value={statusFilter}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="">All statuses</option>
          {VEHICLE_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card overflow-hidden">
        <AdminTable columns={COLS} rows={vehicles} loading={fetching} onRowClick={setSelected} />
      </div>
      <AdminPagination pagination={pagination} page={page} setPage={setPage} />

      {selected && (
        <VehicleDrawer
          vehicle={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
        />
      )}

      {review && (
        <VerificationReview
          vehicle={review}
          onClose={() => setReview(null)}
          onDecided={handleDecided}
        />
      )}
    </DashboardShell>
  );
}
