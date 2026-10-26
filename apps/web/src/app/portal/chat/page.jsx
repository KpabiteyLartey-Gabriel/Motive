'use client';

import { useAuth } from '@/lib/useAuth';
import ChatWorkspace from '@/components/chat/ChatWorkspace';

export default function PortalChatPage() {
  const { user } = useAuth();
  return (
      <ChatWorkspace
        user={user}
        emptyText="No conversations yet. Conversations you start will appear here."
      />
  );
}
