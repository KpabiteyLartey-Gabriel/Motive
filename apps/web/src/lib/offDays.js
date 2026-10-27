// Off days are picked, not typed. Stored on contract.terms as:
//   offDays: { weekly: ['MONDAY', ...], dates: ['2026-12-25'], periods: [{ from, to }] }
//   offDaysLabel: 'Every Sunday · 25 Dec 2026 · 24 Dec 2026 – 2 Jan 2027'
// Older contracts carry a plain string ('Sundays') — both shapes format here.
export const WEEK_DAYS = [
  ['MONDAY', 'Mon'], ['TUESDAY', 'Tue'], ['WEDNESDAY', 'Wed'], ['THURSDAY', 'Thu'],
  ['FRIDAY', 'Fri'], ['SATURDAY', 'Sat'], ['SUNDAY', 'Sun'],
];

const WEEK_LABEL = Object.fromEntries(WEEK_DAYS.map(([v, l]) => [v, l]));

function fmtDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function emptyOffDays() {
  return { weekly: [], dates: [], periods: [] };
}

export function hasOffDays(offDays) {
  if (!offDays) return false;
  if (typeof offDays === 'string') return offDays.trim().length > 0;
  return (offDays.weekly?.length || 0) + (offDays.dates?.length || 0) + (offDays.periods?.length || 0) > 0;
}

export function formatOffDays(offDays) {
  if (!offDays) return '';
  if (typeof offDays === 'string') return offDays;
  const parts = [];
  if (offDays.weekly?.length) {
    const ordered = WEEK_DAYS.map(([d]) => d).filter((d) => offDays.weekly.includes(d));
    parts.push(`Every ${ordered.map((d) => WEEK_LABEL[d] || d).join(', ')}`);
  }
  for (const d of offDays.dates || []) parts.push(fmtDate(d));
  for (const p of offDays.periods || []) {
    if (p?.from && p?.to) parts.push(`${fmtDate(p.from)} – ${fmtDate(p.to)}`);
    else if (p?.from) parts.push(`From ${fmtDate(p.from)}`);
  }
  return parts.join(' · ');
}
