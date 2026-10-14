import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export const metadata = {
  title: 'For Drivers — GH Motive',
  description: 'Drive with confidence. GH Motive gives drivers transparent contracts, clear payment schedules and a complete record of every transaction.',
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
        <section className="py-20 bg-white dark:bg-dark-bg">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-sm font-medium text-neutral-500 uppercase tracking-widest mb-3">For Drivers</p>
            <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-5">
              Drive with full transparency
            </h1>
            <p className="text-lg text-neutral-400 leading-relaxed">
              GH Motive gives drivers clear contracts, real-time payment tracking and a complete
              record of every transaction — so you always know exactly where you stand.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/register?role=driver" className="inline-flex items-center justify-center px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-neutral-100 transition-colors text-sm">
                Join as Driver
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
              <h2 className="text-3xl font-bold text-white">Built to protect drivers</h2>
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
              <p className="text-sm font-medium text-neutral-500 uppercase tracking-widest mb-3">Contract Options</p>
              <h2 className="text-3xl font-bold text-white">Choose the arrangement that suits you</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {contractTypes.map((type) => (
                <div key={type.name} className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-6 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-white">{type.name}</h3>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-chalk dark:bg-dark-elevated border border-neutral-200 dark:border-dark-border text-neutral-400">{type.tag}</span>
                  </div>
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
            <h2 className="text-2xl font-bold text-white mb-4">Ready to drive with GH Motive?</h2>
            <p className="text-neutral-400 mb-8">Create your free driver account and get matched with verified vehicles and contracts.</p>
            <Link href="/register?role=driver" className="inline-flex items-center justify-center px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-neutral-100 transition-colors text-sm">
              Create Driver Account
            </Link>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
