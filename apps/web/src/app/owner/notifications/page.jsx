'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/useAuth';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { OWNER_NAV } from '@/lib/ownerNav';
import { SectionHeader, EmptyState } from '@/components/dashboard/DashboardUI';
import { Icon } from '@/components/ui/Icon';
import { notificationsApi } from '@/lib/api';

const FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'UNREAD', label: 'Unread' },
  { key: 'PAYMENTS', label: 'Payments' },
  { key: 'ANNOUNCEMENTS', label: 'Announcements' },
  { key: 'ACCOUNT', label: 'Account' },
];

function categoryOf(n) {
  if (n.type?.startsWith('PAYMENT')) return 'PAYMENTS';
  if (n.type === 'ADMIN_ANNOUNCEMENT') return 'ANNOUNCEMENTS';
  return 'ACCOUNT';
}

function iconOf(n) {
  if (n.type?.startsWith('PAYMENT')) return 'payments';
  if (n.type === 'ADMIN_ANNOUNCEMENT') return 'notifications';
  if (n.type?.includes('PASSWORD') || n.type?.includes('WELCOME')) return 'settings';
  return 'contract';
}

function timeAgo(d) {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function OwnerNotificationsPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['OWNER'] });
  const [items, setItems] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!user) return;
    notificationsApi.list({ limit: 50 })
      .then((r) => setItems(r.data?.data?.notifications || []))
      .catch(() => setError('Could not load notifications. Pull to retry by refreshing the page.'))
      .finally(() => setFetching(false));
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const unread = items.filter((n) => !n.readAt).length;

  const markRead = async (n) => {
    if (n.readAt) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString(), status: 'READ' } : x)));
    try { await notificationsApi.markRead(n.id); } catch { load(); }
  };

  const markAllRead = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, readAt: x.readAt || new Date().toISOString(), status: 'READ' })));
    try { await notificationsApi.markAllRead(); } catch { load(); }
  };

  const visible = items.filter((n) => {
    if (filter === 'ALL') return true;
    if (filter === 'UNREAD') return !n.readAt;
    return categoryOf(n) === filter;
  });

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={OWNER_NAV} title="Notifications">
      <SectionHeader
        title="Notifications"
        description={unread ? `You have ${unread} unread notification${unread === 1 ? '' : 's'}` : 'Payments received, announcements from +Motive and account updates'}
      />
      {error && <div className="bg-danger/10 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}

      <div className="flex flex-wrap items-center gap-2 mb-5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-xs font-medium px-3.5 py-2 rounded-full border transition-colors ${filter === f.key ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900' : 'border-neutral-300 dark:border-dark-border text-neutral-600 dark:text-neutral-300'}`}
          >
            {f.label}{f.key === 'UNREAD' && unread ? ` (${unread})` : ''}
          </button>
        ))}
        {unread > 0 && (
          <button onClick={markAllRead} className="ml-auto text-xs font-semibold text-brand-700 dark:text-brand-300 hover:underline">
            Mark all as read
          </button>
        )}
      </div>

      {fetching ? (
        <div className="text-sm text-neutral-500 py-10 text-center">Loading notifications…</div>
      ) : visible.length === 0 ? (
        <EmptyState
          title={filter === 'UNREAD' ? 'All caught up' : 'No notifications yet'}
          description={filter === 'UNREAD' ? 'You have read everything. New payments and announcements will appear here.' : 'When you receive a payment, an announcement or an account update, it will appear here and as a push notification on your phone.'}
        />
      ) : (
        <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card divide-y divide-neutral-200 dark:divide-dark-border overflow-hidden">
          {visible.map((n) => (
            <button key={n.id} onClick={() => markRead(n)} className="w-full flex gap-3.5 px-4 py-4 text-left hover:bg-neutral-100 dark:hover:bg-dark-elevated transition-colors">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${n.readAt ? 'bg-neutral-200/70 text-neutral-500 dark:bg-dark-border' : 'bg-brand-600/10 text-brand-700 dark:text-brand-300'}`}>
                <Icon name={iconOf(n)} size={19} />
              </span>
              <span className="flex-1 min-w-0">
                <span className={`block text-sm ${n.readAt ? 'font-medium text-neutral-700 dark:text-neutral-300' : 'font-semibold text-neutral-900 dark:text-white'}`}>
                  {n.subject || n.type?.replace(/_/g, ' ')}
                </span>
                <span className="block text-sm text-neutral-500 leading-relaxed mt-0.5">{n.body}</span>
                <span className="block text-xs text-neutral-400 mt-1.5">{timeAgo(n.createdAt)} · {n.channel === 'PUSH' ? 'Push' : n.channel === 'EMAIL' ? 'Email' : n.channel === 'SMS' ? 'SMS' : 'In-app'}</span>
              </span>
              {!n.readAt && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />}
            </button>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
