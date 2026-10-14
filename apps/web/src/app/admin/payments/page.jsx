'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/useAuth';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { StatusBadge } from '@/components/dashboard/DashboardUI';
import { ADMIN_NAV, AdminTable, AdminPagination, fmt } from '@/components/dashboard/AdminHelpers';
import { adminApi } from '@/lib/api';

const PAYMENT_STATUSES = ['INITIATED', 'PENDING', 'PROCESSING', 'SUCCESSFUL', 'FAILED', 'REVERSED', 'REFUNDED'];

function PaymentDrawer({ payment, onClose }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-chalk dark:bg-paper dark:bg-dark-surface border-l border-concrete dark:border-dark-border z-50 flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-concrete dark:border-dark-border">
          <h2 className="text-base font-medium text-graphite dark:text-paper">Payment Details</h2>
          <button onClick={onClose} className="text-fog hover:text-graphite dark:hover:text-paper transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 px-6 py-6 space-y-6">
          {/* Header */}
          <div>
            <p className="text-xs text-neutral-500 font-mono mb-2">{payment.id}</p>
            <StatusBadge status={payment.status} />
          </div>

          {/* Core details */}
          <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-xl divide-y divide-neutral-200 dark:divide-dark-border">
            {[
              { label: 'Amount',           value: `GHS ${Number(payment.amount).toLocaleString()}` },
              { label: 'Currency',         value: payment.currency || 'GHS' },
              { label: 'Payment Method',   value: payment.paymentMethod?.replace(/_/g, ' ') || '—' },
              { label: 'Provider',         value: payment.provider || '—' },
              { label: 'Provider Ref',     value: payment.providerReference || '—' },
              { label: 'Idempotency Key',  value: payment.idempotencyKey || '—' },
              { label: 'Contract ID',      value: payment.contractId || '—' },
              { label: 'Payer',            value: payment.payer ? `${payment.payer.firstName} ${payment.payer.lastName}` : '—' },
              { label: 'Payer Phone',      value: payment.payer?.phone || '—' },
              { label: 'Initiated',        value: fmt(payment.createdAt) },
              { label: 'Confirmed',        value: payment.confirmedAt ? fmt(payment.confirmedAt) : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between px-4 py-3 gap-4">
                <span className="text-xs text-fog flex-shrink-0">{label}</span>
                <span className="text-xs text-steel dark:text-neutral-300 text-right break-all">{value}</span>
              </div>
            ))}
          </div>

          {/* Failure info */}
          {payment.failureReason && (
            <div className="bg-danger/10 border border-danger/20 text-danger text-xs px-4 py-3 rounded-lg">
              <p className="font-medium mb-1">Failure Reason</p>
              <p>{payment.failureReason}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function AdminPaymentsPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['ADMIN', 'SUPER_ADMIN'] });
  const [payments, setPayments]     = useState([]);
  const [pagination, setPagination] = useState(null);
  const [fetching, setFetching]     = useState(false);
  const [statusFilter, setStatus]   = useState('');
  const [page, setPage]             = useState(1);
  const [selected, setSelected]     = useState(null);

  const load = useCallback(() => {
    if (!user) return;
    setFetching(true);
    adminApi
      .listPayments({ page, limit: 20, status: statusFilter || undefined })
      .then((res) => {
        setPayments(res.data.data.payments);
        setPagination(res.data.data.pagination);
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user, page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const COLS = [
    {
      key: 'payer', label: 'Payer',
      render: (p) => (
        <span className="text-graphite dark:text-paper font-medium text-xs">
          {p.payer ? `${p.payer.firstName} ${p.payer.lastName}` : '—'}
        </span>
      ),
    },
    {
      key: 'amount', label: 'Amount',
      render: (p) => (
        <span className="text-white text-xs font-mono">
          GHS {Number(p.amount).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'status', label: 'Status',
      render: (p) => <StatusBadge status={p.status} />,
    },
    {
      key: 'provider', label: 'Provider', hidden: 'hidden sm:table-cell',
      render: (p) => <span className="text-neutral-400 text-xs">{p.provider || '—'}</span>,
    },
    {
      key: 'paymentMethod', label: 'Method', hidden: 'hidden md:table-cell',
      render: (p) => <span className="text-neutral-400 text-xs">{p.paymentMethod?.replace(/_/g, ' ') || '—'}</span>,
    },
    {
      key: 'createdAt', label: 'Date', hidden: 'hidden lg:table-cell',
      render: (p) => <span className="text-neutral-500 text-xs">{fmt(p.createdAt)}</span>,
    },
  ];

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={ADMIN_NAV} title="Payments">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium text-graphite dark:text-paper mb-1" style={{ letterSpacing: "-0.02em" }}>Payments</h2>
          <p className="text-sm text-steel dark:text-neutral-500">
            {pagination ? `${pagination.total} payment record${pagination.total !== 1 ? 's' : ''}` : 'Loading…'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <select
          className="input w-52"
          value={statusFilter}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="">All statuses</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card overflow-hidden">
        <AdminTable columns={COLS} rows={payments} loading={fetching} onRowClick={setSelected} />
      </div>
      <AdminPagination pagination={pagination} page={page} setPage={setPage} />

      {selected && (
        <PaymentDrawer
          payment={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </DashboardShell>
  );
}
