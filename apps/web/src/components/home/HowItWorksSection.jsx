const steps = [
  { title: 'Register & verify', description: 'Sign up as a driver, owner or company and complete your profile.' },
  { title: 'Create or accept a contract', description: 'Agree Work & Pay, Rental or Driving On terms and accept digitally.' },
  { title: 'Assign the vehicle', description: 'The vehicle is linked to the driver and the contract goes active.' },
  { title: 'Pay with MoMo', description: 'Regular payments are recorded instantly, with a receipt every time.' },
  { title: 'Track progress together', description: 'Both sides see balances, earnings, trips and maintenance in real time.' },
  { title: 'Complete & transfer', description: 'Ownership transfer happens only through a separate verified workflow.' },
];

export default function HowItWorksSection() {
  return (
    <section className="bg-white py-16 lg:py-24 dark:bg-dark-bg">
      <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl" data-reveal>
          <p className="section-label">How it works</p>
          <h2 className="section-title mt-2">From sign-up to ownership, step by step</h2>
          <p className="section-subtitle mt-3">A transparent process both sides can follow — nothing hidden, nothing automatic without approval.</p>
        </div>
        <ol className="mt-12 grid gap-x-10 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.title} data-reveal style={{ '--reveal-delay': `${(i % 3) * 90}ms` }} className="flex gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white shadow-sm">{i + 1}</span>
              <span>
                <span className="block text-[15px] font-semibold text-ink dark:text-white">{step.title}</span>
                <span className="mt-1 block text-sm leading-relaxed text-steel dark:text-neutral-400">{step.description}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
