'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/useAuth';
import { StatusBadge } from '@/components/dashboard/DashboardUI';
import { AdminTable, AdminPagination, fmt } from '@/components/dashboard/AdminHelpers';
import { adminApi } from '@/lib/api';

const DRIVER_STATUSES = ['PENDING_VERIFICATION', 'VERIFIED', 'ACTIVE', 'INACTIVE', 'SUSPENDED'];

function DriverDrawer({ driver, onClose, onStatusChange }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleStatus = async (status) => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.updateDriverStatus(driver.id, status);
      onStatusChange({ ...driver, ...res.data.data });
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
          <h2 className="text-base font-medium text-graphite dark:text-paper">Driver Details</h2>
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
            <div className="w-12 h-12 rounded-xl bg-chalk dark:bg-dark-elevated border border-neutral-200 dark:border-dark-border flex items-center justify-center mb-4">
              <span className="text-graphite dark:text-paper font-bold text-lg">
                {driver.user?.firstName?.[0]}{driver.user?.lastName?.[0]}
              </span>
            </div>
            <h3 className="font-medium text-graphite dark:text-paper mb-1" style={{ fontSize: "1.125rem", letterSpacing: "-0.015em" }}>
              {driver.user?.firstName} {driver.user?.lastName}
            </h3>
            <StatusBadge status={driver.status} />
          </div>

          {/* Info */}
          <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-xl divide-y divide-neutral-200 dark:divide-dark-border">
            {[
              { label: 'Driver ID',      value: driver.id },
              { label: 'Email',          value: driver.user?.email || '—' },
              { label: 'Phone',          value: driver.user?.phone || '—' },
              { label: 'Licence No.',    value: driver.licenseNumber || '—' },
              { label: 'Licence Class',  value: driver.licenseClass || '—' },
              { label: 'Licence Expiry', value: driver.licenseExpiryDate ? fmt(driver.licenseExpiryDate) : '—' },
              { label: 'Ghana Card',     value: driver.ghanaCardNumber || '—' },
              { label: 'Region',         value: driver.region || '—' },
              { label: 'Registered',     value: fmt(driver.createdAt) },
              { label: 'Verified At',    value: driver.verifiedAt ? fmt(driver.verifiedAt) : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between px-4 py-3 gap-4">
                <span className="text-xs text-fog flex-shrink-0">{label}</span>
                <span className="text-xs text-steel dark:text-neutral-300 text-right break-all">{value}</span>
              </div>
            ))}
          </div>

          {/* Status actions */}
          <div>
            <p className="text-xs font-medium text-fog uppercase tracking-widest mb-3">Update Status</p>
            <div className="flex gap-2 flex-wrap">
              {DRIVER_STATUSES.map((s) => (
                <button
                  key={s}
                  disabled={loading || driver.status === s}
                  onClick={() => handleStatus(s)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-40 ${
                    driver.status === s
                      ? 'border-neutral-600 text-neutral-400 cursor-default'
                      : s === 'VERIFIED' || s === 'ACTIVE' ? 'border-success/40 text-success hover:bg-success/10'
                      : s === 'SUSPENDED'  ? 'border-warning/40 text-warning hover:bg-warning/10'
                      : s === 'INACTIVE'   ? 'border-danger/40 text-danger hover:bg-danger/10'
                      : 'border-neutral-200 dark:border-dark-border text-neutral-400 hover:bg-chalk dark:hover:bg-dark-elevated'
                  }`}
                >
                  {loading ? '…' : driver.status === s ? `✓ ${s.replace(/_/g, ' ')}` : s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function AdminDriversPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['ADMIN', 'SUPER_ADMIN'] });
  const [drivers, setDrivers]       = useState([]);
  const [pagination, setPagination] = useState(null);
  const [fetching, setFetching]     = useState(false);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('');
  const [page, setPage]             = useState(1);
  const [selected, setSelected]     = useState(null);
  const [missingProfiles, setMissingProfiles] = useState([]);

  const load = useCallback(() => {
    if (!user) return;
    setFetching(true);
    adminApi
      .listDrivers({ page, limit: 20, search: search || undefined, status: statusFilter || undefined })
      .then((res) => {
        setDrivers(res.data.data.drivers);
        setPagination(res.data.data.pagination);
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user, page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Driver accounts that never completed driver setup have no profile yet —
  // surface them here so they are not mistaken for missing drivers.
  useEffect(() => {
    if (!user) return;
    Promise.all([
      adminApi.listDrivers({ page: 1, limit: 100 }),
      adminApi.listUsers({ role: 'DRIVER', page: 1, limit: 100 }),
    ])
      .then(([dRes, uRes]) => {
        const withProfile = new Set((dRes.data.data.drivers || []).map((d) => d.userId));
        setMissingProfiles((uRes.data.data.users || []).filter((u) => !withProfile.has(u.id)));
      })
      .catch(() => {});
  }, [user, drivers]);

  const [provisioning, setProvisioning] = useState('');
  const provision = async (u) => {
    setProvisioning(u.id);
    try {
      const res = await adminApi.provisionDriver(u.id);
      const driver = res.data.data;
      setMissingProfiles((prev) => prev.filter((x) => x.id !== u.id));
      setDrivers((prev) => [driver, ...prev.filter((d) => d.id !== driver.id)]);
      setSelected(driver);
      load();
    } catch (e) {
      window.alert(e.response?.data?.message || 'Could not create the driver profile.');
    } finally {
      setProvisioning('');
    }
  };

  const handleStatusChange = (updated) => {
    setDrivers((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    setSelected((prev) => prev?.id === updated.id ? updated : prev);
  };

  const COLS = [
    {
      key: 'name', label: 'Name',
      render: (d) => (
        <span className="text-neutral-900 dark:text-graphite dark:text-paper font-medium">
          {d.user?.firstName} {d.user?.lastName}
        </span>
      ),
    },
    {
      key: 'contact', label: 'Contact', hidden: 'hidden sm:table-cell',
      render: (d) => <span className="text-neutral-400 text-xs">{d.user?.email || d.user?.phone || '—'}</span>,
    },
    {
      key: 'licenseNumber', label: 'Licence', hidden: 'hidden md:table-cell',
      render: (d) => <span className="text-neutral-400 text-xs font-mono">{d.licenseNumber || '—'}</span>,
    },
    {
      key: 'status', label: 'Status',
      render: (d) => <StatusBadge status={d.status} />,
    },
    {
      key: 'createdAt', label: 'Registered', hidden: 'hidden lg:table-cell',
      render: (d) => <span className="text-neutral-500 text-xs">{fmt(d.createdAt)}</span>,
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium text-graphite dark:text-paper mb-1" style={{ letterSpacing: "-0.02em" }}>Drivers</h2>
          <p className="text-sm text-steel dark:text-neutral-500">
            {pagination ? `${pagination.total} driver profile${pagination.total !== 1 ? 's' : ''}` : 'Loading…'}
          </p>
        </div>
      </div>

      {missingProfiles.length > 0 && (
        <div className="bg-solar-yellow/10 border border-solar-yellow/30 rounded-card px-5 py-4 mb-5">
          <p className="text-sm font-medium text-graphite dark:text-paper mb-1">
            {missingProfiles.length} driver account{missingProfiles.length !== 1 ? 's' : ''} without a driver profile yet
          </p>
          <p className="text-xs text-steel dark:text-neutral-400 leading-relaxed mb-3">
            These accounts have the Driver role but no driver profile (for example, they registered before driver profiles were created automatically, or have not finished driver setup). Create the profile here so the driver appears in the table below with full details and can be verified. Licence and KYC details still come from the driver in the app.
          </p>
          <div className="space-y-2">
            {missingProfiles.map((u) => (
              <div key={u.id} className="flex items-center gap-3 flex-wrap">
                <p className="text-xs text-steel dark:text-neutral-300 flex-1 min-w-0">
                  <span className="font-medium text-graphite dark:text-paper">{u.firstName} {u.lastName}</span>
                  {' — '}{u.email || u.phone || '—'}{' · '}{(u.status || '').replace(/_/g, ' ')}
                </p>
                <button
                  onClick={() => provision(u)}
                  disabled={provisioning === u.id}
                  className="px-3 py-1.5 rounded-lg border border-success/40 text-success text-xs font-medium hover:bg-success/10 disabled:opacity-40"
                >
                  {provisioning === u.id ? 'Creating…' : 'Create driver profile'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          type="text"
          placeholder="Search name, email, phone or licence…"
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
          {DRIVER_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card overflow-hidden">
        <AdminTable columns={COLS} rows={drivers} loading={fetching} onRowClick={setSelected} />
      </div>
      <AdminPagination pagination={pagination} page={page} setPage={setPage} />

      {selected && (
        <DriverDrawer
          driver={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </>
  );
}
