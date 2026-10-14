import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export const metadata = {
  title: 'For Owners — GH Motive',
  description: 'Manage your vehicles, create contracts, monitor payments and track driver performance — all in one place.',
};

const benefits = [
  {
    title: 'Register & Verify Vehicles',
    description: 'Add your vehicles with documents, registration details and photos. Verified vehicles build trust with drivers and improve your profile on the platform.',
  },
  {
    title: 'Create Professional Contracts',
    description: 'Build Work & Pay, Rental or Driving On contracts with defined terms, payment schedules and clearly assigned responsibilities — no lawyers needed for standard agreements.',
  },
  {
    title: 'Monitor Payment Obligations',
    description: 'See every payment made against each contract. Get notified of late payments and view the full transaction history with receipts for any vehicle.',
  },
  {
    title: 'Track Driver Performance',
    description: 'View driver payment reliability, active contract status and any disputes — giving you the data to make informed decisions about future arrangements.',
  },
  {
    title: 'Maintenance Management',
    description: 'Log maintenance jobs, track service history and schedule upcoming service dates. Know exactly what has been done to your vehicle and when.',
  },
  {
    title: 'Ownership Transfer Workflow',
    description: 'When a Work & Pay contract is complete, the platform guides you through the formal ownership transfer process — with document checks and formal approval steps.',
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
        <section className="py-20 bg-white dark:bg-dark-bg">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-sm font-medium text-neutral-500 uppercase tracking-widest mb-3">For Owners</p>
            <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-5">
              Manage your vehicles with confidence
            </h1>
            <p className="text-lg text-neutral-400 leading-relaxed">
              GH Motive gives vehicle owners the tools to create professional contracts,
              enforce payment schedules and track every GHS that flows through your fleet.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/register?role=owner" className="inline-flex items-center justify-center px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-neutral-100 transition-colors text-sm">
                Join as Owner
              </Link>
              <Link href="/how-it-works" className="inline-flex items-center justify-center px-6 py-3 border border-neutral-200 dark:border-dark-border text-neutral-300 font-medium rounded-xl hover:bg-chalk dark:hover:bg-dark-elevated transition-colors text-sm">
                How It Works →
              </Link>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-20 bg-chalk dark:bg-dark-surface border-t border-neutral-200 dark:border-dark-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <p className="text-sm font-medium text-neutral-500 uppercase tracking-widest mb-3">What you get</p>
              <h2 className="text-3xl font-bold text-white">Full control over your vehicles</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-dark-border rounded-2xl overflow-hidden">
              {benefits.map((benefit, i) => (
                <div key={i} className="bg-chalk dark:bg-dark-surface p-8 hover:bg-dark-card transition-colors">
                  <h3 className="text-base font-semibold text-white mb-2">{benefit.title}</h3>
                  <p className="text-sm text-neutral-500 leading-relaxed">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contract types */}
        <section className="py-20 bg-white dark:bg-dark-bg border-t border-neutral-200 dark:border-dark-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <p className="text-sm font-medium text-neutral-500 uppercase tracking-widest mb-3">Contract Types</p>
              <h2 className="text-3xl font-bold text-white">Flexible arrangements for every situation</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {contractTypes.map((type) => (
                <div key={type.name} className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-6 flex flex-col">
                  <h3 className="text-base font-semibold text-white mb-3">{type.name}</h3>
                  <p className="text-sm text-neutral-500 leading-relaxed mb-5">{type.description}</p>
                  <ul className="mt-auto space-y-2">
                    {type.highlights.map((h, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-neutral-400">
                        <svg className="w-3.5 h-3.5 text-neutral-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
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
        <section className="py-20 bg-chalk dark:bg-dark-surface border-t border-neutral-200 dark:border-dark-border">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Start managing your vehicles today</h2>
            <p className="text-neutral-400 mb-8">Register your vehicles and create your first contract in minutes.</p>
            <Link href="/register?role=owner" className="inline-flex items-center justify-center px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-neutral-100 transition-colors text-sm">
              Create Owner Account
            </Link>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
