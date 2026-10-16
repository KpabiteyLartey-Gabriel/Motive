import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export const metadata = {
  title: 'For Drivers — +Motive',
  description: 'Drive with confidence. +Motive gives drivers transparent contracts, clear payment schedules and a complete record of every transaction.',
};

const benefits = [
  {
    title: 'Clear Contract Terms',
    description: 'Every agreement is written in plain language. You see the vehicle, the payment schedule, the total amount and all responsibilities before you sign.',
  },
  {
    title: 'Pay via MTN MoMo',
    description: 'Make payments securely through MTN Mobile Money. Every payment is recorded with a receipt and your balance is updated instantly.',
  },
  {
    title: 'Track Your Progress',
    description: 'Your dashboard shows how much you have paid, how much remains and when your next payment is due — no surprises.',
  },
  {
    title: 'Earnings & Expenses',
    description: 'Log daily earnings and expenses. Know exactly what you are making after deductions, fuel and maintenance costs.',
  },
  {
    title: 'Maintenance Records',
    description: 'Service history, upcoming maintenance and repair records are stored with your vehicle — protecting you and the owner.',
  },
  {
    title: 'Dispute Resolution',
    description: 'If a disagreement arises, raise a formal dispute on the platform. Every message, evidence and decision is recorded.',
  },
];

const contractTypes = [
  {
    name: 'Work & Pay',
    tag: 'Own the vehicle',
    description: 'Make structured installment payments towards full ownership of the vehicle. When obligations are complete, follow the formal ownership transfer process.',
    highlights: ['Defined payment schedule', 'Balance tracked in real time', 'Ownership transfer on completion'],
  },
  {
    name: 'Rental',
    tag: 'Earn a salary',
    description: 'Drive for an owner and earn a salary or revenue share. The owner covers most major costs. Your responsibilities are clearly stated in the contract.',
    highlights: ['Fixed or revenue-based income', 'Owner manages major costs', 'Defined work terms'],
  },
  {
    name: 'Driving On',
    tag: 'Keep your revenue',
    description: 'Operate the vehicle and retain revenue after agreed deductions. Fuel, expenses and owner fees are reconciled daily inside the platform.',
    highlights: ['Daily revenue reconciliation', 'Transparent expense tracking', 'Real-time earnings view'],
  },
];

export default function ForDriversPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg">
      <Navbar />
      <main className="pt-24">

        {/* Hero */}
        <section className="bg-white py-16 lg:py-24 dark:bg-dark-bg">
          <div className="anim-fade-up mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <p className="section-label">For Drivers</p>
            <h1 className="mt-3 text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl dark:text-white">
              Drive with full transparency
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-steel dark:text-neutral-400">
              +Motive gives drivers clear contracts, real-time payment tracking and a complete
              record of every transaction — so you always know exactly where you stand. Sign up with a
              valid driving licence: it is verified at onboarding and monitored, with alerts before it expires.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/register?role=driver" className="btn-primary px-6 text-[15px]">
                Join as Driver
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
              <h2 className="section-title mt-2">Built to protect drivers</h2>
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
              <p className="section-label">Contract Options</p>
              <h2 className="section-title mt-2">Choose the arrangement that suits you</h2>
              <p className="section-subtitle mt-3">Work &amp; Pay and DriveOn come from owners or companies; Rental is offered through transport companies.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {contractTypes.map((type, i) => (
                <div key={type.name} data-reveal style={{ '--reveal-delay': `${i * 90}ms` }} className="flex flex-col rounded-card border border-line bg-white p-6 shadow-card transition hover:border-brand-200 hover:shadow-lift dark:border-dark-border dark:bg-dark-card">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-ink dark:text-white">{type.name}</h3>
                    <span className="badge bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-300">{type.tag}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-steel dark:text-neutral-400">{type.description}</p>
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
            <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">Ready to drive with +Motive?</h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-brand-100/75">Create your free driver account and get matched with verified vehicles and contracts.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/register?role=driver" className="btn-primary px-6 text-[15px]">
                Create Driver Account
              </Link>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
