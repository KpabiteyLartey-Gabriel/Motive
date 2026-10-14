import Link from 'next/link';

const userTypes = [
  {
    role: 'Driver', description: 'Drive under Work & Pay, Rental or Driving On — and always know what you owe and what you have paid.',
    features: ['View and accept contracts', 'Pay easily with MTN MoMo', 'Track earnings and balance', 'Report maintenance or incidents'],
    cta: 'Join as a Driver', href: '/register?role=driver', featured: false,
  },
  {
    role: 'Vehicle Owner', description: 'Put your vehicle to work with clear contracts, on-time payments and full visibility.',
    features: ['Register and verify vehicles', 'Create contracts in minutes', 'Watch payments arrive', 'Track your driver and vehicle'],
    cta: 'Join as an Owner', href: '/register?role=owner', featured: true,
  },
  {
    role: 'Transport Company', description: 'Run a whole fleet — vehicles, drivers, money and maintenance — from one dashboard.',
    features: ['Multi-vehicle fleet control', 'Assign drivers in seconds', 'Automated payment tracking', 'Revenue and cost reports'],
    cta: 'Register a Company', href: '/register?role=company', featured: false,
  },
];

function Check({ featured }) {
  return (
    <svg className={`mt-0.5 h-5 w-5 shrink-0 ${featured ? 'text-brand-300' : 'text-brand-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default function UserTypesSection() {
  return (
    <section className="bg-[#F6F8F7] py-16 lg:py-24 dark:bg-dark-surface">
      <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="section-label">Who it is for</p>
          <h2 className="section-title mt-2">Made for everyone on the road</h2>
          <p className="section-subtitle mt-3">Drivers, owners and companies each get a workspace shaped around their day.</p>
        </div>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {userTypes.map((type) => (
            <article key={type.role} className={`flex flex-col rounded-[20px] border p-6 sm:p-7 ${type.featured ? 'border-brand-800 bg-ink text-white shadow-lift' : 'border-line bg-white shadow-card dark:border-dark-border dark:bg-dark-card'}`}>
              {type.featured && <span className="mb-4 self-start rounded-full bg-brand-600 px-3 py-1 text-xs font-bold text-white">Most popular</span>}
              <h3 className={`text-lg font-semibold ${type.featured ? 'text-white' : 'text-ink dark:text-white'}`}>{type.role}</h3>
              <p className={`mt-2 text-sm leading-relaxed ${type.featured ? 'text-brand-100/80' : 'text-steel dark:text-neutral-400'}`}>{type.description}</p>
              <ul className="mt-6 flex-1 space-y-3">
                {type.features.map((f) => (
                  <li key={f} className={`flex gap-2.5 text-sm ${type.featured ? 'text-brand-50' : 'text-ink-soft dark:text-neutral-200'}`}><Check featured={type.featured} />{f}</li>
                ))}
              </ul>
              <Link href={type.href} className={`mt-8 w-full ${type.featured ? 'btn-primary' : 'btn-ghost'}`}>{type.cta}</Link>
            </article>
          ))}
        </div>
        <p className="mt-8 text-sm text-steel dark:text-neutral-400">
          Also for fleet managers, maintenance providers and legal professionals.{' '}
          <Link href="/companies" className="font-semibold text-brand-700 underline-offset-4 hover:underline dark:text-brand-300">Learn more</Link>
        </p>
      </div>
    </section>
  );
}
