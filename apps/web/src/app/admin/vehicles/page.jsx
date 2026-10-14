'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/useAuth';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { StatusBadge } from '@/components/dashboard/DashboardUI';
import { ADMIN_NAV, AdminTable, AdminPagination, fmt } from '@/components/dashboard/AdminHelpers';
import { adminApi } from '@/lib/api';
import VehiclePhotos from '@/components/vehicles/VehiclePhotos';

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
    </DashboardShell>
  );
}
