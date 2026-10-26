import BankShell from '@/components/auth/BankShell';

// Sign-up / onboarding wizard on the Databank-style banking shell:
// stepper with labels only, one topic per screen, Back / Continue actions.
export default function OnboardingShell({ title, subtitle, steps = [], children, footer }) {
  const total = steps.length;

  return (
    <BankShell
      badge="GET STARTED"
      heroTitle="One account."
      heroAccent="More possibilities."
      heroText="Drive, own and earn — manage it all in one secure place."
      footer={footer}
    >
      {total > 0 && (
        <div className="mb-7">
          <ol className="flex items-start" aria-label="Sign-up progress">
            {steps.map((step, i) => (
              <li key={step.key} className={`flex items-center ${i < total - 1 ? 'flex-1' : ''}`}>
                <span aria-current={step.status === 'current' ? 'step' : undefined} className={`text-[11px] leading-tight ${step.status === 'todo' ? 'text-steel dark:text-neutral-500' : 'font-semibold text-ink dark:text-white'}`}>{step.label}</span>
                {i < total - 1 && <span aria-hidden="true" className="mx-3 h-px flex-1 bg-line dark:bg-dark-border" />}
              </li>
            ))}
          </ol>
        </div>
      )}
      {title && <h1 className="text-[28px] font-bold tracking-tight text-brand-950 dark:text-white">{title}</h1>}
      {subtitle && <p className="mt-1.5 text-sm leading-relaxed text-steel dark:text-neutral-400">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </BankShell>
  );
}

// Shared wizard footer actions: Back on the left, Continue on the right.
export function WizardActions({ onBack, backLabel = 'Back', children }) {
  return (
    <div className="mt-6 flex items-center gap-3">
      {onBack && (
        <button type="button" onClick={onBack} className="rounded-full border border-line bg-white px-5 py-3 text-sm font-semibold text-steel transition hover:bg-mist hover:text-ink dark:border-dark-border dark:bg-dark-card dark:text-neutral-300 dark:hover:text-white">
          {backLabel}
        </button>
      )}
      <div className="flex-1">{children}</div>
    </div>
  );
}
