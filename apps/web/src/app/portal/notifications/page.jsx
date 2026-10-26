'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import { SectionHeader, EmptyState, fmtDate } from '@/components/dashboard/DashboardUI';

import { notificationsApi } from '@/lib/api';

export default function PortalNotificationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!user) return;
    setFetching(true);
    notificationsApi.list({ limit: 50 })
      .then((r) => setItems(r.data?.data?.notifications || []))
      .catch(() => setError('Could not load notifications. Refresh the page to try again.'))
      .finally(() => setFetching(false));
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const unread = items.filter((n) => !n.readAt).length;

  const markRead = async (n) => {
    if (n.readAt) return;
    try {
      await notificationsApi.markRead(n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
    } catch {}
  };

  const markAll = async () => {
    try {
      await notificationsApi.markAllRead();
      setItems((prev) => prev.map((x) => ({ ...x, readAt: x.readAt || new Date().toISOString() })));
    } catch {}
  };

  return (
    <>
      <SectionHeader
        title="Notifications"
        description={fetching ? 'Loading…' : unread ? `${unread} unread` : 'You are all caught up.'}
        action={unread > 0 ? <button type="button" onClick={markAll} className="btn-secondary">Mark all read</button> : null}
      />
      {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div>}
      {fetching ? (
        <div className="space-y-3">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-16" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon="notifications" title="No notifications" description="Messages and updates about your account will appear here." />
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
            <button key={n.id} type="button" onClick={() => markRead(n)} className={`block w-full rounded-card border p-4 text-left shadow-card dark:shadow-none ${n.readAt ? 'border-line bg-white dark:border-dark-border dark:bg-dark-card' : 'border-brand-200 bg-brand-50/60 dark:border-brand-900 dark:bg-brand-950/40'}`}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-ink dark:text-white">{n.title || 'Notification'}{!n.readAt && <span className="ml-2 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">New</span>}</p>
                <span className="shrink-0 text-xs text-steel dark:text-neutral-500">{n.createdAt ? fmtDate(n.createdAt) : ''}</span>
              </div>
              {n.body && <p className="mt-1 text-sm leading-relaxed text-steel dark:text-neutral-400">{n.body}</p>}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
