import { Icon } from '@/components/ui/Icon';

const features = [
  { icon: 'contract', title: 'Smart contracts', description: 'Work & Pay, Rental and Driving On contracts with digital acceptance, automated schedules and full history.' },
  { icon: 'payments', title: 'Secure MoMo payments', description: 'MTN MoMo payments with duplicate protection, receipts, a financial ledger and automated settlements.' },
  { icon: 'tracking', title: 'Live fleet tracking', description: 'See where every vehicle is, review trip history and share a safe live-location link when needed.' },
  { icon: 'documents', title: 'Documents that stay current', description: 'Registrations, licences and insurance in one place, with expiry alerts before they become a problem.' },
  { icon: 'maintenance', title: 'Maintenance without chaos', description: 'Request, approve and track servicing and repairs with costs both sides can see.' },
  { icon: 'disputes', title: 'Fair dispute resolution', description: 'Raise an issue, add evidence and follow a transparent timeline through to resolution.' },
];

export default function FeaturesSection() {
  return (
    <section className="bg-[#F6F8F7] py-16 lg:py-24 dark:bg-dark-surface">
      <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="section-label">What you can do</p>
          <h2 className="section-title mt-2">Everything you need to run vehicle operations</h2>
          <p className="section-subtitle mt-3">One calm workspace for contracts, money, vehicles and people — no scattered chats or paper records.</p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <article key={f.title} className="rounded-card border border-line bg-white p-6 shadow-card transition hover:border-brand-200 hover:shadow-lift dark:border-dark-border dark:bg-dark-card">
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
