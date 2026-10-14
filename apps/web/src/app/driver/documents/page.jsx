'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { SectionHeader, EmptyState } from '@/components/dashboard/DashboardUI';
import { complianceApi } from '@/lib/api';

const NAV = [
  { href: '/driver/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { href: '/driver/vehicle',   icon: 'vehicle', label: 'My Vehicle' },
  { href: '/driver/contracts', icon: 'contract', label: 'Contracts' },
  { href: '/driver/payments',  icon: 'payments', label: 'Payments' },
  { href: '/driver/earnings',  icon: 'earnings', label: 'Earnings' },
  { href: '/driver/documents', icon: 'documents', label: 'Documents' },
  { href: '/driver/disputes',  icon: 'disputes', label: 'Disputes' },
];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const COMPLIANCE_STATUS_COLORS = {
  VALID: 'text-green-400',
  EXPIRING_SOON: 'text-yellow-400',
  EXPIRED: 'text-red-400',
  PENDING_RENEWAL: 'text-orange-400',
};

export default function DriverDocumentsPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['DRIVER'] });
  const [records, setRecords]     = useState([]);
  const [fetching, setFetching]   = useState(true);

  useEffect(() => {
    if (!user) return;
    complianceApi.list({ limit: 50 })
      .then((r) => setRecords(r.data?.data?.records || []))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user]);

  if (loading) return <div className="min-h-screen bg-chalk flex items-center justify-center"><div className="text-neutral-500 text-sm">Loading…</div></div>;

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={NAV} title="Documents">
      <SectionHeader title="Compliance &amp; Documents" description="Your licence, insurance and roadworthiness status" />

      {fetching ? (
        <div className="text-neutral-500 text-sm py-8 text-center">Loading documents…</div>
      ) : records.length === 0 ? (
        <EmptyState icon="🗂" title="No documents yet" description="Vehicle compliance documents (insurance, roadworthiness, licence) will appear here once linked to your assignments." />
      ) : (
        <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-dark-border text-left">
                <th className="px-4 py-3 text-xs text-neutral-500 font-medium">Document Type</th>
                <th className="px-4 py-3 text-xs text-neutral-500 font-medium">Issue Date</th>
                <th className="px-4 py-3 text-xs text-neutral-500 font-medium">Expiry Date</th>
                <th className="px-4 py-3 text-xs text-neutral-500 font-medium">Notes</th>
                <th className="px-4 py-3 text-xs text-neutral-500 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={r.id} className={i !== records.length - 1 ? 'border-b border-neutral-200 dark:border-dark-border' : ''}>
                  <td className="px-4 py-3 text-white font-medium">{r.documentType?.replace(/_/g, ' ') || '—'}</td>
                  <td className="px-4 py-3 text-neutral-400">{fmtDate(r.issueDate)}</td>
                  <td className="px-4 py-3 text-neutral-400">{fmtDate(r.expiryDate)}</td>
                  <td className="px-4 py-3 text-neutral-400">{r.notes || '—'}</td>
                  <td className={`px-4 py-3 text-xs font-semibold ${COMPLIANCE_STATUS_COLORS[r.status] || 'text-neutral-400'}`}>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardShell>
  );
}
