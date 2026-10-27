'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { notificationsApi } from '@/lib/api';

// Header bell: notifications live here now, not as a sidebar tab.
// Shows the unread count and opens the full notifications page.
export default function NotificationBell({ href = '/portal/notifications' }) {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let live = true;
    notificationsApi.list({ limit: 50 })
      .then((r) => {
        if (!live) return;
        const items = r.data?.data?.notifications || [];
        setUnread(items.filter((n) => !n.readAt).length);
      })
      .catch(() => {});
    return () => { live = false; };
  }, [pathname]);

  const active = pathname === href;

  return (
    <Link
      href={href}
      aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
      title="Notifications"
      className={`relative flex h-11 w-11 items-center justify-center rounded-xl shadow-card transition ${
        active
          ? 'bg-brand-600 text-white'
          : 'bg-white text-steel hover:text-brand-700 dark:bg-dark-card dark:text-neutral-300 dark:hover:text-brand-300'
      }`}
    >
      <Icon name="notifications" size={19} strokeWidth={1.7} />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white" aria-hidden="true">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
}
