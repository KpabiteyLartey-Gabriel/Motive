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
    description: 'Register and manage your entire fleet from one dashboard — company-owned vehicles and owner-supplied cars, each owner\u2019s earnings and statements kept separate. View status, assigned drivers, active contracts and service history at a glance.',
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
        <section className="bg-white py-16 lg:py-24 dark:bg-dark-bg">
          <div className="anim-fade-up mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <p className="section-label">For Companies</p>
            <h1 className="mt-3 text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl dark:text-white">
              Run your commercial fleet from one platform
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-steel dark:text-neutral-400">
              GH Motive gives transport companies the infrastructure to manage fleets,
              drivers, contracts, payments and maintenance — with full audit trails at every step.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/register?role=company" className="btn-primary px-6 text-[15px]">
                Register Company
              </Link>
              <Link href="/how-it-works" className="btn-ghost px-6 text-[15px]">
                How It Works →
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="bg-[#F6F8F7] py-16 lg:py-24 dark:bg-dark-surface">
          <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <p className="section-label">Platform Features</p>
              <h2 className="section-title mt-2">Everything a fleet operator needs</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, i) => (
                <article key={i} data-reveal style={{ '--reveal-delay': `${(i % 3) * 90}ms` }} className="rounded-card border border-line bg-white p-6 shadow-card transition hover:border-brand-200 hover:shadow-lift dark:border-dark-border dark:bg-dark-card">
                  <h3 className="text-base font-semibold text-ink dark:text-white">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-steel dark:text-neutral-400">{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Company types */}
        <section className="bg-white py-16 lg:py-24 dark:bg-dark-bg">
          <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <p className="section-label">Who it serves</p>
              <h2 className="section-title mt-2">Built for the whole transport ecosystem</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {companyTypes.map((type, i) => (
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
            <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">Bring your fleet to GH Motive</h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-brand-100/75">Register your company and start managing your vehicles and drivers with full operational transparency.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/register?role=company" className="btn-primary px-6 text-[15px]">
                Register Your Company
              </Link>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
