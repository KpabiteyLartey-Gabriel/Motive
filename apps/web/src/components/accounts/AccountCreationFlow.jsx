'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { accountsApi } from '@/lib/api';

const LABEL = { DRIVER: 'Driver', OWNER: 'Owner' };
const DASHBOARD = { DRIVER: '/driver/dashboard', OWNER: '/owner/dashboard' };

// Paid Driver/Owner account creation, in three steps:
// 1) confirm interest — one code sent to phone, email and in-app
// 2) pay the account creation charge (amount set by an admin)
// 3) account created on confirmed payment — email + in-app message
//    explain how to open the new dashboard.
export default function AccountCreationFlow({ kind, defaultPhone = '', onDone, onCancel }) {
  const label = LABEL[kind];
  const [step, setStep] = useState('send'); // send | confirm | pay | done
  const [order, setOrder] = useState(null);
  const [code, setCode] = useState('');
  const [payerPhone, setPayerPhone] = useState(defaultPhone || '');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const pollRef = useRef(null);

  const fail = (err, fallback) => {
    const msg = err.response?.data?.message || fallback;
    setError(Array.isArray(msg) ? msg.join(' ') : msg);
  };

  // Resume an in-progress order when the panel opens.
  useEffect(() => {
    let live = true;
    accountsApi.creationStatus(kind)
      .then((res) => {
        if (!live) return;
        const data = res.data?.data || res.data;
        if (data?.status === 'AWAITING_PAYMENT') { setOrder(data); setStep('pay'); }
        else if (data?.status === 'COMPLETED') { setOrder(data); setStep('done'); }
        else if (data?.amount) setOrder(data);
      })
      .catch(() => {});
    accountsApi.creationCharges()
      .then((res) => {
        if (!live) return;
        const charges = (res.data?.data || res.data)?.charges || [];
        const mine = charges.find((c) => c.kind === kind);
        if (mine) setOrder((o) => o || { amount: mine.amountGhs, currency: 'GHS' });
      })
      .catch(() => {});
    return () => { live = false; };
  }, [kind]);

  // While a payment is pending, poll until it lands.
  useEffect(() => {
    if (step !== 'pay' || !order || order.status === 'COMPLETED') return undefined;
    let tries = 0;
    pollRef.current = setInterval(async () => {
      tries += 1;
      if (tries > 20) { clearInterval(pollRef.current); return; }
      try {
        const res = await accountsApi.creationStatus(kind);
        const data = res.data?.data || res.data;
        if (data?.status === 'COMPLETED') {
          clearInterval(pollRef.current);
          setOrder(data);
          setStep('done');
          onDone?.(data);
        }
      } catch { /* keep polling */ }
    }, 4000);
    return () => clearInterval(pollRef.current);
  }, [step, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    setBusy('start'); setError(''); setNotice('');
    try {
      const res = await accountsApi.startCreation(kind);
      const data = res.data?.data || res.data;
      setOrder(data);
      setStep('confirm');
      setNotice(`Your code is on its way to ${(data.sentTo || []).join(', ') || 'your phone, email and notifications'}. It expires in 10 minutes.`);
    } catch (err) { fail(err, 'Could not send your code. Please try again.'); }
    finally { setBusy(''); }
  };

  const confirm = async () => {
    setBusy('confirm'); setError(''); setNotice('');
    try {
      const res = await accountsApi.confirmCreation(kind, code.trim());
      setOrder(res.data?.data || res.data);
      setStep('pay');
    } catch (err) { fail(err, 'That code did not work. Please try again.'); }
    finally { setBusy(''); }
  };

  const pay = async () => {
    setBusy('pay'); setError(''); setNotice('');
    try {
      const res = await accountsApi.payCreation(kind, { payerPhone: payerPhone.trim(), paymentMethod: 'MOMO' });
      const data = res.data?.data || res.data;
      setOrder(data);
      if (data?.status === 'COMPLETED') {
        setStep('done');
        onDone?.(data);
      } else if (data?.paymentStatus === 'FAILED') {
        setError('The payment failed. Check the number and try again.');
      } else {
        setNotice('Payment is processing. Approve the prompt on your phone if you get one — this page updates by itself when it lands.');
      }
    } catch (err) { fail(err, 'Could not start the payment. Please try again.'); }
    finally { setBusy(''); }
  };

  const amount = order?.amount != null ? `GHS ${Number(order.amount).toLocaleString('en-GH')}` : 'the account creation charge';

  return (
    <div className="space-y-4">
      <ol className="flex flex-wrap gap-2 text-xs font-semibold" aria-label="Progress">
        {[['send', '1. Confirm interest'], ['pay', '2. Pay'], ['done', '3. Account ready']].map(([key, text]) => {
          const state = key === step || (key === 'send' && step !== 'send') ? 'current' : 'todo';
          const doneState = (key === 'send' && step !== 'send') || (key === 'pay' && step === 'done');
          return (
            <li key={key} className={`rounded-full px-3 py-1.5 ${doneState ? 'bg-green-600 text-white' : state === 'current' ? 'bg-emerald-900 text-white dark:bg-emerald-700' : 'bg-neutral-200/80 text-steel dark:bg-dark-border dark:text-neutral-300'}`}>{text}</li>
          );
        })}
      </ol>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div>}
      {notice && <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm font-medium text-green-700 dark:text-green-400">{notice}</div>}

      {step === 'send' && (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-steel dark:text-neutral-400">
            Creating a {label} account costs a one-time <strong className="text-emerald-950 dark:text-white">{amount}</strong>.
            First we confirm it is really you asking: we send one code to your phone, your email and your in-app notifications.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={busy === 'start'} onClick={start} className="btn-primary">
              {busy === 'start' ? 'Sending…' : 'Send my code'}
            </button>
            <button type="button" onClick={onCancel} className="btn-graphite">Not now</button>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="space-y-3">
          <div>
            <label htmlFor="creation-code" className="label">6-digit code</label>
            <input
              id="creation-code"
              className="input max-w-xs text-center text-xl font-bold tracking-[0.35em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={busy === 'confirm' || code.length !== 6} onClick={confirm} className="btn-primary disabled:opacity-50">
              {busy === 'confirm' ? 'Checking…' : 'Confirm'}
            </button>
            <button type="button" disabled={busy === 'start'} onClick={start} className="btn-graphite">
              {busy === 'start' ? 'Sending…' : 'Send a new code'}
            </button>
          </div>
        </div>
      )}

      {step === 'pay' && (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-steel dark:text-neutral-400">
            Interest confirmed. Pay the one-time <strong className="text-emerald-950 dark:text-white">{amount}</strong> {label} account creation charge.
            Your {label} account is created the moment the payment is confirmed — not before.
          </p>
          <div>
            <label htmlFor="creation-phone" className="label">Mobile money number</label>
            <input id="creation-phone" className="input max-w-sm" type="tel" autoComplete="tel" placeholder="024 400 0000" value={payerPhone} onChange={(e) => setPayerPhone(e.target.value)} />
          </div>
          <button type="button" disabled={busy === 'pay' || payerPhone.trim().length < 7} onClick={pay} className="btn-primary disabled:opacity-50">
            {busy === 'pay' ? 'Starting payment…' : `Pay ${amount}`}
          </button>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-steel dark:text-neutral-400">
            Payment confirmed — your <strong className="text-emerald-950 dark:text-white">{label} account has been created</strong>.
            We have emailed you and sent an in-app notification with these same directions.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href={DASHBOARD[kind]} className="btn-primary">Open my {label} dashboard</Link>
          </div>
          <p className="text-xs leading-relaxed text-steel dark:text-neutral-500">
            If the dashboard does not open, sign out and sign back in — your new account loads on a fresh sign-in.
          </p>
        </div>
      )}
    </div>
  );
}
