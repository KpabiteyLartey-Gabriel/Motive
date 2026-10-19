'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/useAuth';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { StatusBadge } from '@/components/dashboard/DashboardUI';
import { ADMIN_NAV, fmt } from '@/components/dashboard/AdminHelpers';
import { adminApi } from '@/lib/api';

const ROLE_META = {
  DRIVER:             { label: 'Driver',           bg: 'bg-graphite/10', text: 'text-graphite dark:text-paper' },
  OWNER:              { label: 'Owner',             bg: 'bg-slate-blue/10', text: 'text-slate-blue' },
  COMPANY_ADMIN:      { label: 'Company Admin',     bg: 'bg-solar-yellow/10', text: 'text-solar-yellow' },
  COMPANY_MEMBER:     { label: 'Company Member',    bg: 'bg-solar-yellow/10', text: 'text-solar-yellow' },
  FLEET_MANAGER:      { label: 'Fleet Manager',     bg: 'bg-success/10',     text: 'text-success' },
  SERVICE_PROVIDER:   { label: 'Service Provider',  bg: 'bg-warning/10',     text: 'text-warning' },
  LEGAL_PROFESSIONAL: { label: 'Legal',             bg: 'bg-neutral-800',    text: 'text-neutral-400' },
  ADMIN:              { label: 'Admin',             bg: 'bg-danger/10',      text: 'text-danger' },
  SUPER_ADMIN:        { label: 'Super Admin',       bg: 'bg-danger/10',      text: 'text-danger' },
};

