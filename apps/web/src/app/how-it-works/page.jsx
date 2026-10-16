import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import PitchStory from '@/components/pitch/PitchStory';
import PitchInfographic from '@/components/pitch/PitchInfographic';

export const metadata = {
  title: 'How It Works — +Motive',
  description: 'Learn how +Motive connects drivers, vehicle owners and transport companies through transparent contracts and secure payments.',
};

const steps = [
  {
    number: '01',
    title: 'Register & Verify',
    description: 'Sign up as a driver, vehicle owner or company. Complete your profile with valid identification, licence details and supporting documents. Our team verifies your account before activation.',
  },
  {
    number: '02',
    title: 'Create or Accept a Contract',
    description: 'Owners create Work & Pay, Rental or Driving On contracts with defined terms, payment schedules and responsibilities. Drivers review all terms and sign digitally — no ambiguity.',
  },
  {
    number: '03',
    title: 'Assign & Activate Vehicle',
    description: 'The vehicle is assigned to the driver with a confirmed activation date. Both parties receive a digital copy of the contract and the arrangement becomes active on the platform.',
  },
  {
    number: '04',
    title: 'Make Payments via MoMo',
    description: 'Drivers make regular payments through MTN Mobile Money. Every transaction is recorded, receipts are issued automatically and the financial ledger is updated in real time.',
  },
  {
    number: '05',
    title: 'Track Progress & Reports',
    description: 'Both parties see real-time payment progress, earnings, expenses and maintenance records in their respective dashboards. Nothing is hidden — everything is auditable.',
  },
  {
    number: '06',
    title: 'Complete & Transfer',
    description: 'When all obligations are fulfilled, an ownership transfer request is initiated. It follows a separate, verified workflow with document checks and formal approval — not an automatic event.',
  },
];

const contractTypes = [
  {
    name: 'Work & Pay',
    description: 'The driver makes scheduled installment payments towards owning the vehicle outright. The platform tracks every payment, balance and deadline.',
  },
  {
    name: 'Rental',
    description: 'Offered through transport companies: the driver earns a salary or revenue share and the owner retains ownership. Terms, responsibilities and deductions are defined in the contract.',
  },
  {
    name: 'Driving On',
    description: 'The driver operates the vehicle and earns revenue after agreed deductions for fuel, expenses and owner fees. Daily reconciliation is built in.',
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg">
      <Navbar />
      <main className="pt-24">

        {/* Hero */}
        <section className="bg-white py-16 lg:py-24 dark:bg-dark-bg">
          <div className="anim-fade-up mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <p className="section-label">Process</p>
            <h1 className="mt-3 text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl dark:text-white">
              How +Motive Works
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-steel dark:text-neutral-400">
              A transparent, auditable process from account registration through contract creation,
              payment completion and ownership transfer.
            </p>
          </div>
        </section>

        {/* Pitch: videographic storyboard + infographic */}
        <PitchStory />
        <PitchInfographic />

        {/* Steps */}
        <section className="bg-[#F6F8F7] py-16 lg:py-24 dark:bg-dark-surface">
          <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-x-10 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
              {steps.map((step, i) => (
                <div key={step.number} data-reveal style={{ '--reveal-delay': `${(i % 3) * 90}ms` }} className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 shadow-sm">
                    <span className="font-mono text-xs font-bold text-white">{step.number}</span>
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold text-ink dark:text-white">{step.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-steel dark:text-neutral-400">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contract types */}
        <section className="bg-white py-16 lg:py-24 dark:bg-dark-bg">
          <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <p className="section-label">Contract Types</p>
              <h2 className="section-title mt-2">Three arrangements, one platform</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {contractTypes.map((type, i) => (
                <div key={type.name} data-reveal style={{ '--reveal-delay': `${i * 90}ms` }} className="rounded-card border border-line bg-white p-6 shadow-card transition hover:border-brand-200 hover:shadow-lift dark:border-dark-border dark:bg-dark-card">
                  <h3 className="text-base font-semibold text-ink dark:text-white">{type.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-steel dark:text-neutral-400">{type.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-white px-4 py-16 sm:px-6 lg:px-8 lg:py-24 dark:bg-dark-bg">
          <div data-reveal className="mx-auto max-w-page rounded-[24px] bg-ink px-6 py-12 text-center shadow-lift sm:px-10 lg:py-16 dark:bg-dark-surface">
            <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">Ready to get started?</h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-brand-100/75">Join +Motive and manage your vehicle operations with full transparency.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/register" className="btn-primary px-6 text-[15px]">
                Create Account
              </Link>
              <Link href="/drivers" className="btn-ghost-light px-6 text-[15px]">
                For Drivers →
              </Link>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
