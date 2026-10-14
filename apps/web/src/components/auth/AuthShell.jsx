import Link from 'next/link';
import { BrandMark } from '@/components/layout/Navbar';
import { Icon } from '@/components/ui/Icon';

const points = [
  ['contract', 'Clear contracts', 'Work & Pay, Rental and Driving On terms both sides can follow.'],
  ['payments', 'Secure MoMo payments', 'Every payment confirmed by the backend, with a receipt.'],
  ['tracking', 'Always know where things stand', 'Balances, vehicles and progress — visible in real time.'],
];

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_480px]">
      <aside className="relative hidden bg-ink px-10 py-10 lg:flex lg:flex-col dark:bg-dark-surface">
        <Link href="/" aria-label="GH Motive home"><BrandMark dark /></Link>
        <div className="my-auto max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white">Run vehicle work without the guesswork.</h2>
          <p className="mt-3 leading-relaxed text-brand-100/75">Join owners, drivers and companies managing contracts and payments with total clarity.</p>
          <ul className="mt-10 space-y-6">
            {points.map(([icon, title, sub]) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-brand-300"><Icon name={icon} size={20} /></span>
                <span><span className="block font-semibold text-white">{title}</span><span className="mt-0.5 block text-sm leading-relaxed text-brand-100/70">{sub}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-brand-100/50">Secure · Transparent · Built for Ghana</p>
      </aside>

      <main className="flex flex-col bg-[#F6F8F7] px-4 py-8 sm:px-8 dark:bg-dark-bg">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
          <div className="mb-8 flex justify-center lg:hidden">
            <Link href="/" aria-label="GH Motive home"><BrandMark /></Link>
          </div>
          <div className="rounded-[20px] border border-line bg-white p-6 shadow-card sm:p-8 dark:border-dark-border dark:bg-dark-card">
            <h1 className="text-2xl font-semibold tracking-tight text-ink dark:text-white">{title}</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-steel dark:text-neutral-400">{subtitle}</p>
            <div className="mt-7">{children}</div>
          </div>
          {footer}
        </div>
      </main>
    </div>
  );
}
