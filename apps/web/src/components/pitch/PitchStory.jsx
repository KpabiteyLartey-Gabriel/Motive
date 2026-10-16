'use client';

import { useEffect, useRef, useState } from 'react';

const SCENE_MS = 6500;

const scenes = [
  {
    kicker: 'The problem',
    title: 'Cars parked. Drivers idle. Deals on trust alone.',
    narration:
      'Across Ghana, owners have cars sitting at home while licensed drivers look for work. When they do agree, it is verbal — no contract, no payment record, no way to prove anything when it goes wrong.',
    points: ['Parked cars earning nothing', 'Verbal work-and-pay deals', 'Lost payments, endless disputes'],
  },
  {
    kicker: 'Drivers get work',
    title: 'A licence becomes a livelihood.',
    narration:
      'A licensed driver signs up — licence verified and monitored for expiry — and finds a vehicle: work and pay towards owning it, drive-on for daily income, a company rental, or a full-time company job. Availability is a toggle; the record they build follows them.',
    points: ['Work & Pay → own the car', 'DriveOn & company rentals', 'Licence expiry monitored'],
  },
  {
    kicker: 'Owners earn',
    title: 'Your parked car becomes an investment.',
    narration:
      'An owner lists a car for drive-on or work and pay, watches every MoMo payment arrive, tracks the vehicle live, and can lock it or switch off the engine from the phone. Or hand it to a company — and watch the same numbers while they operate it.',
    points: ['Every payment, receipted', 'Live tracking & remote control', 'Or let a company run it for you'],
  },
  {
    kicker: 'Companies run fleets',
    title: 'One dashboard for cars you own — and cars you manage.',
    narration:
      'Transport companies onboard drivers, assign vehicles, and manage owner-supplied cars alongside their own. Fleet managers run the day-to-day: listings, documents, tracking, remote control, and emergency dispatch — every owner seeing exactly what their car earned.',
    points: ['Invite staff by email or phone', 'Mixed fleets, separate owner statements', 'Fleet managers with scoped access'],
  },
  {
    kicker: 'Help & law, on call',
    title: 'A breakdown or a contract is never a phone-call scramble.',
    narration:
      'A driver raises a breakdown with a voice or video report and live location — maintenance is dispatched to the spot. And every deal can be witnessed by a legal professional on a recorded call, signed digitally, with an identical copy for everyone.',
    points: ['Maintenance to your live location', 'Per-service or subscription care', 'Witnessed, digitally signed contracts'],
  },
  {
    kicker: 'Money & trust',
    title: 'Every cedi split, receipted and auditable.',
    narration:
      '+Motive collects by MTN MoMo and splits each payment automatically — owner share, company share, platform fee — into a ledger nobody can quietly edit. Six participants, one connected platform, zero verbal agreements.',
    points: ['MoMo collections & auto-splits', 'Receipts and statements for all', 'A complete audit trail'],
  },
];

export default function PitchStory() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const timer = useRef(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPlaying(false);
  }, []);

  useEffect(() => {
    if (!playing) return undefined;
    timer.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          setIndex((i) => (i + 1) % scenes.length);
          return 0;
        }
        return p + 100 / (SCENE_MS / 100);
      });
    }, 100);
    return () => clearInterval(timer.current);
  }, [playing]);

  const go = (i) => {
    setIndex(i);
    setProgress(0);
  };

  const scene = scenes[index];

  return (
    <section className="bg-white px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24 dark:bg-dark-bg" aria-label="+Motive pitch presentation">
      <div data-reveal className="mx-auto max-w-page overflow-hidden rounded-[24px] bg-ink shadow-lift dark:bg-dark-surface">
        <div className="flex items-center justify-between gap-3 px-6 pt-6 sm:px-10">
          <p className="text-sm font-semibold text-brand-300">+Motive — the pitch, in six scenes</p>
          <button
            type="button"
            onClick={() => setPlaying((v) => !v)}
            className="btn-ghost-light min-h-[40px] px-4 py-2 text-[13px]"
            aria-label={playing ? 'Pause the pitch' : 'Play the pitch'}
          >
            {playing ? '❚❚ Pause' : '▶ Play'}
          </button>
        </div>

        <div className="grid gap-8 px-6 py-8 sm:px-10 lg:grid-cols-[1.1fr_0.9fr] lg:py-10">
          <div key={`text-${index}`}>
            <p className="text-[13px] font-semibold text-brand-300">
              Scene {index + 1} of {scenes.length} · {scene.kicker}
            </p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">{scene.title}</h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-brand-100/80">{scene.narration}</p>
          </div>
          <ul key={`points-${index}`} className="flex flex-col justify-center gap-3">
            {scene.points.map((point) => (
              <li key={point} className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3.5 text-[15px] font-medium text-white">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white" aria-hidden="true">✓</span>
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div className="px-6 pb-6 sm:px-10 sm:pb-8">
          <div className="flex gap-2" role="tablist" aria-label="Pitch scenes">
            {scenes.map((s, i) => (
              <button
                key={s.kicker}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Scene ${i + 1}: ${s.kicker}`}
                onClick={() => go(i)}
                className="group flex-1 py-2"
              >
                <span className="block h-1.5 overflow-hidden rounded-full bg-white/15">
                  <span
                    className="block h-full rounded-full bg-brand-500"
                    style={{ width: i < index ? '100%' : i === index ? `${progress}%` : '0%' }}
                  />
                </span>
                <span className={`mt-2 hidden text-xs font-medium sm:block ${i === index ? 'text-white' : 'text-brand-100/50 group-hover:text-brand-100'}`}>
                  {s.kicker}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4 flex justify-between">
            <button type="button" onClick={() => go((index - 1 + scenes.length) % scenes.length)} className="btn-ghost-light min-h-[40px] px-4 py-2 text-[13px]">← Previous</button>
            <button type="button" onClick={() => go((index + 1) % scenes.length)} className="btn-ghost-light min-h-[40px] px-4 py-2 text-[13px]">Next →</button>
          </div>
        </div>
      </div>
    </section>
  );
}