function RoleBadge({ role }) {
  const m = ROLE_META[role] || { label: role, bg: 'bg-chalk dark:bg-neutral-800', text: 'text-steel dark:text-neutral-400' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-chip text-xs font-medium ${m.bg} ${m.text}`}>
      {m.label}
    </span>
  );
}

// ── User Detail Drawer ─────────────────────────────────────────
const TEST_PASSWORD = 'Test@12345';

function UserDrawer({ user, onClose, onStatusChange, onRoleChange, isSuperAdmin }) {
  const [statusLoading, setStatusLoading] = useState(false);
  const [roleLoading, setRoleLoading]     = useState(false);
  const [selectedRole, setSelectedRole]   = useState(user.primaryRole);
  const [error, setError] = useState('');
  const [testPassword, setTestPassword]   = useState(TEST_PASSWORD);
  const [resetLoading, setResetLoading]   = useState(false);
  const [resetDone, setResetDone]         = useState('');

  const handleResetPassword = async () => {
    if (!testPassword || testPassword.length < 8) { setError('Test password must be at least 8 characters.'); return; }
    setResetLoading(true);
    setError('');
    setResetDone('');
    try {
      await adminApi.resetPassword(user.id, testPassword);
      setResetDone(`You can now sign in as ${user.email || user.phone} with password: ${testPassword}`);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to reset password.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleStatus = async (status) => {
    setStatusLoading(true);
    setError('');
    try {
      const res = await adminApi.updateStatus(user.id, status);
      onStatusChange(res.data.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update status.');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleRoleChange = async () => {
    if (selectedRole === user.primaryRole) return;
    setRoleLoading(true);
    setError('');
    try {
      const res = await adminApi.updateRole(user.id, selectedRole);
      onRoleChange(res.data.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update role.');
    } finally {
      setRoleLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-chalk dark:bg-paper dark:bg-dark-surface border-l border-concrete dark:border-dark-border z-50 flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-concrete dark:border-dark-border">
          <h2 className="text-base font-medium text-graphite dark:text-paper">User Details</h2>
          <button onClick={onClose} className="text-fog hover:text-graphite dark:hover:text-paper transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 px-6 py-6 space-y-6">
          {error && (
            <div className="bg-danger/10 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Identity */}
          <div>
            <div className="w-12 h-12 rounded-xl bg-chalk dark:bg-dark-elevated border border-neutral-200 dark:border-dark-border flex items-center justify-center mb-4">
              <span className="text-graphite dark:text-paper font-bold text-lg">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </span>
            </div>
            <h3 className="font-medium text-graphite dark:text-paper mb-1" style={{ fontSize: "1.125rem", letterSpacing: "-0.015em" }}>
              {user.firstName} {user.lastName}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <RoleBadge role={user.primaryRole} />
              <StatusBadge status={user.status} />
            </div>
          </div>

          {/* Contact */}
          <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-xl divide-y divide-neutral-200 dark:divide-dark-border">
            {[
              { label: 'Email',   value: user.email || '—' },
              { label: 'Phone',   value: user.phone || '—' },
              { label: 'User ID', value: user.id },
              { label: 'Joined',  value: fmt(user.createdAt) },
              { label: 'Last Login', value: user.lastLoginAt ? fmt(user.lastLoginAt) : 'Never' },
              { label: 'Email Verified', value: user.emailVerifiedAt ? fmt(user.emailVerifiedAt) : 'No' },
              { label: 'Phone Verified', value: user.phoneVerifiedAt ? fmt(user.phoneVerifiedAt) : 'No' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between px-4 py-3 gap-4">
                <span className="text-xs text-fog flex-shrink-0">{label}</span>
                <span className="text-xs text-steel dark:text-neutral-300 text-right break-all">{value}</span>
              </div>
            ))}
          </div>

          {/* Status actions */}
          <div>
            <p className="text-xs font-medium text-fog uppercase tracking-widest mb-3">Account Status</p>
            <div className="flex gap-2 flex-wrap">
              {['ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'PENDING_VERIFICATION'].map((s) => (
                <button
                  key={s}
                  disabled={statusLoading || user.status === s}
                  onClick={() => handleStatus(s)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-40 ${
                    user.status === s
                      ? 'border-neutral-600 text-neutral-400 cursor-default'
                      : s === 'ACTIVE'      ? 'border-success/40 text-success hover:bg-success/10'
                      : s === 'SUSPENDED'   ? 'border-warning/40 text-warning hover:bg-warning/10'
                      : s === 'DEACTIVATED' ? 'border-danger/40  text-danger  hover:bg-danger/10'
                      : 'border-neutral-200 dark:border-dark-border text-neutral-400 hover:bg-chalk dark:hover:bg-dark-elevated'
                  }`}
                >
                  {statusLoading ? '…' : s === user.status ? `✓ ${s.replace('_', ' ')}` : s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Password — testing only (passwords are encrypted and cannot be viewed) */}
          <div>
            <p className="text-xs font-medium text-fog uppercase tracking-widest mb-3">Password (Testing)</p>
            <p className="text-xs text-steel dark:text-neutral-400 mb-3">
              Passwords are encrypted, so they cannot be shown. For testing, reset this account to a password you know, then sign in with it.
            </p>
            <div className="flex gap-2">
              <input
                className="input flex-1 text-sm"
                value={testPassword}
                onChange={(e) => setTestPassword(e.target.value)}
                placeholder="New test password"
              />
              <button
                onClick={handleResetPassword}
                disabled={resetLoading}
                className="btn-graphite text-sm disabled:opacity-40 whitespace-nowrap"
              >
                {resetLoading ? '…' : 'Reset password'}
              </button>
            </div>
            {resetDone && (
              <div className="mt-3 bg-success/10 border border-success/20 text-success text-xs px-4 py-3 rounded-lg break-all">
                {resetDone}
              </div>
            )}
          </div>

          {/* Role change — Super Admin only */}
          {isSuperAdmin && (
            <div>
              <p className="text-xs font-medium text-fog uppercase tracking-widest mb-3">Change Role</p>
              <div className="flex gap-2">
                <select
                  className="input flex-1 text-sm"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                >
                  {Object.entries(ROLE_META).map(([val, meta]) => (
                    <option key={val} value={val}>{meta.label}</option>
                  ))}
                </select>
                <button
                  onClick={handleRoleChange}
                  disabled={roleLoading || selectedRole === user.primaryRole}
                  className="btn-graphite text-sm disabled:opacity-40"
                >
                  {roleLoading ? '…' : 'Apply'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function AdminUsersPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['ADMIN', 'SUPER_ADMIN'] });
  const isSuperAdmin = user?.primaryRole === 'SUPER_ADMIN';

  const [users, setUsers]           = useState([]);
  const [pagination, setPagination] = useState(null);
  const [fetching, setFetching]     = useState(false);
  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage]             = useState(1);
  const [selected, setSelected]     = useState(null); // drawer

  const load = useCallback(() => {
    if (!user) return;
    setFetching(true);
    adminApi
      .listUsers({
        page,
        limit: 20,
        search: search || undefined,
        role:   roleFilter   || undefined,
        status: statusFilter || undefined,
      })
      .then((res) => {
        setUsers(res.data.data.users);
        setPagination(res.data.data.pagination);
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user, page, search, roleFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = (updated) => {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
    setSelected((prev) => prev && prev.id === updated.id ? { ...prev, ...updated } : prev);
  };

  const handleRoleChange = (updated) => {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
    setSelected((prev) => prev && prev.id === updated.id ? { ...prev, ...updated } : prev);
  };

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={ADMIN_NAV} title="Users">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium text-graphite dark:text-paper mb-1" style={{ letterSpacing: "-0.02em" }}>All Users</h2>
          <p className="text-sm text-steel dark:text-neutral-500">
            {pagination ? `${pagination.total} total accounts` : 'Loading…'}
          </p>
        </div>
      </div>

      {/* Testing logins */}
      <div className="bg-solar-yellow/10 border border-solar-yellow/30 rounded-card px-5 py-4 mb-5">
        <p className="text-sm font-medium text-graphite dark:text-paper mb-1">Testing logins</p>
        <p className="text-xs text-steel dark:text-neutral-400 leading-relaxed">
          Passwords are encrypted and cannot be displayed for any account. Seeded Super Admin: <span className="font-mono">admin@ghmotive.com</span> / <span className="font-mono">Admin@GHMotive2024!</span>.
          For every other account, click the user, then use <strong>Password (Testing) → Reset password</strong> to set <span className="font-mono">{TEST_PASSWORD}</span> and sign in with it.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          type="text"
          placeholder="Search name, email or phone…"
          className="input flex-1"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select className="input w-44" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
          <option value="">All roles</option>
          {Object.entries(ROLE_META).map(([val, m]) => (
            <option key={val} value={val}>{m.label}</option>
          ))}
        </select>
        <select className="input w-44" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING_VERIFICATION">Pending Verification</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="DEACTIVATED">Deactivated</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card overflow-hidden">
        {fetching ? (
          <div className="py-16 text-center text-sm text-neutral-500">Loading users…</div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-sm text-neutral-500">No users found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-dark-border bg-chalk dark:bg-dark-elevated">
                <th className="px-4 py-3 text-left text-xs font-medium text-fog uppercase tracking-widest">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-fog uppercase tracking-widest hidden sm:table-cell">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-fog uppercase tracking-widest">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-fog uppercase tracking-widest">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-fog uppercase tracking-widest hidden md:table-cell">Joined</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-dark-border">
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="hover:bg-chalk dark:hover:bg-dark-elevated transition-colors cursor-pointer"
                  onClick={() => setSelected(u)}
                >
                  <td className="px-4 py-3 text-graphite dark:text-paper font-medium">
                    {u.firstName} {u.lastName}
                  </td>
                  <td className="px-4 py-3 text-neutral-400 text-xs hidden sm:table-cell">
                    {u.email || u.phone || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={u.primaryRole} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="px-4 py-3 text-neutral-500 text-xs hidden md:table-cell">
                    {fmt(u.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-neutral-600 hover:text-white text-xs transition-colors">View →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-neutral-500">
          <span>
            Showing {(pagination.page - 1) * pagination.limit + 1}–
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-dark-border text-neutral-400 hover:text-white disabled:opacity-40 transition-colors"
            >
              ← Prev
            </button>
            <span className="px-2">{page} / {pagination.totalPages}</span>
            <button
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-dark-border text-neutral-400 hover:text-white disabled:opacity-40 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Drawer */}
      {selected && (
        <UserDrawer
          user={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
          onRoleChange={handleRoleChange}
          isSuperAdmin={isSuperAdmin}
        />
      )}
    </DashboardShell>
  );
}
