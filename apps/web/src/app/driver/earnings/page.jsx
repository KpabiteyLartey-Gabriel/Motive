'use client';

import { useAuth } from '@/lib/useAuth';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { SectionHeader, EmptyState } from '@/components/dashboard/DashboardUI';

const NAV = [
  { href: '/driver/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { href: '/driver/explore',   icon: 'explore', label: 'Explore' },
  { href: '/driver/vehicle',   icon: 'vehicle', label: 'My Vehicle' },
  { href: '/driver/contracts', icon: 'contract', label: 'Contracts' },
  { href: '/driver/messages',  icon: 'messages', label: 'Messages' },
  { href: '/driver/payments',  icon: 'payments', label: 'Payments' },
  { href: '/driver/earnings',  icon: 'earnings', label: 'Earnings' },
  { href: '/driver/documents', icon: 'documents', label: 'Documents' },
  { href: '/driver/disputes',  icon: 'disputes', label: 'Disputes' },
];

export default function DriverEarningsPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['DRIVER'] });

  if (loading) return <div className="min-h-screen bg-chalk flex items-center justify-center"><div className="text-neutral-500 text-sm">Loading…</div></div>;

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={NAV} title="Earnings">
      <SectionHeader title="Earnings Overview" description="Revenue and earnings summary from your operations" />
      <EmptyState
        icon="📊"
        title="Earnings tracking coming soon"
        description="For Driving On and Rental contracts, daily and weekly earnings summaries will appear here. Record your revenue via the mobile app."
      />

      <div className="mt-8 bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-5">
        <p className="text-sm font-medium text-white mb-2">About Earnings</p>
        <div className="space-y-3 text-xs text-neutral-400 leading-relaxed">
          <p><strong className="text-neutral-200">Work &amp; Pay:</strong> Your earnings contribute to contract installments. Track payment progress in the Contracts section.</p>
          <p><strong className="text-neutral-200">Driving On:</strong> After paying the agreed daily/weekly amount to your owner, the remaining revenue is yours. Record this in the mobile app.</p>
          <p><strong className="text-neutral-200">Rental:</strong> You receive a salary or revenue share as defined in your contract. Payments are settled by your owner or company.</p>
        </div>
      </div>
    </DashboardShell>
  );
}
