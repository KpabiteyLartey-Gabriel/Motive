'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';

import { SectionHeader, EmptyState, StatusBadge } from '@/components/dashboard/DashboardUI';
import { paymentsApi } from '@/lib/api';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtGHS(n) {
  if (n == null) return '—';
  return `GHS ${Number(n).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_DOT = {
  SUCCESSFUL: 'bg-green-500',
  PENDING: 'bg-yellow-500',
  FAILED: 'bg-red-500',
  REVERSED: 'bg-neutral-500',
  INITIATED: 'bg-blue-500',
};

export default function OwnerPaymentsPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['OWNER'] });
  const [payments, setPayments]   = useState([]);
  const [fetching, setFetching]   = useState(true);
  const [totals, setTotals]       = useState({ received: 0, pending: 0 });

  useEffect(() => {
    if (!user) return;
    paymentsApi.list({ limit: 100 })
      .then((r) => {
        const list = r.data?.data?.payments || [];
        setPayments(list);
        const received = list.filter((p) => p.status === 'SUCCESSFUL').reduce((s, p) => s + Number(p.amount || 0), 0);
        const pending  = list.filter((p) => ['PENDING', 'INITIATED'].includes(p.status)).reduce((s, p) => s + Number(p.amount || 0), 0);
        setTotals({ received, pending });
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user]);

  if (loading) return <div className="min-h-screen bg-chalk flex items-center justify-center"><div className="text-neutral-500 text-sm">Loading…</div></div>;

  return (
    <>
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-4">
          <p className="text-xs text-neutral-500 mb-1">Total Received</p>
          <p className="text-xl font-bold text-green-400">{fmtGHS(totals.received)}</p>
        </div>
        <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-4">
          <p className="text-xs text-neutral-500 mb-1">Pending</p>
          <p className="text-xl font-bold text-yellow-400">{fmtGHS(totals.pending)}</p>
        </div>
      </div>

      <SectionHeader title="Payment History" description="All payment transactions linked to your contracts" />

      {fetching ? (
        <div className="text-neutral-500 text-sm py-8 text-center">Loading payments…</div>
      ) : payments.length === 0 ? (
        <EmptyState icon="💳" title="No payments yet" description="Payment transactions will appear here once drivers begin making payments under your contracts." />
      ) : (
        <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-dark-border text-left">
                <th className="px-4 py-3 text-xs text-neutral-500 font-medium">Date</th>
                <th className="px-4 py-3 text-xs text-neutral-500 font-medium">Amount</th>
                <th className="px-4 py-3 text-xs text-neutral-500 font-medium">Method</th>
                <th className="px-4 py-3 text-xs text-neutral-500 font-medium">Reference</th>
                <th className="px-4 py-3 text-xs text-neutral-500 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => (
                <tr key={p.id} className={`${i !== payments.length - 1 ? 'border-b border-neutral-200 dark:border-dark-border' : ''}`}>
                  <td className="px-4 py-3 text-neutral-400">{fmtDate(p.createdAt)}</td>
                  <td className="px-4 py-3 text-white font-semibold">{fmtGHS(p.amount)}</td>
                  <td className="px-4 py-3 text-neutral-400">{p.method || '—'}</td>
                  <td className="px-4 py-3 text-neutral-400 font-mono text-xs">{p.providerReference || p.id?.slice(0, 8) || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[p.status] || 'bg-neutral-500'}`} />
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
