const items = [
  'Work & Pay',
  'DriveOn',
  'Company Rental',
  'MoMo payments, split automatically',
  'Live tracking',
  'Remote lock & engine control',
  'Witnessed digital contracts',
  'Licence & document expiry alerts',
  'Maintenance dispatched to your location',
  'A complete audit trail',
];

export default function Ticker() {
  const row = [...items, ...items];
  return (
    <div className="marquee overflow-hidden border-y border-line bg-[#F6F8F7] py-3.5 dark:border-dark-border dark:bg-dark-surface" aria-label="Platform capabilities">
      <div className="marquee-track flex w-max items-center gap-10 pr-10">
        {row.map((item, i) => (
          <span key={`${item}-${i}`} className="flex items-center gap-10 whitespace-nowrap text-sm font-semibold text-ink-soft dark:text-neutral-200" aria-hidden={i >= items.length}>
            {item}
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden="true" />
          </span>
        ))}
      </div>
    </div>
  );
}
