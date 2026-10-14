import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export const metadata = {
  title: 'For Companies — GH Motive',
  description: 'Run a commercial fleet, manage drivers, automate payments and track every vehicle — GH Motive is built for transport companies.',
};

const features = [
  {
    title: 'Multi-Vehicle Fleet Management',
    description: 'Register and manage your entire fleet from one dashboard. View vehicle status, assigned drivers, active contracts and service history at a glance.',
  },
  {
    title: 'Driver Assignment & Monitoring',
    description: 'Assign drivers to vehicles with formal contracts. Track payment reliability, performance and activity for every driver in your company.',
  },
  {
    title: 'Automated Payment Processing',
    description: 'All driver payments flow through MTN MoMo with automatic ledger entries, receipts and overdue alerts — reducing manual work for your finance team.',
  },
  {
    title: 'Revenue & Expense Tracking',
    description: 'Log and categorize company revenues and expenses per vehicle. Generate reports that give you clear visibility into fleet profitability.',
  },
  {
    title: 'Contract Management',
    description: 'Create standardized contracts from templates. Every agreement is stored digitally with a full audit history — signed, versioned and enforceable.',
  },
  {
    title: 'Maintenance Scheduling',
    description: 'Track service intervals, schedule maintenance jobs and log repairs. Get alerts before vehicles miss service dates and view full service histories.',
  },
  {
    title: 'Dispute Resolution',
    description: 'Manage driver disputes formally on the platform. Submit evidence, communicate through the system and record resolutions with a complete case history.',
  },
  {
    title: 'Reports & Analytics',
    description: 'Generate earnings, expense, payment and utilization reports across your entire fleet. Make operational decisions with real data.',
  },
  {
    title: 'Role-Based Access',
    description: 'Assign company staff to roles with appropriate permissions — administrators, fleet managers, finance officers and operations staff each see what they need.',
  },
];

const companyTypes = [
  {
    name: 'Transport Companies',
    description: 'Commercial operators running multiple vehicles. Manage your entire fleet, driver roster and payment operations from one unified platform.',
  },
  {
    name: 'Fleet Management Companies',
    description: 'Companies managing vehicles on behalf of other owners. Operate under formal fleet agreements with clearly defined management fees and responsibilities.',
  },
  {
    name: 'Maintenance Providers',
    description: 'Service centres and independent mechanics. Receive maintenance jobs, submit invoices and log service records directly to the vehicle history.',
  },
];

export default function ForCompaniesPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg">
      <Navbar />
      <main className="pt-24">

        {/* Hero */}
        <section className="py-20 bg-white dark:bg-dark-bg">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-sm font-medium text-neutral-500 uppercase tracking-widest mb-3">For Companies</p>
            <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-5">
              Run your commercial fleet from one platform
            </h1>
            <p className="text-lg text-neutral-400 leading-relaxed">
              GH Motive gives transport companies the infrastructure to manage fleets,
              drivers, contracts, payments and maintenance — with full audit trails at every step.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/register?role=company" className="inline-flex items-center justify-center px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-neutral-100 transition-colors text-sm">
                Register Company
              </Link>
              <Link href="/how-it-works" className="inline-flex items-center justify-center px-6 py-3 border border-neutral-200 dark:border-dark-border text-neutral-300 font-medium rounded-xl hover:bg-chalk dark:hover:bg-dark-elevated transition-colors text-sm">
                How It Works →
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 bg-chalk dark:bg-dark-surface border-t border-neutral-200 dark:border-dark-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <p className="text-sm font-medium text-neutral-500 uppercase tracking-widest mb-3">Platform Features</p>
              <h2 className="text-3xl font-bold text-white">Everything a fleet operator needs</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-dark-border rounded-2xl overflow-hidden">
              {features.map((feature, i) => (
                <div key={i} className="bg-chalk dark:bg-dark-surface p-8 hover:bg-dark-card transition-colors">
                  <h3 className="text-base font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-neutral-500 leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Company types */}
        <section className="py-20 bg-white dark:bg-dark-bg border-t border-neutral-200 dark:border-dark-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <p className="text-sm font-medium text-neutral-500 uppercase tracking-widest mb-3">Who it serves</p>
              <h2 className="text-3xl font-bold text-white">Built for the whole transport ecosystem</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {companyTypes.map((type) => (
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
            <h2 className="text-2xl font-bold text-white mb-4">Bring your fleet to GH Motive</h2>
            <p className="text-neutral-400 mb-8">Register your company and start managing your vehicles and drivers with full operational transparency.</p>
            <Link href="/register?role=company" className="inline-flex items-center justify-center px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-neutral-100 transition-colors text-sm">
              Register Your Company
            </Link>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
