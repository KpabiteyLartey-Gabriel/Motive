'use client';

import { useAuth } from '@/lib/useAuth';
import DashboardShell from '@/components/dashboard/DashboardShell';
import ChatWorkspace from '@/components/chat/ChatWorkspace';

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

export default function DriverMessages() {
  const { user } = useAuth();
  return (
    <DashboardShell user={user} navItems={NAV} title="Messages" subtitle="Chat with vehicle owners you are interested in.">
      <ChatWorkspace user={user} />
    </DashboardShell>
  );
}
