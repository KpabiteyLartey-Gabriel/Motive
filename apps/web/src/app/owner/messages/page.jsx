'use client';

import { useAuth } from '@/lib/useAuth';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { OWNER_NAV } from '@/lib/ownerNav';
import ChatWorkspace from '@/components/chat/ChatWorkspace';

export default function OwnerMessages() {
  const { user } = useAuth();
  return (
    <DashboardShell user={user} navItems={OWNER_NAV} title="Messages" subtitle="Chat with drivers who showed interest in your vehicles.">
      <ChatWorkspace user={user} />
    </DashboardShell>
  );
}
