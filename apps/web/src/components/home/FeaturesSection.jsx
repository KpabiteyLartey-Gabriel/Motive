import { Icon } from '@/components/ui/Icon';

const features = [
  { icon: 'contract', title: 'Witnessed smart contracts', description: 'Work & Pay, DriveOn and company Rental contracts — facilitated and witnessed by legal professionals, signed digitally, with an identical copy for every party.' },
  { icon: 'payments', title: 'MoMo payments, split automatically', description: 'MTN MoMo collections with receipts and a ledger that splits every payment between owner, company and platform — no duplicates, no quiet edits.' },
  { icon: 'tracking', title: 'Tracking & remote control', description: 'Live location, trips and speed for every vehicle, a safe shareable location link, and remote lock or engine off/on when it matters.' },
  { icon: 'documents', title: 'Documents that stay current', description: 'Driving licences, insurance, roadworthiness and registration monitored in one place, with expiry alerts before they become a problem.' },
  { icon: 'maintenance', title: 'Maintenance & help on call', description: 'Raise a breakdown with a voice or video report and live location; maintenance providers attend, fix and record it — per service or by subscription.' },
  { icon: 'disputes', title: 'Fair dispute resolution', description: 'Raise an issue, add evidence and follow a transparent timeline through to a recorded resolution.' },
];

export default function FeaturesSection() {
  return (
    <section className="bg-[#F6F8F7] py-16 lg:py-24 dark:bg-dark-surface">
      <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl" data-reveal>
          <p className="section-label">What you can do</p>
          <h2 className="section-title mt-2">Everything you need to run vehicle operations</h2>
          <p className="section-subtitle mt-3">One calm workspace for contracts, money, vehicles and people — no scattered chats or paper records.</p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <article key={f.title} data-reveal style={{ '--reveal-delay': `${(i % 3) * 90}ms` }} className="rounded-card border border-line bg-white p-6 shadow-card transition hover:border-brand-200 hover:shadow-lift dark:border-dark-border dark:bg-dark-card">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm"><Icon name={f.icon} size={20} /></span>
              <h3 className="mt-5 text-base font-semibold text-ink dark:text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-steel dark:text-neutral-400">{f.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
