import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export const metadata = {
  title: 'About — GH Motive',
  description: 'GH Motive is a vehicle operations, mobility, fleet, contract and payment platform built for Ghana\'s transport sector.',
};

const values = [
  {
    title: 'Transparency',
    description: "Every contract, payment and decision is recorded and accessible to all parties. Nobody is left guessing about obligations, balances or responsibilities.",
  },
  {
    title: 'Financial Integrity',
    description: "Every payment creates an authoritative ledger entry with a receipt. The platform can explain every balance at any point in time — no gaps, no ambiguity.",
  },
  {
    title: 'Accountability',
    description: "Vehicle ownership, driver obligations and company responsibilities are formally recorded. Audit trails ensure that every significant action is documented.",
  },
  {
    title: 'Protection for All Parties',
    description: "Drivers are protected by clear contract terms. Owners are protected by enforced payment schedules. Companies operate with formal processes that reduce disputes.",
  },
  {
    title: 'Built for Ghana',
    description: "MTN Mobile Money integration, local contract arrangements and an understanding of how transport businesses operate in Ghana — not a generic platform applied to a local problem.",
  },
  {
    title: 'Reliability',
    description: "Payment processing is designed to be idempotent. Duplicate webhooks do not produce duplicate transactions. The system is built to behave correctly under real-world conditions.",
  },
];

const problemStatements = [
  {
    problem: 'Informal agreements',
    solution: 'Digital contracts with defined terms, schedules and digital signatures — stored permanently on the platform.',
  },
  {
    problem: 'Missing payment records',
    solution: 'Every payment via MTN MoMo is captured with a receipt and a ledger entry. Nothing is lost.',
  },
  {
    problem: 'Ownership disputes',
    solution: 'Work & Pay completion triggers a formal ownership transfer workflow — not an automatic or verbal handover.',
  },
  {
    problem: 'No maintenance history',
    solution: 'All service jobs, repairs and next service dates are recorded against each vehicle permanently.',
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg">
      <Navbar />
      <main className="pt-24">

        {/* Hero */}
        <section className="py-20 bg-white dark:bg-dark-bg">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-sm font-medium text-neutral-500 uppercase tracking-widest mb-3">About</p>
            <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-5">
              Bringing order to Ghana&apos;s transport sector
            </h1>
            <p className="text-lg text-neutral-400 leading-relaxed">
              GH Motive is a vehicle operations, mobility, fleet, contract and payment platform
              built specifically for Ghana. It replaces informal arrangements, verbal agreements
              and missing payment records with a transparent, auditable digital system.
            </p>
          </div>
        </section>

        {/* Mission */}
        <section className="py-20 bg-chalk dark:bg-dark-surface border-t border-neutral-200 dark:border-dark-border">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <p className="text-sm font-medium text-neutral-500 uppercase tracking-widest mb-3">Mission</p>
              <h2 className="text-3xl font-bold text-white mb-6">Why GH Motive exists</h2>
              <p className="text-base text-neutral-400 leading-relaxed max-w-2xl mx-auto">
                Ghana&apos;s transport sector runs largely on informal arrangements. Drivers
                operate under verbal agreements. Owners have no reliable way to track payments.
                Disputes arise with no written record to refer to. Ownership transfers happen
                without formal processes.
              </p>
              <p className="text-base text-neutral-400 leading-relaxed max-w-2xl mx-auto mt-4">
                GH Motive replaces all of that with a platform that every participant in the
                transport chain — drivers, owners, companies, fleet managers and maintenance
                providers — can rely on.
              </p>
            </div>

            {/* Problem → Solution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {problemStatements.map((item, i) => (
                <div key={i} className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-6">
                  <p className="text-xs font-medium text-neutral-600 uppercase tracking-widest mb-1">Problem</p>
                  <p className="text-sm font-semibold text-neutral-300 mb-3">{item.problem}</p>
                  <p className="text-xs font-medium text-neutral-600 uppercase tracking-widest mb-1">GH Motive Solution</p>
                  <p className="text-sm text-neutral-500 leading-relaxed">{item.solution}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="py-20 bg-white dark:bg-dark-bg border-t border-neutral-200 dark:border-dark-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <p className="text-sm font-medium text-neutral-500 uppercase tracking-widest mb-3">Values</p>
              <h2 className="text-3xl font-bold text-white">What guides every decision</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-dark-border rounded-2xl overflow-hidden">
              {values.map((value, i) => (
                <div key={i} className="bg-dark-bg p-8 hover:bg-dark-card transition-colors">
                  <h3 className="text-base font-semibold text-white mb-2">{value.title}</h3>
                  <p className="text-sm text-neutral-500 leading-relaxed">{value.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Platform overview */}
        <section className="py-20 bg-chalk dark:bg-dark-surface border-t border-neutral-200 dark:border-dark-border">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-sm font-medium text-neutral-500 uppercase tracking-widest mb-3">Platform</p>
            <h2 className="text-3xl font-bold text-white mb-6">One platform for the entire chain</h2>
            <p className="text-base text-neutral-400 leading-relaxed mb-12">
              GH Motive serves every participant in Ghana&apos;s commercial transport sector
              from a single, connected platform — web and mobile.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-left">
              {[
                'Drivers',
                'Vehicle Owners',
                'Transport Companies',
                'Fleet Managers',
                'Maintenance Providers',
                'Legal Professionals',
              ].map((role) => (
                <div key={role} className="flex items-center gap-2.5 text-sm text-neutral-400 bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-xl px-4 py-3">
                  <svg className="w-3.5 h-3.5 text-neutral-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {role}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-white dark:bg-dark-bg border-t border-neutral-200 dark:border-dark-border">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Join GH Motive</h2>
            <p className="text-neutral-400 mb-8">Whether you drive, own vehicles or run a transport company — there is a place for you on GH Motive.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/register" className="inline-flex items-center justify-center px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-neutral-100 transition-colors text-sm">
                Create Account
              </Link>
              <Link href="/how-it-works" className="inline-flex items-center justify-center px-6 py-3 border border-neutral-200 dark:border-dark-border text-neutral-300 font-medium rounded-xl hover:bg-chalk dark:hover:bg-dark-elevated transition-colors text-sm">
                How It Works →
              </Link>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
