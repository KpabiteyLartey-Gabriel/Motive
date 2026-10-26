'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import { StatCard, SectionHeader, StatusBadge } from '@/components/dashboard/DashboardUI';
import { AdminTable, AdminPagination, fmt } from '@/components/dashboard/AdminHelpers';
import { adminApi } from '@/lib/api';

const ROLE_BADGE = {
  DRIVER:              { bg: 'bg-graphite/10', text: 'text-graphite dark:text-paper', label: 'Driver' },
  OWNER:               { bg: 'bg-slate-blue/10', text: 'text-slate-blue',  label: 'Owner' },
  COMPANY_ADMIN:       { bg: 'bg-solar-yellow/10', text: 'text-solar-yellow',      label: 'Company Admin' },
  COMPANY_MEMBER:      { bg: 'bg-solar-yellow/10', text: 'text-solar-yellow',      label: 'Company Member' },
  FLEET_MANAGER:       { bg: 'bg-success/10',      text: 'text-success',     label: 'Fleet Manager' },
  SERVICE_PROVIDER:    { bg: 'bg-warning/10',      text: 'text-warning',     label: 'Service Provider' },
  ADMIN:               { bg: 'bg-danger/10',       text: 'text-danger',      label: 'Admin' },
  SUPER_ADMIN:         { bg: 'bg-danger/10',       text: 'text-danger',      label: 'Super Admin' },
};

