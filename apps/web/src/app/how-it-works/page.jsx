import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export const metadata = {
  title: 'How It Works — GH Motive',
  description: 'Learn how GH Motive connects drivers, vehicle owners and transport companies through transparent contracts and secure payments.',
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
    description: 'The driver earns a salary or revenue share. The owner retains ownership. Terms, responsibilities and deductions are defined in the contract.',
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
        <section className="py-20 bg-white dark:bg-dark-bg">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-sm font-medium text-neutral-500 uppercase tracking-widest mb-3">Process</p>
            <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-5">
              How GH Motive Works
            </h1>
            <p className="text-lg text-neutral-400 leading-relaxed">
              A transparent, auditable process from account registration through contract creation,
              payment completion and ownership transfer.
            </p>
          </div>
        </section>

        {/* Steps */}
        <section className="py-20 bg-chalk dark:bg-dark-surface border-t border-neutral-200 dark:border-dark-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {steps.map((step) => (
                <div key={step.number} className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border flex items-center justify-center">
                    <span className="text-neutral-500 font-mono text-xs font-bold">{step.number}</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1.5">{step.title}</h3>
                    <p className="text-sm text-neutral-500 leading-relaxed">{step.description}</p>
                  </div>
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
              <h2 className="text-3xl font-bold text-white">Three arrangements, one platform</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {contractTypes.map((type) => (
                <div key={type.name} className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-6">
                  <h3 className="text-base font-semibold text-white mb-3">{type.name}</h3>
                  <p className="text-sm text-neutral-500 leading-relaxed">{type.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-chalk dark:bg-dark-surface border-t border-neutral-200 dark:border-dark-border">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Ready to get started?</h2>
            <p className="text-neutral-400 mb-8">Join GH Motive and manage your vehicle operations with full transparency.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/register" className="inline-flex items-center justify-center px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-neutral-100 transition-colors text-sm">
                Create Account
              </Link>
              <Link href="/drivers" className="inline-flex items-center justify-center px-6 py-3 border border-neutral-200 dark:border-dark-border text-neutral-300 font-medium rounded-xl hover:bg-chalk dark:hover:bg-dark-elevated transition-colors text-sm">
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
