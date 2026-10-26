import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export const metadata = {
  title: 'About — +Motive',
  description: '+Motive is a vehicle operations, mobility, fleet, contract and payment platform built for Ghana\'s transport sector.',
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
        <section className="bg-white py-16 lg:py-24 dark:bg-dark-bg">
          <div className="anim-fade-up mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <p className="section-label">About</p>
            <h1 className="mt-3 text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl dark:text-white">
              Bringing order to Ghana&apos;s transport sector
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-steel dark:text-neutral-400">
              +Motive — the company behind +Motive — is a vehicle operations, mobility, fleet, contract and payment platform
              built specifically for Ghana. It replaces informal arrangements, verbal agreements
              and missing payment records with a transparent, auditable digital system.
            </p>
          </div>
        </section>

        {/* Mission */}
        <section className="bg-[#F6F8F7] py-16 lg:py-24 dark:bg-dark-surface">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <p className="section-label">Mission</p>
              <h2 className="section-title mt-2">Why +Motive exists</h2>
              <p className="section-subtitle mt-4">
                Ghana&apos;s transport sector runs largely on informal arrangements. Drivers
                operate under verbal agreements. Owners have no reliable way to track payments.
                Disputes arise with no written record to refer to. Ownership transfers happen
                without formal processes.
              </p>
              <p className="mt-4 text-base leading-relaxed text-steel dark:text-neutral-400">
                +Motive replaces all of that with a platform that every participant in the
                transport chain — drivers, owners, companies, fleet managers and maintenance
                providers — can rely on.
              </p>
            </div>

            {/* Problem → Solution */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {problemStatements.map((item, i) => (
                <div key={i} data-reveal style={{ '--reveal-delay': `${(i % 2) * 90}ms` }} className="rounded-card border border-line bg-white p-6 shadow-card dark:border-dark-border dark:bg-dark-card">
                  <p className="section-label text-[13px]">Problem</p>
                  <p className="mt-1 text-[15px] font-semibold text-ink dark:text-white">{item.problem}</p>
                  <p className="section-label mt-4 text-[13px]">+Motive Solution</p>
                  <p className="mt-1 text-sm leading-relaxed text-steel dark:text-neutral-400">{item.solution}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="bg-white py-16 lg:py-24 dark:bg-dark-bg">
          <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <p className="section-label">Values</p>
              <h2 className="section-title mt-2">What guides every decision</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {values.map((value, i) => (
                <article key={i} data-reveal style={{ '--reveal-delay': `${(i % 3) * 90}ms` }} className="rounded-card border border-line bg-white p-6 shadow-card transition hover:border-brand-200 hover:shadow-lift dark:border-dark-border dark:bg-dark-card">
                  <h3 className="text-base font-semibold text-ink dark:text-white">{value.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-steel dark:text-neutral-400">{value.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Platform overview */}
        <section className="bg-[#F6F8F7] py-16 lg:py-24 dark:bg-dark-surface">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <p className="section-label">Platform</p>
            <h2 className="section-title mt-2">One platform for the entire chain</h2>
            <p className="section-subtitle mx-auto mt-4 max-w-2xl">
              +Motive serves every participant in Ghana&apos;s commercial transport sector
              from a single, connected platform — web and mobile.
            </p>
            <div className="mt-10 grid grid-cols-2 gap-4 text-left md:grid-cols-3">
              {[
                'Drivers',
                'Vehicle Owners',
                'Transport Companies',
                'Fleet Managers',
                'Maintenance Providers',
              ].map((role) => (
                <div key={role} className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-4 py-3 text-sm font-medium text-ink-soft shadow-card dark:border-dark-border dark:bg-dark-card dark:text-neutral-200">
                  <svg className="h-3.5 w-3.5 shrink-0 text-brand-600" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {role}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-white px-4 py-16 sm:px-6 lg:px-8 lg:py-24 dark:bg-dark-bg">
          <div data-reveal className="mx-auto max-w-page rounded-[24px] bg-ink px-6 py-12 text-center shadow-lift sm:px-10 lg:py-16 dark:bg-dark-surface">
            <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">Join +Motive</h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-brand-100/75">Whether you drive, own vehicles or run a transport company — there is a place for you on +Motive.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/register" className="btn-primary px-6 text-[15px]">
                Create Account
              </Link>
              <Link href="/how-it-works" className="btn-ghost-light px-6 text-[15px]">
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
