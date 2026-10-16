import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export const metadata = {
  title: 'Privacy Policy — +Motive',
  description: 'How +Motive (+Motive) collects, uses and protects your information.',
};

const sections = [
  {
    title: 'Information we collect',
    body: 'Account details (name, email, phone), identity and driving-licence details for drivers, vehicle and document details for owners and companies, contract and payment records, vehicle location and tracker data, maintenance and legal-service records, and messages or recordings you submit when raising an incident or witnessing a contract.',
  },
  {
    title: 'Why we use it',
    body: 'To verify participants, create and enforce contracts, collect and split payments, monitor licences and vehicle documents, provide tracking and remote-control features, dispatch maintenance and legal help, resolve disputes, and keep a complete audit trail for everyone involved in a deal.',
  },
  {
    title: 'Location and recordings',
    body: 'Vehicle location is shared only with participants connected to that vehicle (owner, company, fleet manager, assigned driver) and, when you choose, through a time-limited link or with a maintenance provider attending your vehicle. Voice or video recordings you submit for incidents or contract witnessing are attached to that record and visible to its parties.',
  },
  {
    title: 'Sharing',
    body: 'We share information only with the other parties to your contracts and services, with payment providers (such as MTN MoMo) to process transactions, and where required by law. We do not sell personal information.',
  },
  {
    title: 'Your choices',
    body: 'You can review and update your profile in your portal settings, manage your account status, and request correction of your records by contacting us. Some contract, payment and audit records must be retained so every party keeps an accurate history.',
  },
  {
    title: 'Contact',
    body: 'Questions about this policy: hello@ghmotive.com.gh.',
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg">
      <Navbar />
      <main className="pt-24">
        <section className="bg-white py-16 lg:py-24 dark:bg-dark-bg">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <p className="section-label">Legal</p>
            <h1 className="mt-3 text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl dark:text-white">Privacy Policy</h1>
            <p className="mt-5 text-lg leading-relaxed text-steel dark:text-neutral-400">
              How +Motive collects, uses and protects information for drivers, owners, companies, fleet managers, maintenance providers and legal professionals.
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
