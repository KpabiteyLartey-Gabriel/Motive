'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/lib/ThemeProvider';
import { BrandMark } from '@/components/layout/Navbar';

function DashboardSkeleton() {
  return (
    <div className="flex min-h-screen bg-[#F6F8F7] dark:bg-dark-bg" aria-busy="true" aria-label="Loading dashboard">
      <aside className="hidden w-64 shrink-0 border-r border-line bg-white p-4 lg:block dark:border-dark-border dark:bg-dark-surface">
        <div className="skeleton h-9 w-36" />
        <div className="mt-8 space-y-2">{Array(6).fill(null).map((_, i) => <div key={i} className="skeleton h-11" />)}</div>
      </aside>
      <div className="min-w-0 flex-1 p-4 sm:p-6">
        <div className="skeleton h-9 w-52" />
        <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">{Array(4).fill(null).map((_, i) => <div key={i} className="skeleton h-28" />)}</div>
        <div className="skeleton mt-6 h-64" />
      </div>
    </div>
  );
}

function NavList({ navItems, pathname, onNavigate }) {
  return (
    <nav className="space-y-1" aria-label="Dashboard">
      {navItems.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + '/');
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm transition ${
              active
                ? 'bg-brand-600 font-semibold text-white shadow-sm'
                : 'font-medium text-steel hover:bg-mist hover:text-ink dark:text-neutral-300 dark:hover:bg-dark-elevated dark:hover:text-white'
            }`}
          >
            <Icon name={item.icon} size={19} strokeWidth={active ? 2 : 1.7} />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function DashboardShell({ user, loading, logout, navItems, title, children }) {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open ]);

  if (loading) return <DashboardSkeleton />;

  const initials = user ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() : 'GH';
  const roleLabel = user?.primaryRole === 'PENDING' ? 'User' : (user?.primaryRole || '').replace(/_/g, ' ');

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-line px-4 dark:border-dark-border">
        <Link href="/" aria-label="+Motive home"><BrandMark /></Link>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4"><NavList navItems={navItems} pathname={pathname} onNavigate={() => setOpen(false)} /></div>
      <div className="border-t border-line p-3 dark:border-dark-border">
        <div className="flex items-center gap-3 rounded-xl bg-mist p-3 dark:bg-dark-card">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{initials}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink dark:text-white">{user?.firstName} {user?.lastName}</span>
            <span className="block truncate text-xs capitalize text-steel dark:text-neutral-400">{roleLabel.toLowerCase() || user?.email || user?.phone}</span>
          </span>
          <button type="button" onClick={logout} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-steel hover:bg-white hover:text-danger dark:text-neutral-300 dark:hover:bg-dark-elevated" title="Sign out" aria-label="Sign out">
            <Icon name="logout" size={18} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F6F8F7] dark:bg-dark-bg">
      <a href="#dashboard-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white">Skip to content</a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-line bg-white lg:block dark:border-dark-border dark:bg-dark-surface">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[84vw] max-w-80 bg-white shadow-lift dark:bg-dark-surface">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-[#F6F8F7]/95 px-4 backdrop-blur sm:px-6 dark:border-dark-border dark:bg-dark-bg/95">
          <button type="button" onClick={() => setOpen(true)} className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-ink shadow-card lg:hidden dark:bg-dark-card dark:text-white" aria-label="Open menu">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold tracking-tight text-ink sm:text-lg dark:text-white">{title}</h1>
            {roleLabel && <p className="truncate text-xs capitalize text-steel dark:text-neutral-400">{roleLabel.toLowerCase()} workspace</p>}
          </div>
          <button type="button" onClick={toggle} className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-steel shadow-card hover:text-brand-700 dark:bg-dark-card dark:text-neutral-300 dark:hover:text-brand-300" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
            {theme === 'dark' ? (
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            ) : (
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
            )}
          </button>
        </header>
        <main id="dashboard-main" className="mx-auto w-full max-w-[1200px] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
