'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import OnboardingShell, { WizardActions } from '@/components/auth/OnboardingShell';
import { driversApi, onboardingApi } from '@/lib/api';
import { formatGhanaCardInput, GHANA_CARD_HINT } from '@/lib/ghanaCard';

const STEP_LABELS = {
  account: 'Create account',
  accountType: 'Account type',
  nationalId: 'National ID',
  licence: "Driver's licence",
};

function StatusPill({ status }) {
  if (status === 'VERIFIED') return <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-xs font-semibold text-green-700 dark:text-green-400">Verified</span>;
  if (status === 'PENDING_REVIEW') return <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">In review</span>;
  return <span className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-steel dark:border-dark-border dark:text-neutral-400">Not submitted</span>;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [viewStep, setViewStep] = useState(null);
  const [accountType, setAccountType] = useState('');
  const [ghanaCard, setGhanaCard] = useState('');
  const [licence, setLicence] = useState({ licenseNumber: '', licenseClass: 'Class B', licenseExpiryDate: '' });
  const [licenceFile, setLicenceFile] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await onboardingApi.me();
      const data = res.data?.data || res.data;
      setState(data);
      setAccountType(data.accountType || '');
      setGhanaCard(data.nationalId?.ghanaCardNumber || '');
      if (data.licence) {
        setLicence({
          licenseNumber: data.licence.licenseNumber || '',
          licenseClass: data.licence.licenseClass || 'Class B',
          licenseExpiryDate: data.licence.licenseExpiryDate ? String(data.licence.licenseExpiryDate).slice(0, 10) : '',
        });
      }
      const stored = JSON.parse(localStorage.getItem('gh_motive_user') || '{}');
      if (stored.primaryRole && !['PENDING', 'DRIVER', 'OWNER'].includes(stored.primaryRole)) {
        router.replace('/login');
      }
    } catch (err) {
      if (err.response?.status === 401) router.replace('/login');
      else setError('Could not load your onboarding progress. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!localStorage.getItem('gh_motive_access_token')) { router.replace('/login'); return; }
    load();
  }, [load, router]);

  const run = async (key, fn, success) => {
    setBusy(key); setError(''); setNotice('');
    try {
      const res = await fn();
      const data = res.data?.data || res.data;
      setState(data);
      setViewStep(null);
      if (data.accountType) {
        const stored = JSON.parse(localStorage.getItem('gh_motive_user') || '{}');
        localStorage.setItem('gh_motive_user', JSON.stringify({ ...stored, primaryRole: data.accountType }));
      }
      if (success) setNotice(success);
      return data;
    } catch (err) {
      const message = err.response?.data?.message || 'Something went wrong. Please try again.';
      setError(Array.isArray(message) ? message.join(' ') : message);
      return null;
    } finally {
      setBusy('');
    }
  };

  const chooseType = () => {
    if (!accountType) { setError('Choose Driver or Vehicle Owner to continue.'); return; }
    run('type', () => onboardingApi.setAccountType(accountType));
  };

  const submitId = () => run('id', () => onboardingApi.submitNationalId(ghanaCard.trim()));

  const submitLicence = async () => {
    const data = await run('licence', () => onboardingApi.submitDriverLicence({
      licenseNumber: licence.licenseNumber.trim(),
      licenseClass: licence.licenseClass || undefined,
      licenseExpiryDate: licence.licenseExpiryDate || undefined,
    }));
    if (data && licenceFile) {
      try { await driversApi.uploadDocument(licenceFile, 'LICENSE', licence.licenseExpiryDate || undefined); }
      catch { setNotice("Licence details saved. The photo did not upload — you can add it later in Settings."); }
    }
  };

  if (loading) {
    return (
      <OnboardingShell title="Finish setting up your account" subtitle="Loading your progress…" steps={[]}>
        <div className="skeleton h-64" aria-label="Loading onboarding" />
      </OnboardingShell>
    );
  }

  const serverSteps = state?.steps || [];
  const done = !!state?.completed;
  const screen = viewStep || (done || state?.nextStep === 'review' || state?.nextStep === 'done' ? 'done' : state?.nextStep);
  const shellSteps = serverSteps.map((s) => ({
    key: s.key,
    label: STEP_LABELS[s.key] || s.label,
    status: done || s.done ? 'done' : s.key === screen ? 'current' : 'todo',
  }));
  if (done && shellSteps.length && shellSteps.every((s) => s.status !== 'current')) {
    // Completion screen: show the last step as current-complete context.
    shellSteps[shellSteps.length - 1].status = 'done';
  }

  const primaryBtn = 'btn-primary w-full text-[15px]';

  return (
    <OnboardingShell
      title={screen === 'done' ? 'You are all set' : 'Finish setting up'}
      steps={shellSteps}
    >
      {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div>}
      {notice && <div className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm font-medium text-green-700 dark:text-green-400">{notice}</div>}

      {/* Step 2: account type */}
      {screen === 'accountType' && (
        <div>
          <h2 className="text-lg font-semibold text-ink dark:text-white">Account type</h2>
          <fieldset className="mt-5">
            <legend className="sr-only">Account type</legend>
            <div className="grid gap-2" role="radiogroup" aria-label="Account type">
              {[
                { value: 'DRIVER', label: 'Driver', description: 'I drive, or want to drive, a vehicle and earn from it' },
                { value: 'OWNER', label: 'Vehicle Owner', description: 'I own vehicles and want drivers to work with them' },
              ].map((role) => {
                const selected = accountType === role.value;
                return (
                  <label key={role.value} className={`flex min-h-[56px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${selected ? 'border-brand-600 bg-brand-50 ring-4 ring-brand-500/10 dark:bg-brand-950' : 'border-line bg-white hover:border-brand-300 dark:border-dark-border dark:bg-dark-card'}`}>
                    <input type="radio" name="accountType" value={role.value} checked={selected} onChange={() => setAccountType(role.value)} className="h-5 w-5 shrink-0 accent-emerald-600" />
                    <span><span className="block text-sm font-semibold text-ink dark:text-white">{role.label}</span><span className="block text-[13px] text-steel dark:text-neutral-400">{role.description}</span></span>
                    {selected && <span className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white" aria-hidden="true">✓</span>}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <WizardActions>
            <button type="button" disabled={busy === 'type'} onClick={chooseType} className={primaryBtn} aria-busy={busy === 'type'}>{busy === 'type' ? 'Saving…' : 'Continue'}</button>
          </WizardActions>
        </div>
      )}

      {/* Step 3: National ID */}
      {screen === 'nationalId' && (
        <div>
          <h2 className="text-lg font-semibold text-ink dark:text-white">National ID</h2>
          <div className="mt-5">
            <label htmlFor="ghanaCard" className="label">Ghana Card number</label>
            <input id="ghanaCard" className="input" placeholder="GHA-123456789-0" maxLength={15} value={ghanaCard} onChange={(e) => setGhanaCard(formatGhanaCardInput(e.target.value))} autoComplete="off" />
            <p className="mt-1 text-xs text-steel dark:text-neutral-500">{GHANA_CARD_HINT}</p>
          </div>
          <WizardActions onBack={() => { setError(''); setViewStep('accountType'); }}>
            <button type="button" disabled={busy === 'id' || !/^GHA-\d{9}-\d$/.test(ghanaCard.trim())} onClick={submitId} className={primaryBtn} aria-busy={busy === 'id'}>{busy === 'id' ? 'Submitting…' : 'Continue'}</button>
          </WizardActions>
        </div>
      )}

      {/* Step 4 (drivers): licence */}
      {screen === 'licence' && (
        <div>
          <h2 className="text-lg font-semibold text-ink dark:text-white">Driver&apos;s Licence</h2>
          <div className="mt-5 space-y-4">
            <div>
              <label htmlFor="licenseNumber" className="label">Driver&apos;s Licence number</label>
              <input id="licenseNumber" className="input" placeholder="GH-123456789" value={licence.licenseNumber} onChange={(e) => setLicence({ ...licence, licenseNumber: e.target.value })} autoComplete="off" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="licenseClass" className="label">Licence class</label>
                <select id="licenseClass" className="input" value={licence.licenseClass} onChange={(e) => setLicence({ ...licence, licenseClass: e.target.value })}>
                  {['Class A', 'Class B', 'Class C', 'Class D', 'Class E', 'Class F'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="licenseExpiry" className="label">Expiry date</label>
                <input id="licenseExpiry" type="date" className="input" value={licence.licenseExpiryDate} onChange={(e) => setLicence({ ...licence, licenseExpiryDate: e.target.value })} />
              </div>
            </div>
            <div>
              <label htmlFor="licencePhoto" className="label">Licence photo (optional, helps verification)</label>
              <input id="licencePhoto" type="file" accept="image/*,application/pdf" className="input" onChange={(e) => setLicenceFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <WizardActions onBack={() => { setError(''); setViewStep('nationalId'); }}>
            <button type="button" disabled={busy === 'licence' || licence.licenseNumber.trim().length < 4} onClick={submitLicence} className={primaryBtn} aria-busy={busy === 'licence'}>{busy === 'licence' ? 'Submitting…' : 'Continue'}</button>
          </WizardActions>
        </div>
      )}

      {/* Completion */}
      {screen === 'done' && state && (
        <div>
          <div className="flex flex-col items-center py-2 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            </span>
            <h2 className="mt-4 text-lg font-semibold text-ink dark:text-white">{state.verified ? 'Verified' : 'Submitted'}</h2>
            {!state.verified && <p className="mt-1 text-sm text-steel dark:text-neutral-400">Under review.</p>}
          </div>
          <div className="mt-4 space-y-2 rounded-xl border border-line p-4 dark:border-dark-border">
            <div className="flex items-center justify-between gap-3"><span className="text-sm text-steel dark:text-neutral-400">National ID</span><StatusPill status={state.nationalId.status} /></div>
            {state.licence && <div className="flex items-center justify-between gap-3"><span className="text-sm text-steel dark:text-neutral-400">Driver&apos;s Licence</span><StatusPill status={state.licence.status} /></div>}
            <div className="flex items-center justify-between gap-3"><span className="text-sm text-steel dark:text-neutral-400">Account type</span><span className="text-sm font-semibold text-ink dark:text-white">{state.accountType === 'OWNER' ? 'Vehicle Owner' : 'Driver'}</span></div>
          </div>
          <WizardActions>
            <button type="button" onClick={() => router.push(state.dashboardPath)} className={primaryBtn}>Go to my dashboard</button>
          </WizardActions>
          {!state.verified && state.accountType === 'DRIVER' && state.licence?.status === 'NOT_SUBMITTED' && (
            <button type="button" onClick={() => setViewStep('licence')} className="mt-3 w-full text-center text-[13px] font-semibold text-brand-700 hover:underline dark:text-brand-300">Add your Driver&apos;s Licence now</button>
          )}
        </div>
      )}
    </OnboardingShell>
  );
}
