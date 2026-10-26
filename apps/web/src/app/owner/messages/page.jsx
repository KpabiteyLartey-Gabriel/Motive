'use client';

import { useAuth } from '@/lib/useAuth';

import ChatWorkspace from '@/components/chat/ChatWorkspace';

export default function OwnerMessages() {
  const { user } = useAuth();
  return (
      <ChatWorkspace user={user} />
  );
}
