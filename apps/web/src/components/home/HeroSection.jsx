import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';

export default function HeroSection() {
  return (
    <section className="overflow-hidden bg-white dark:bg-dark-bg">
      <div className="mx-auto grid max-w-page items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pb-24 lg:pt-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-[13px] font-semibold text-brand-800 dark:bg-brand-950 dark:text-brand-300">
            <span className="h-2 w-2 rounded-full bg-brand-500" aria-hidden="true" />
            Built for Ghana&apos;s transport sector
          </p>
          <h1 className="mt-6 max-w-xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl sm:leading-[1.05] text-ink sm:text-6xl dark:text-white">
            Vehicle work, payments and contracts — clear at a glance.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-steel dark:text-neutral-400">
            GH Motive connects owners, drivers and companies with transparent contracts, secure MoMo payments and a complete audit trail.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/register" className="btn-primary px-6 text-[15px]">Create free account</Link>
            <Link href="/how-it-works" className="btn-ghost px-6 text-[15px]">See how it works</Link>
          </div>
          <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4">
            {[
              ['3', 'Contract models'],
              ['MoMo', 'Secure payments'],
              ['100%', 'Audit trail'],
            ].map(([value, label]) => (
              <div key={label} className="border-l-2 border-brand-500 pl-3">
                <dt className="sr-only">{label}</dt>
                <dd className="text-xl font-semibold text-ink dark:text-white">{value}</dd>
                <dd className="mt-0.5 text-xs leading-snug text-steel dark:text-neutral-400">{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative mx-auto w-full max-w-lg lg:max-w-none" aria-label="Preview of the GH Motive dashboard">
          <div className="rounded-[20px] border border-line bg-[#F6F8F7] p-4 shadow-lift sm:p-5 dark:border-dark-border dark:bg-dark-surface">
            <div className="rounded-card border border-line bg-white p-5 dark:border-dark-border dark:bg-dark-card">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink dark:text-white">Work &amp; Pay progress</p>
                  <p className="text-xs text-steel dark:text-neutral-400">Toyota Corolla · GR-1234-24</p>
                </div>
                <span className="badge bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-300">Active</span>
              </div>
              <p className="money mt-6 text-3xl font-semibold text-ink dark:text-white">GHS 18,400 <span className="text-sm font-medium text-steel">paid</span></p>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-mist-deep dark:bg-dark-elevated">
                <div className="h-full w-[68%] rounded-full bg-brand-500" />
              </div>
              <div className="mt-2 flex justify-between text-xs text-steel dark:text-neutral-400"><span>68% complete</span><span>GHS 8,600 left</span></div>
              <div className="mt-6 space-y-3">
                {[
                  ['payments', 'MoMo payment received', 'GHS 450.00 · Today'],
                  ['contract', 'Contract on track', 'Next payment Friday'],
                  ['tracking', 'Vehicle in Accra', 'Updated 4 min ago'],
                ].map(([icon, title, sub]) => (
                  <div key={title} className="flex items-center gap-3 rounded-xl bg-mist px-3 py-3 dark:bg-dark-surface">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white text-brand-700 shadow-sm dark:bg-dark-elevated dark:text-brand-300"><Icon name={icon} size={17} /></span>
                    <span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink dark:text-white">{title}</span><span className="block truncate text-xs text-steel dark:text-neutral-400">{sub}</span></span>
                  </div>
                ))}
              </div>
            </div>
            <p className="px-1 pb-1 pt-4 text-center text-xs text-steel dark:text-neutral-500">Live balances are always confirmed by the backend — never guessed in the app.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
