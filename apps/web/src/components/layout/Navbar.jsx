'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navLinks = [
  { label: 'How It Works', href: '/how-it-works' },
  { label: 'For Drivers', href: '/drivers' },
  { label: 'For Owners', href: '/owners' },
  { label: 'For Companies', href: '/companies' },
  { label: 'All Participants', href: '/how-it-works#participants' },
  { label: 'About', href: '/about' },
];

export function BrandMark({ dark = false }) {
  return (
    <span className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/motive-logo.png" alt="+Motive logo" width={36} height={36} className="h-9 w-9 rounded-[10px] shadow-sm" />
      <span className={`text-[15px] font-semibold tracking-tight ${dark ? 'text-white' : 'text-ink dark:text-white'}`}>
        +Motive
      </span>
    </span>
  );
}

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // Scroll-reveal: fade landing sections up as they enter the viewport.
  useEffect(() => {
    const els = [...document.querySelectorAll('[data-reveal]:not(.is-visible)')];
    if (!els.length) return undefined;
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'));
      return undefined;
    }
    document.documentElement.classList.add('reveal-ready');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white/95 backdrop-blur dark:border-dark-border dark:bg-dark-surface/95">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white">
        Skip to content
      </a>
      <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="shrink-0 rounded-lg" aria-label="+Motive home">
            <BrandMark />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
            {navLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`btn-pill ${active ? 'bg-brand-50 font-semibold text-brand-800 dark:bg-brand-950 dark:text-brand-300' : ''}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Link href="/login" className="btn-pill font-semibold">Sign In</Link>
            <Link href="/register" className="btn-primary min-h-[42px] px-4">Get Started</Link>
          </div>

          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-ink hover:bg-mist lg:hidden dark:text-white dark:hover:bg-dark-elevated"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              {menuOpen
                ? <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-line bg-white px-4 py-3 lg:hidden dark:border-dark-border dark:bg-dark-surface" aria-label="Mobile">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="flex min-h-[48px] items-center rounded-xl px-3 text-[15px] font-medium text-ink hover:bg-mist dark:text-white dark:hover:bg-dark-elevated"
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-4 dark:border-dark-border">
            <Link href="/login" onClick={() => setMenuOpen(false)} className="btn-ghost">Sign In</Link>
            <Link href="/register" onClick={() => setMenuOpen(false)} className="btn-primary">Get Started</Link>
          </div>
        </nav>
      )}
    </header>
  );
}
