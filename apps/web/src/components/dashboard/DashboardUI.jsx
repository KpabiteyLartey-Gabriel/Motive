import { Icon } from '@/components/ui/Icon';

export function StatCard({ label, value, sub, icon, href }) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-steel dark:text-neutral-400">{label}</p>
        {icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
            <Icon name={icon} size={18} />
          </span>
        )}
      </div>
      <p className="money mt-2 text-[26px] font-semibold leading-none text-ink dark:text-white">{value}</p>
      {sub && <p className="mt-2 text-[13px] leading-snug text-steel dark:text-neutral-400">{sub}</p>}
    </>
  );
  const cls = 'block rounded-card border border-line bg-white p-5 shadow-card dark:border-dark-border dark:bg-dark-card dark:shadow-none';
  if (href) {
    const Link = require('next/link').default;
    return <Link href={href} className={`${cls} card-hover`}>{inner}</Link>;
  }
  return <div className={cls}>{inner}</div>;
}

export function SectionHeader({ title, description, action }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-ink dark:text-white">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-steel dark:text-neutral-400">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon = 'documents', title, description, action }) {
  return (
    <div className="rounded-card border border-dashed border-line bg-white px-6 py-10 text-center shadow-card dark:border-dark-border dark:bg-dark-card dark:shadow-none">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
        <Icon name={typeof icon === 'string' && icon.length <= 20 ? icon : 'documents'} size={22} />
      </span>
      <p className="mt-4 text-[15px] font-semibold text-ink dark:text-white">{title}</p>
      {description && <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-steel dark:text-neutral-400">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function ProgressBar({ value = 0, label }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div>
      {label && (
        <div className="mb-1.5 flex items-center justify-between text-[13px]">
          <span className="font-medium text-steel dark:text-neutral-400">{label}</span>
          <span className="money font-semibold text-ink dark:text-white">{Math.round(pct)}%</span>
        </div>
      )}
      <div className="h-2.5 overflow-hidden rounded-full bg-mist-deep dark:bg-dark-elevated" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-brand-500 transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Skeleton({ className = 'h-24' }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

const STATUS = {
  ACTIVE: ['bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-300', 'Active'],
  AVAILABLE: ['bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-300', 'Available'],
  SUCCESSFUL: ['bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-300', 'Successful'],
  VERIFIED: ['bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-300', 'Verified'],
  RESOLVED: ['bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-300', 'Resolved'],
  COMPLETED: ['bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-300', 'Completed'],
  PENDING: ['bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300', 'Pending'],
  PENDING_VERIFICATION: ['bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300', 'Pending verification'],
  PENDING_ACCEPTANCE: ['bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-300', 'Pending acceptance'],
  OPEN: ['bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300', 'Open'],
  UNDER_REVIEW: ['bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300', 'Under review'],
  PROCESSING: ['bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-300', 'Processing'],
  ASSIGNED: ['bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-300', 'Assigned'],
  MEDIATION: ['bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-300', 'Mediation'],
  FAILED: ['bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300', 'Failed'],
  SUSPENDED: ['bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300', 'Suspended'],
  ESCALATED: ['bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300', 'Escalated'],
  IN_DISPUTE: ['bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300', 'In dispute'],
  MAINTENANCE: ['bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300', 'Maintenance'],
  UNDER_MAINTENANCE: ['bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300', 'Under maintenance'],
};

export function StatusBadge({ status }) {
  const [cls, label] = STATUS[status] || ['bg-mist text-steel dark:bg-dark-elevated dark:text-neutral-300', (status || 'Unknown').replace(/_/g, ' ')];
  return (
    <span className={`badge ${cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  );
}

export function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div className="relative w-full sm:max-w-lg max-h-[88vh] overflow-y-auto rounded-t-2xl sm:rounded-card border border-line bg-white p-5 shadow-card dark:border-dark-border dark:bg-dark-card dark:shadow-none">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h3 className="text-base font-semibold tracking-tight text-ink dark:text-white">{title}</h3>
          <button onClick={onClose} aria-label="Close dialog" className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 text-lg leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
