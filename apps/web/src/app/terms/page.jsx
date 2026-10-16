import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export const metadata = {
  title: 'Terms of Service — +Motive',
  description: 'The terms for using +Motive (+Motive): contracts, payments, tracking, maintenance and legal services.',
};

const sections = [
  {
    title: 'The platform',
    body: '+Motive connects drivers, vehicle owners, transport companies, fleet managers, maintenance providers and legal professionals. We provide the platform, records and payment rails; we do not own vehicles, employ drivers, or provide legal advice. The specific terms of each deal live in its contract.',
  },
  {
    title: 'Accounts and eligibility',
    body: 'Drivers must hold a valid driving licence, which is monitored for expiry. Companies manage their members through invites and are responsible for the access they grant. You are responsible for activity under your account and for keeping your details accurate.',
  },
  {
    title: 'Contracts',
    body: 'Work & Pay, DriveOn and company Rental agreements are created and signed on the platform, may be witnessed by a legal professional, and are stored so every party holds an identical copy. Ownership transfer after a completed Work & Pay contract follows a separate verified workflow and is never automatic.',
  },
  {
    title: 'Payments',
    body: 'Payments are collected through licensed payment providers (such as MTN MoMo) and split according to the contract. Fees and splits are shown before signing. Ledger records are the source of truth for balances, and disputed amounts are handled through the dispute process.',
  },
  {
    title: 'Tracking and remote control',
    body: 'Vehicles connected to the platform may be tracked, and authorised participants may issue remote commands (such as lock or engine off/on). Commands are audited, and safety limits apply — you must not use remote control in a way that endangers people or property.',
  },
  {
    title: 'Maintenance and legal services',
    body: 'Maintenance and legal services are provided by independent participants, per service or by subscription, on the terms agreed and recorded for each job. +Motive records the job, the agreement and the payment; the provider is responsible for delivery.',
  },
  {
    title: 'Acceptable use and disputes',
    body: 'Do not misuse the platform, another participant\u2019s vehicle, or their data. Disagreements should be raised as disputes on the platform, where evidence and decisions are recorded. These terms may be updated; continued use means you accept the current version.',
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg">
      <Navbar />
      <main className="pt-24">
        <section className="bg-white py-16 lg:py-24 dark:bg-dark-bg">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <p className="section-label">Legal</p>
            <h1 className="mt-3 text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl dark:text-white">Terms of Service</h1>
            <p className="mt-5 text-lg leading-relaxed text-steel dark:text-neutral-400">
              The terms for using +Motive — for every driver, owner, company, fleet manager, maintenance provider and legal professional on the platform.
            </p>
            <div className="mt-10 space-y-8">
              {sections.map((s) => (
                <div key={s.title}>
                  <h2 className="text-lg font-semibold text-ink dark:text-white">{s.title}</h2>
                  <p className="mt-2 leading-relaxed text-steel dark:text-neutral-400">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
