'use client';

import { useState } from 'react';
import { WEEK_DAYS } from '@/lib/offDays';

// Off days, picked three ways:
// - particular days every week (Mon-Sun toggles)
// - particular single days (calendar date + Add)
// - a whole period off (from - to + Add)
// Value: { weekly: [], dates: [], periods: [{ from, to }] }
export default function OffDaysPicker({ value, onChange }) {
  const v = value || { weekly: [], dates: [], periods: [] };
  const [date, setDate] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [msg, setMsg] = useState('');

  const toggleDay = (day) => {
    const weekly = v.weekly.includes(day) ? v.weekly.filter((d) => d !== day) : [...v.weekly, day];
    onChange({ ...v, weekly });
  };

  const addDate = () => {
    if (!date) { setMsg('Pick a day from the calendar first.'); return; }
    if (v.dates.includes(date)) { setMsg('That day is already added.'); return; }
    setMsg('');
    onChange({ ...v, dates: [...v.dates, date].sort() });
    setDate('');
  };

  const addPeriod = () => {
    if (!from || !to) { setMsg('Pick both the start and end of the period.'); return; }
    if (to < from) { setMsg('The period must end after it starts.'); return; }
    setMsg('');
    onChange({ ...v, periods: [...v.periods, { from, to }] });
    setFrom('');
    setTo('');
  };

  const fmt = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  const fmtShort = (p) => `${new Date(`${p.from}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – ${new Date(`${p.to}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;

  return (
    <fieldset className="rounded-2xl border border-line bg-neutral-50/70 p-5 dark:border-dark-border dark:bg-dark-card">
      <legend className="px-1.5 text-sm font-semibold text-ink dark:text-white">Off days</legend>
      <p className="-mt-1 text-xs text-steel dark:text-neutral-400">Pick them below — weekly days, single days, or a whole period off.</p>
      {msg && <p role="alert" className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">{msg}</p>}

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-steel dark:text-neutral-400">Particular days every week</p>
        <div className="mt-2.5 grid grid-cols-7 gap-1.5" role="group" aria-label="Weekly off days">
          {WEEK_DAYS.map(([day, label]) => {
            const active = v.weekly.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                aria-pressed={active}
                className={`rounded-full py-2 text-center text-[13px] font-semibold transition ${
                  active
                    ? 'bg-brand-600 text-white'
                    : 'border border-line bg-white text-steel hover:text-ink dark:border-dark-border dark:bg-dark-surface dark:text-neutral-300 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 border-t border-line pt-5 dark:border-dark-border">
        <p className="text-xs font-semibold uppercase tracking-wide text-steel dark:text-neutral-400">Particular days</p>
        <div className="mt-2.5 flex max-w-md items-center gap-2">
          <input type="date" aria-label="Pick a particular off day" className="input flex-1" value={date} onChange={(e) => setDate(e.target.value)} />
          <button type="button" onClick={addDate} className="btn-graphite shrink-0 text-sm">Add day</button>
        </div>
        {v.dates.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {v.dates.map((d) => (
              <span key={d} className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 py-1.5 pl-3 pr-2 text-xs font-semibold text-brand-800 dark:bg-brand-950/50 dark:text-brand-200">
                {fmt(d)}
                <button type="button" aria-label={`Remove ${d}`} onClick={() => onChange({ ...v, dates: v.dates.filter((x) => x !== d) })} className="flex h-4 w-4 items-center justify-center rounded-full font-bold leading-none hover:bg-brand-100 dark:hover:bg-brand-900">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 border-t border-line pt-5 dark:border-dark-border">
        <p className="text-xs font-semibold uppercase tracking-wide text-steel dark:text-neutral-400">A period off</p>
        <div className="mt-2.5 grid max-w-xl grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
          <input type="date" aria-label="Period starts" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-sm text-steel dark:text-neutral-400">to</span>
          <input type="date" aria-label="Period ends" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          <button type="button" onClick={addPeriod} className="btn-graphite shrink-0 text-sm">Add period</button>
        </div>
        {v.periods.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {v.periods.map((p, i) => (
              <span key={`${p.from}-${p.to}-${i}`} className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 py-1.5 pl-3 pr-2 text-xs font-semibold text-brand-800 dark:bg-brand-950/50 dark:text-brand-200">
                {fmtShort(p)}
                <button type="button" aria-label="Remove period" onClick={() => onChange({ ...v, periods: v.periods.filter((_, x) => x !== i) })} className="flex h-4 w-4 items-center justify-center rounded-full font-bold leading-none hover:bg-brand-100 dark:hover:bg-brand-900">×</button>
              </span>
            ))}
          </div>
        )}
      </div>
    </fieldset>
  );
}
