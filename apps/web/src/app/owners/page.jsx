import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export const metadata = {
  title: 'For Owners — +Motive',
  description: 'Manage your vehicles, create contracts, monitor payments and track driver performance — all in one place.',
};

const benefits = [
  {
    title: 'Register & Verify Vehicles',
    description: 'Add your vehicles with documents, registration details and photos. Verified vehicles build trust with drivers and improve your profile on the platform.',
  },
  {
    title: 'Put Your Car to Work — or Place It With a Company',
    description: 'List your car for DriveOn or Work & Pay yourself, or hand it to a transport company whose fleet manager lists and operates it for you. You watch everything while the company earns its management share.',
  },
  {
    title: 'Monitor Every Payment',
    description: 'See every MoMo payment made against each contract, split and receipted automatically. Get notified of late payments and view the full transaction history for any vehicle.',
  },
  {
    title: 'Track & Control Your Vehicle',
    description: 'Live location, trips, speed and driver payment reliability — plus remote lock and engine off/on through the connected tracker when you need it.',
  },
  {
    title: 'Maintenance & Care, Handled',
    description: 'Engage a maintenance provider per service or by subscription — servicing, detailing, washing and minor fixes — with every job recorded against the vehicle.',
  },
  {
    title: 'Witnessed Contracts & Safe Transfer',
    description: 'Sign the deal digitally on the platform, and — when a Work & Pay contract completes — follow the formal, verified ownership-transfer workflow.',
  },
];

const contractTypes = [
  {
    name: 'Work & Pay',
    description: 'Create a structured installment arrangement where the driver pays off the vehicle over time. The platform enforces the schedule and tracks every payment.',
    highlights: ['Set total price and deposit', 'Define payment frequency', 'Automated overdue alerts'],
  },
  {
    name: 'Rental',
    description: 'Hire out your vehicle on salary or revenue-share terms. Define responsibilities for fuel, maintenance and insurance in the contract.',
    highlights: ['Salary or revenue share', 'Configurable deductions', 'Clear responsibility terms'],
  },
  {
    name: 'Driving On',
    description: 'Let a driver operate the vehicle and share revenues. Daily reconciliation keeps both parties aligned on earnings and deductions.',
    highlights: ['Daily revenue tracking', 'Expense reconciliation', 'Real-time dashboard'],
  },
];

export default function ForOwnersPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg">
      <Navbar />
      <main className="pt-24">

        {/* Hero */}
        <section className="bg-white py-16 lg:py-24 dark:bg-dark-bg">
          <div className="anim-fade-up mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <p className="section-label">For Owners</p>
            <h1 className="mt-3 text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl dark:text-white">
              Manage your vehicles with confidence
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-steel dark:text-neutral-400">
              +Motive gives vehicle owners the tools to create professional contracts,
              enforce payment schedules and track every GHS that flows through your fleet.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/register?role=owner" className="btn-primary px-6 text-[15px]">
                Join as Owner
              </Link>
              <Link href="/how-it-works" className="btn-ghost px-6 text-[15px]">
                How It Works →
              </Link>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="bg-[#F6F8F7] py-16 lg:py-24 dark:bg-dark-surface">
          <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <p className="section-label">What you get</p>
              <h2 className="section-title mt-2">Full control over your vehicles</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {benefits.map((benefit, i) => (
                <article key={i} data-reveal style={{ '--reveal-delay': `${(i % 3) * 90}ms` }} className="rounded-card border border-line bg-white p-6 shadow-card transition hover:border-brand-200 hover:shadow-lift dark:border-dark-border dark:bg-dark-card">
                  <h3 className="text-base font-semibold text-ink dark:text-white">{benefit.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-steel dark:text-neutral-400">{benefit.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Contract types */}
        <section className="bg-white py-16 lg:py-24 dark:bg-dark-bg">
          <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <p className="section-label">Contract Types</p>
              <h2 className="section-title mt-2">Flexible arrangements for every situation</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {contractTypes.map((type, i) => (
                <div key={type.name} data-reveal style={{ '--reveal-delay': `${i * 90}ms` }} className="flex flex-col rounded-card border border-line bg-white p-6 shadow-card transition hover:border-brand-200 hover:shadow-lift dark:border-dark-border dark:bg-dark-card">
                  <h3 className="text-base font-semibold text-ink dark:text-white">{type.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-steel dark:text-neutral-400">{type.description}</p>
                  <ul className="mt-5 space-y-2">
                    {type.highlights.map((h, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-ink-soft dark:text-neutral-200">
                        <svg className="h-3.5 w-3.5 shrink-0 text-brand-600" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-white px-4 py-16 sm:px-6 lg:px-8 lg:py-24 dark:bg-dark-bg">
          <div data-reveal className="mx-auto max-w-page rounded-[24px] bg-ink px-6 py-12 text-center shadow-lift sm:px-10 lg:py-16 dark:bg-dark-surface">
            <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">Start managing your vehicles today</h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-brand-100/75">Register your vehicles and create your first contract in minutes.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/register?role=owner" className="btn-primary px-6 text-[15px]">
                Create Owner Account
              </Link>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