function RoleBadge({ role }) {
  const s = ROLE_BADGE[role] || { bg: 'bg-chalk dark:bg-neutral-800', text: 'text-steel dark:text-neutral-400', label: role };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-chip text-xs font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

function AnnouncementCard() {
  const [form, setForm] = useState({ subject: '', body: '', role: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const send = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg(''); setError('');
    try {
      const res = await adminApi.announce({ subject: form.subject, body: form.body, role: form.role || undefined });
      setMsg(res.data?.data?.message || 'Announcement sent.');
      setForm({ subject: '', body: '', role: '' });
    } catch (err) {
      setError(Array.isArray(err.response?.data?.message) ? err.response.data.message.join(', ') : err.response?.data?.message || 'Could not send announcement.');
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={send} className="mb-8 bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-5">
      <p className="text-sm font-semibold text-neutral-900 dark:text-white">Send announcement</p>
      <p className="text-xs text-neutral-500 mt-0.5 mb-4">Goes out as a push notification and in-app message. Choose one audience or everyone.</p>
      {msg && <div className="bg-green-500/10 border border-green-500/30 text-green-600 text-sm px-4 py-3 rounded-lg mb-4">{msg}</div>}
      {error && <div className="bg-danger/10 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}
      <div className="grid sm:grid-cols-[1fr_200px] gap-3">
        <input required className="input" placeholder="Title e.g. Scheduled maintenance on Sunday" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="">Everyone</option>
          <option value="OWNER">Vehicle owners</option>
          <option value="DRIVER">Drivers</option>
          <option value="COMPANY_ADMIN">Company admins</option>
          <option value="FLEET_MANAGER">Fleet managers</option>
          <option value="SERVICE_PROVIDER">Maintenance providers</option>
        </select>
      </div>
      <textarea required rows={3} className="input mt-3" placeholder="Message…" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
      <button disabled={busy} className="mt-3 text-xs font-medium px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 disabled:opacity-40">{busy ? 'Sending…' : 'Send announcement'}</button>
    </form>
  );
}

export default function AdminDashboardPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['ADMIN', 'SUPER_ADMIN'] });
  const [stats, setStats]               = useState(null);
  const [users, setUsers]               = useState([]);
  const [pagination, setPagination]     = useState(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [search, setSearch]             = useState('');
  const [roleFilter, setRoleFilter]     = useState('');
  const [page, setPage]                 = useState(1);

  // Load platform stats
  useEffect(() => {
    if (!user) return;
    adminApi.getStats()
      .then((res) => setStats(res.data.data))
      .catch(() => {});
  }, [user]);

  // Load recent users
  useEffect(() => {
    if (!user) return;
    setUsersLoading(true);
    adminApi
      .listUsers({ page, limit: 15, search: search || undefined, role: roleFilter || undefined })
      .then((res) => {
        setUsers(res.data.data.users);
        setPagination(res.data.data.pagination);
      })
      .catch(() => {})
      .finally(() => setUsersLoading(false));
  }, [user, page, search, roleFilter]);

  const COLS = [
    {
      key: 'name', label: 'Name',
      render: (u) => <span className="text-neutral-900 dark:text-graphite dark:text-paper font-medium">{u.firstName} {u.lastName}</span>,
    },
    {
      key: 'contact', label: 'Contact', hidden: 'hidden sm:table-cell',
      render: (u) => <span className="text-neutral-400 text-xs">{u.email || u.phone || '—'}</span>,
    },
    {
      key: 'primaryRole', label: 'Role',
      render: (u) => <RoleBadge role={u.primaryRole} />,
    },
    {
      key: 'status', label: 'Status',
      render: (u) => <StatusBadge status={u.status} />,
    },
    {
      key: 'createdAt', label: 'Joined', hidden: 'hidden md:table-cell',
      render: (u) => <span className="text-neutral-500 text-xs">{fmt(u.createdAt)}</span>,
    },
  ];

  return (
    <>
      {/* Welcome */}
      <div className="mb-8">
        <h2 className="text-xl font-medium text-graphite dark:text-paper mb-1" style={{ letterSpacing: "-0.02em" }}>+Motive Administration</h2>
        <p className="text-sm text-steel dark:text-neutral-500">
          Platform overview — users, accounts, vehicles and operations.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <StatCard label="Total Users"      value={stats?.totalUsers       ?? '—'} sub="All accounts" />
        <StatCard label="Drivers"          value={stats?.totalDrivers     ?? '—'} sub="Registered" />
        <StatCard label="Vehicles"         value={stats?.totalVehicles    ?? '—'} sub="On platform" />
        <StatCard label="Active Contracts" value={stats?.activeContracts  ?? '—'} sub="Running" accent />
      </div>

      {/* Pending verification alert */}
      {stats?.pendingVerification?.total > 0 && (
        <div className="mb-8 bg-warning/10 border border-warning/20 rounded-xl px-5 py-4 flex items-start gap-3">
          <span className="text-warning text-base mt-0.5">⚠</span>
          <div>
            <p className="text-sm font-semibold text-warning">
              {stats.pendingVerification.total} pending verification{stats.pendingVerification.total !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">
              {stats.pendingVerification.drivers > 0 && `${stats.pendingVerification.drivers} driver${stats.pendingVerification.drivers !== 1 ? 's' : ''} · `}
              {stats.pendingVerification.owners > 0 && `${stats.pendingVerification.owners} owner${stats.pendingVerification.owners !== 1 ? 's' : ''} · `}
              {stats.pendingVerification.vehicles > 0 && `${stats.pendingVerification.vehicles} vehicle${stats.pendingVerification.vehicles !== 1 ? 's' : ''} · `}
              {stats.pendingVerification.companies > 0 && `${stats.pendingVerification.companies} compan${stats.pendingVerification.companies !== 1 ? 'ies' : 'y'}`}
            </p>
          </div>
        </div>
      )}

      {/* Announcement composer */}
      <AnnouncementCard />

      {/* Users table */}
      <SectionHeader title="All Users" description="Every registered account on the platform" />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search name, email or phone…"
          className="input flex-1"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className="input w-48"
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
        >
          <option value="">All roles</option>
          <option value="DRIVER">Driver</option>
          <option value="OWNER">Owner</option>
          <option value="COMPANY_ADMIN">Company Admin</option>
          <option value="FLEET_MANAGER">Fleet Manager</option>
          <option value="SERVICE_PROVIDER">Service Provider</option>
          <option value="ADMIN">Admin</option>
          <option value="SUPER_ADMIN">Super Admin</option>
        </select>
      </div>

      <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card overflow-hidden">
        <AdminTable columns={COLS} rows={users} loading={usersLoading} />
      </div>
      <AdminPagination pagination={pagination} page={page} setPage={setPage} />
    </>
  );
}
