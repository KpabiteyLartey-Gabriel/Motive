import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export const metadata = {
  title: 'Contact — +Motive',
  description: 'Talk to the +Motive team — drivers, vehicle owners, transport companies, fleet managers, maintenance providers and legal professionals.',
};

const routes = [
  { who: 'Drivers', detail: 'Getting licensed and verified, finding a vehicle, Work & Pay, DriveOn or a company job.', href: '/drivers', cta: 'For Drivers' },
  { who: 'Vehicle Owners', detail: 'Listing a car, placing it with a company, payments, tracking and remote control.', href: '/owners', cta: 'For Owners' },
  { who: 'Transport Companies', detail: 'Registering your company, inviting staff and drivers, and running mixed fleets.', href: '/companies', cta: 'For Companies' },
  { who: 'Fleet Managers', detail: 'You join through your company\u2019s invite — your admin sends you the link to onboard into your portal.', href: '/how-it-works#fleet-managers', cta: 'See Fleet Managers' },
  { who: 'Maintenance Providers', detail: 'Listing your services, per-service and subscription work, and getting jobs with live locations.', href: '/how-it-works#maintenance-providers', cta: 'See Maintenance Providers' },
  { who: 'Legal Professionals', detail: 'Witnessing contracts, facilitating deals and monitoring vehicle paperwork for clients.', href: '/how-it-works#legal-professionals', cta: 'See Legal Professionals' },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg">
      <Navbar />
      <main className="pt-24">
        <section className="bg-white py-16 lg:py-24 dark:bg-dark-bg">
          <div className="anim-fade-up mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <p className="section-label">Contact</p>
            <h1 className="mt-3 text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl dark:text-white">
              Talk to us
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-steel dark:text-neutral-400">
              Tell us who you are and we will point you to the right workspace. Email us at{' '}
              <a href="mailto:hello@ghmotive.com.gh" className="font-semibold text-brand-700 underline-offset-4 hover:underline dark:text-brand-300">hello@ghmotive.com.gh</a>{' '}
              or start below.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/register" className="btn-primary px-6 text-[15px]">Create free account</Link>
              <Link href="/login" className="btn-ghost px-6 text-[15px]">Sign In</Link>
            </div>
          </div>
        </section>

        <section className="bg-[#F6F8F7] py-16 lg:py-24 dark:bg-dark-surface">
          <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <p className="section-label">Who are you?</p>
              <h2 className="section-title mt-2">Start from your side of the platform</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {routes.map((r, i) => (
                <article key={r.who} data-reveal style={{ '--reveal-delay': `${(i % 3) * 90}ms` }} className="flex flex-col rounded-card border border-line bg-white p-6 shadow-card transition hover:border-brand-200 hover:shadow-lift dark:border-dark-border dark:bg-dark-card">
                  <h3 className="text-base font-semibold text-ink dark:text-white">{r.who}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-steel dark:text-neutral-400">{r.detail}</p>
                  <Link href={r.href} className="btn-ghost mt-6 w-full">{r.cta}</Link>
                </article>
              ))}
            </div>
            <p className="mt-8 text-center text-sm text-steel dark:text-neutral-400">
              Already have an account? <Link href="/login" className="font-semibold text-brand-700 underline-offset-4 hover:underline dark:text-brand-300">Sign in</Link> and use the support options inside your portal.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
