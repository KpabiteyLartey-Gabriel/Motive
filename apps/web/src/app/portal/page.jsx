'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { StatCard, SectionHeader, StatusBadge, fmtDate, EmptyState } from '@/components/dashboard/DashboardUI';

import { notificationsApi, accountsApi } from '@/lib/api';

const ACCOUNT_LABELS = { DRIVER: 'Driver', OWNER: 'Owner', SERVICE_PROVIDER: 'Service Provider', COMPANY: 'Company' };

// The general User portal — same shell and layout as the Admin portal.
// Verified Driver/Owner/Company accounts surface here with their dashboards.
export default function PortalDashboardPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!user) return;
    notificationsApi.list({ limit: 50 })
      .then((r) => setNotifications(r.data?.data?.notifications || []))
      .catch(() => {})
      .finally(() => setFetching(false));
    accountsApi.me()
      .then((r) => setAccounts((r.data?.data || r.data)?.accounts || []))
      .catch(() => {});
  }, [user]);

  const openable = accounts.filter((a) => a.status === 'VERIFIED' || a.status === 'ACTIVE');
  const accountSummary = openable.length
    ? openable.map((a) => ACCOUNT_LABELS[a.kind] || a.kind).join(' + ')
    : 'User';

  const unread = notifications.filter((n) => !n.readAt).length;
  const recent = notifications.slice(0, 5);

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight text-ink dark:text-white">Welcome, {user?.firstName || 'User'}</h2>
        <p className="mt-0.5 text-sm text-steel dark:text-neutral-400">Your +Motive account at a glance.</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Account type" value={accountSummary} sub={openable.length ? 'Verified — open your dashboard below' : 'Your portal account'} icon="profile" href="/portal/account" />
        <StatCard label="Explore" value="Vehicles" sub="Browse published vehicles" icon="explore" href="/portal/explore" />
        <StatCard label="Chat" value="Inbox" sub="Talk with vehicle owners" icon="messages" href="/portal/chat" />
        <StatCard label="Notifications" value={fetching ? '—' : String(unread)} sub={unread === 1 ? 'Unread message' : 'Unread messages'} icon="notifications" href="/portal/notifications" />
      </div>

      {openable.length > 0 && (
        <section className="mb-6">
          <SectionHeader title="Your accounts" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {openable.map((a) => (
              <Link key={a.kind} href={a.dashboardPath} className="rounded-card border border-brand-200 bg-brand-50/60 p-5 shadow-card transition hover:border-brand-400 dark:border-brand-900 dark:bg-brand-950/40 dark:shadow-none">
                <p className="text-sm font-semibold text-ink dark:text-white">{ACCOUNT_LABELS[a.kind] || a.kind} account</p>
                <p className="mt-1 text-xs text-steel dark:text-neutral-400">{a.status === 'ACTIVE' ? 'Active' : 'Verified'}</p>
                <p className="mt-3 text-sm font-semibold text-brand-700 dark:text-brand-300">Open dashboard →</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="rounded-card border border-line bg-white p-5 shadow-card dark:border-dark-border dark:bg-dark-card dark:shadow-none lg:col-span-2">
          <SectionHeader title="Your account" />
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4"><dt className="text-steel dark:text-neutral-400">Name</dt><dd className="font-semibold text-ink dark:text-white">{`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || '—'}</dd></div>
            <div className="flex items-center justify-between gap-4"><dt className="text-steel dark:text-neutral-400">Email</dt><dd className="font-semibold text-ink dark:text-white">{user?.email || '—'}</dd></div>
            <div className="flex items-center justify-between gap-4"><dt className="text-steel dark:text-neutral-400">Phone</dt><dd className="font-semibold text-ink dark:text-white">{user?.phone || '—'}</dd></div>
            <div className="flex items-center justify-between gap-4"><dt className="text-steel dark:text-neutral-400">Email verified</dt><dd><StatusBadge status={user?.emailVerifiedAt ? 'VERIFIED' : 'PENDING'} /></dd></div>
            <div className="flex items-center justify-between gap-4"><dt className="text-steel dark:text-neutral-400">Member since</dt><dd className="font-semibold text-ink dark:text-white">{user?.createdAt ? fmtDate(user.createdAt) : '—'}</dd></div>
            <div className="flex items-center justify-between gap-4"><dt className="text-steel dark:text-neutral-400">Last sign-in</dt><dd className="font-semibold text-ink dark:text-white">{user?.lastLoginAt ? fmtDate(user.lastLoginAt) : '—'}</dd></div>
          </dl>
          <Link href="/portal/account" className="btn-primary mt-5 w-full">My Account</Link>
        </section>

        <section className="lg:col-span-3">
          <SectionHeader title="Recent activity" action={<Link href="/portal/notifications" className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">View all</Link>} />
          {fetching ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-16" />)}</div>
          ) : recent.length === 0 ? (
            <EmptyState icon="notifications" title="No activity yet" description="Messages and updates about your account will appear here." />
          ) : (
            <div className="space-y-3">
              {recent.map((n) => (
                <div key={n.id} className={`rounded-card border p-4 shadow-card dark:shadow-none ${n.readAt ? 'border-line bg-white dark:border-dark-border dark:bg-dark-card' : 'border-brand-200 bg-brand-50/60 dark:border-brand-900 dark:bg-brand-950/40'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-ink dark:text-white">{n.title || 'Notification'}</p>
                    <span className="shrink-0 text-xs text-steel dark:text-neutral-500">{n.createdAt ? fmtDate(n.createdAt) : ''}</span>
                  </div>
                  {n.body && <p className="mt-1 text-sm leading-relaxed text-steel dark:text-neutral-400">{n.body}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
