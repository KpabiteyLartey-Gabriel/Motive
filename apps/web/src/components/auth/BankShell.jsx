import Link from 'next/link';
import { BrandMark } from '@/components/layout/Navbar';

// Databank-style banking layout in +Motive's own colours: slim top bar
// with a Contact Us pill, a brand hero panel on the left, and the form
// on the right. Labels are small and uppercase, CTAs are pills.
export default function BankShell({ badge = 'WELCOME TO +MOTIVE', heroTitle = 'Drive. Earn.', heroAccent = 'Own it.', heroText = 'Contracts, payments and tracking — all in one secure place.', title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink dark:bg-dark-bg dark:text-white">
      <header className="sticky top-0 z-50 border-b border-line/60 bg-paper/95 backdrop-blur dark:border-dark-border dark:bg-dark-bg/95">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-5 py-4">
        <Link href="/" aria-label="+Motive home"><BrandMark /></Link>
        <div className="flex items-center gap-4">
          <Link href="/contact" className="hidden text-sm font-semibold text-brand-800 hover:underline dark:text-brand-300 sm:block">Help Center</Link>
          <Link href="/contact" className="rounded-full bg-brand-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-800">Contact Us</Link>
        </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1440px] flex-1 lg:grid-cols-2">
        <section className="relative overflow-hidden bg-brand-950" aria-hidden="true">
          {/* Full image, never cropped: the panel uses the image's own
              dark-green backdrop colour so any letterbox blends in. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/hero-vehicles.jpg" alt="" className="absolute inset-0 h-full w-full object-contain object-top" />
          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-brand-950/85 to-transparent" />
          <div className="relative flex h-full min-h-[220px] flex-col justify-end px-6 py-10 [text-shadow:0_2px_18px_rgba(0,0,0,0.55)] sm:px-10 lg:min-h-[560px]">
            <span className="mb-5 w-fit rounded-full border border-white/40 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white">{badge}</span>
            <h2 className="max-w-md text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl">
              {heroTitle} <span className="block text-brand-300">{heroAccent}</span>
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-white/85">{heroText}</p>
          </div>
        </section>

        <section className="bg-mist px-5 py-8 dark:bg-dark-bg sm:px-10 lg:py-12">
          <div className="mx-auto w-full max-w-[520px] [&_.btn-primary]:rounded-full [&_.label]:text-xs [&_.label]:font-bold [&_.label]:uppercase [&_.label]:tracking-wider">
            {title && <h1 className="text-[28px] font-bold tracking-tight text-brand-950 dark:text-white">{title}</h1>}
            {subtitle && <p className="mt-1.5 text-sm leading-relaxed text-steel dark:text-neutral-400">{subtitle}</p>}
            <div className="mt-7">{children}</div>
            {footer}
          </div>
        </section>
      </main>

      <footer className="px-5 pb-8 pt-2 text-center">
        <p className="flex items-center justify-center gap-5 text-[13px] text-steel dark:text-neutral-400">
          <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
          <Link href="/contact" className="hover:underline">Contact Us</Link>
        </p>
        <p className="mt-3 text-xs text-steel/80 dark:text-neutral-500">© {new Date().getFullYear()} +Motive. All rights reserved.</p>
      </footer>
    </div>
  );
}
