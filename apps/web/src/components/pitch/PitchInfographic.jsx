const participants = [
  {
    role: 'Drivers',
    who: 'Licensed drivers — full-time, part-time, or side-hustle',
    does: 'Get a vehicle on Work & Pay, DriveOn, company rental or a company job; pay by MoMo and build a record.',
    gets: 'Work without capital, a path to ownership, licence-expiry alerts',
  },
  {
    role: 'Vehicle Owners',
    who: 'People with a car — often parked at home during their own job',
    does: 'List the car, monitor payments and location, use remote lock/engine control — or place it with a company.',
    gets: 'Profit from a parked asset, with every cedi and trip visible',
  },
  {
    role: 'Transport Companies',
    who: 'Businesses operating fleets — their own and owner-supplied cars',
    does: 'Onboard drivers, run Work & Pay / DriveOn / Rental, engage maintenance and legal, invite staff by email or phone.',
    gets: 'A full operating system: fleet, people, money and reports',
  },
  {
    role: 'Fleet Managers',
    who: 'Company staff invited to run the day-to-day fleet',
    does: 'List and assign vehicles, keep paperwork current, track and control vehicles, dispatch emergency help.',
    gets: 'Scoped control of exactly the fleet they manage',
  },
  {
    role: 'Maintenance Providers',
    who: 'Garages, mobile mechanics, detailers and wash services',
    does: 'Receive jobs with the vehicle\u2019s live location; fix, record and invoice — per service or by subscription.',
    gets: 'Steady work, clear job records, recorded payments',
  },
  {
    role: 'Legal Professionals',
    who: 'Lawyers engaged per deal or retained by companies',
    does: 'Witness contracts on recorded voice/video calls, facilitate terms, sign digitally and hold copies for all parties.',
    gets: 'Paid witnessing and contract work, with evidence on file',
  },
];

const moneyFlow = [
  { step: 'Driver pays', detail: 'Instalment or daily sales by MTN MoMo' },
  { step: '+Motive ledger', detail: 'Receipted instantly; duplicates never double-post' },
  { step: 'Automatic split', detail: 'Owner share · company share · platform fee · deductions' },
  { step: 'Everyone sees it', detail: 'Statements and balances confirmed by the backend' },
];

const trustLayer = [
  'Witnessed digital contracts',
  'Complete audit trail',
  'Licence & document expiry alerts',
  'Live tracking, speed & remote engine control',
  'Recorded dispute timelines',
  'Identical contract copies for every party',
];

export default function PitchInfographic() {
  return (
    <>
      {/* Ecosystem infographic */}
      <section id="participants" className="scroll-mt-24 bg-[#F6F8F7] py-16 lg:py-24 dark:bg-dark-surface">
        <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="section-label">Who is on +Motive</p>
            <h2 className="section-title mt-2">Six participants, one connected platform</h2>
            <p className="section-subtitle mt-3">
              Investment promotion and job creation for Ghana&apos;s transport sector — every participant works from the same contracts, payments and vehicle records, on web and mobile.
            </p>
          </div>

          <div data-reveal className="mt-10 rounded-[20px] bg-ink px-6 py-5 text-center shadow-lift dark:bg-dark-card">
            <p className="text-base font-semibold text-white">+Motive at the centre</p>
            <p className="mt-1 text-sm text-brand-100/75">Contracts · MoMo payments &amp; ledger · Tracking &amp; remote control · Documents · Audit trail</p>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {participants.map((p, i) => (
              <article key={p.role} data-reveal style={{ '--reveal-delay': `${(i % 3) * 90}ms` }} id={p.role.toLowerCase().replace(/[^a-z]+/g, '-').replace(/(^-|-$)/g, '')} className="scroll-mt-24 rounded-card border border-line bg-white p-6 shadow-card transition hover:border-brand-200 hover:shadow-lift dark:border-dark-border dark:bg-dark-card">
                <h3 className="text-base font-semibold text-ink dark:text-white">{p.role}</h3>
                <p className="mt-1 text-[13px] font-medium text-brand-700 dark:text-brand-300">{p.who}</p>
                <p className="mt-3 text-sm leading-relaxed text-steel dark:text-neutral-400">{p.does}</p>
                <p className="mt-3 border-t border-line pt-3 text-sm font-medium text-ink-soft dark:border-dark-border dark:text-neutral-200">
                  <span className="text-brand-700 dark:text-brand-300">Gets: </span>{p.gets}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Money flow + trust infographic */}
      <section className="bg-white py-16 lg:py-24 dark:bg-dark-bg">
        <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="section-label">How the money moves</p>
            <h2 className="section-title mt-2">Collected once, split fairly, visible to all</h2>
          </div>
          <ol className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {moneyFlow.map((m, i) => (
              <li key={m.step} data-reveal style={{ '--reveal-delay': `${i * 110}ms` }} className="relative rounded-card border border-line bg-white p-6 shadow-card dark:border-dark-border dark:bg-dark-card">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white shadow-sm">{i + 1}</span>
                <h3 className="mt-4 text-[15px] font-semibold text-ink dark:text-white">{m.step}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-steel dark:text-neutral-400">{m.detail}</p>
                {i < moneyFlow.length - 1 && (
                  <span className="absolute -right-3 top-8 hidden text-xl font-bold text-brand-500 lg:block" aria-hidden="true">→</span>
                )}
              </li>
            ))}
          </ol>

          <div data-reveal className="mt-10 rounded-[20px] border border-line bg-[#F6F8F7] p-6 sm:p-8 dark:border-dark-border dark:bg-dark-surface">
            <h3 className="text-base font-semibold text-ink dark:text-white">The trust layer under every deal</h3>
            <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {trustLayer.map((t) => (
                <li key={t} className="flex items-center gap-2.5 text-sm font-medium text-ink-soft dark:text-neutral-200">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white" aria-hidden="true">✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
