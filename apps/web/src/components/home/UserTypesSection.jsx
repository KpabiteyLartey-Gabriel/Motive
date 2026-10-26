import Link from 'next/link';

const userTypes = [
  {
    role: 'Driver', description: 'Drive under Work & Pay, DriveOn or a company rental — and always know what you owe and what you have paid.',
    features: ['Licence verified, expiry monitored', 'View and accept contracts', 'Pay easily with MTN MoMo', 'Build a record that follows you'],
    cta: 'Join as a Driver', href: '/drivers', featured: false,
  },
  {
    role: 'Vehicle Owner', description: 'Put your parked car to work with clear contracts, on-time payments and full visibility — yourself, or through a company.',
    features: ['Register and verify vehicles', 'DriveOn or Work & Pay listings', 'Watch every payment arrive', 'Track, lock or switch off remotely'],
    cta: 'Join as an Owner', href: '/owners', featured: true,
  },
  {
    role: 'Transport Company', description: 'Run a whole fleet — your vehicles and owner-supplied cars — drivers, money and maintenance from one dashboard.',
    features: ['Invite staff into their roles', 'Assign drivers in seconds', 'Automatic splits per owner', 'Revenue and cost reports'],
    cta: 'Register a Company', href: '/companies', featured: false,
  },
  {
    role: 'Fleet Manager', description: 'Run the day-to-day fleet for your company: listings, documents, tracking and emergency help.',
    features: ['Invited by your company admin', 'Vehicles, drivers and paperwork', 'Tracking and remote control', 'Dispatch maintenance to a location'],
    cta: 'See Fleet Managers', href: '/how-it-works#fleet-managers', featured: false,
  },
  {
    role: 'Maintenance Provider', description: 'Garages, mobile mechanics, detailers and wash services — get jobs with the vehicle\u2019s live location.',
    features: ['List services and coverage', 'Per-service or subscription work', 'Jobs recorded per vehicle', 'Payments on record'],
    cta: 'See Maintenance Providers', href: '/how-it-works#maintenance-providers', featured: false,
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
        <div className="max-w-2xl" data-reveal>
          <p className="section-label">Who it is for</p>
          <h2 className="section-title mt-2">Made for everyone on the road</h2>
          <p className="section-subtitle mt-3">All six participants get a workspace shaped around their day — connected to the same vehicles, contracts and money.</p>
        </div>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {userTypes.map((type, i) => (
            <article key={type.role} data-reveal style={{ '--reveal-delay': `${(i % 3) * 90}ms` }} className={`flex flex-col rounded-[20px] border p-6 sm:p-7 ${type.featured ? 'border-brand-800 bg-ink text-white shadow-lift' : 'border-line bg-white shadow-card dark:border-dark-border dark:bg-dark-card'}`}>
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
          See how all six participants work together in the +Motive pitch.{' '}
          <Link href="/how-it-works#participants" className="font-semibold text-brand-700 underline-offset-4 hover:underline dark:text-brand-300">Meet every participant</Link>
        </p>
      </div>
    </section>
  );
}
