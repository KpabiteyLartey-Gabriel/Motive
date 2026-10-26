'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';

import { SectionHeader, EmptyState, StatusBadge } from '@/components/dashboard/DashboardUI';
import Link from 'next/link';
import { Modal } from '@/components/dashboard/DashboardUI';
import { contractsApi, marketplaceApi, vehiclesApi, resolveVehiclePhoto } from '@/lib/api';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtGHS(n) {
  if (n == null) return '—';
  return `GHS ${Number(n).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const TYPE_LABEL = { WORK_AND_PAY: 'Work & Pay', RENTAL: 'Rental', DRIVING_ON: 'Driving On' };
const GHANA_REGIONS = ['Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern', 'Greater Accra', 'North East', 'Northern', 'Oti', 'Savannah', 'Upper East', 'Upper West', 'Volta', 'Western', 'Western North'];

export default function OwnerContractsPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['OWNER'] });
  const [contracts, setContracts]   = useState([]);
  const [fetching, setFetching]     = useState(true);
  const [selected, setSelected]     = useState(null);
  const [approvedThreads, setApprovedThreads] = useState([]);
  const [startFor, setStartFor] = useState(null);
  const [terms, setTerms] = useState({ vehicleValue: '', depositAmount: '', totalPayable: '', installmentAmount: '', spread: 'duration', durationValue: '3', durationUnit: 'YEARS', dailySalesAmount: '', frequency: 'WEEKLY', gracePeriodDays: '3' });
  const [startBusy, setStartBusy] = useState(false);
  const [codes, setCodes] = useState({});
  const [codeBusy, setCodeBusy] = useState('');
  const [notice, setNotice] = useState('');
  // Direct (physically agreed) Work & Pay: private vehicle -> terms -> share.
  const [showPrivate, setShowPrivate] = useState(false);
  const [privateStep, setPrivateStep] = useState(1);
  const [privateVehicle, setPrivateVehicle] = useState(null);
  const [pv, setPv] = useState({ registrationNumber: '', make: '', model: '', year: new Date().getFullYear(), color: '', type: 'SEDAN', fuelType: 'PETROL', transmission: 'AUTOMATIC', mileage: '', region: '', address: '' });
  const [pvPhoto, setPvPhoto] = useState(null);
  const [pvPhotoPreview, setPvPhotoPreview] = useState('');
  const [pt, setPt] = useState({ totalPayable: '', depositAmount: '', installmentAmount: '', frequency: 'WEEKLY', gracePeriodDays: '3', offDays: '', maintenance: 'DRIVER' });
  const [privateModel, setPrivateModel] = useState('WORK_AND_PAY');
  const [dt, setDt] = useState({ dailySalesAmount: '', paymentFrequency: 'DAILY', durationValue: '3', durationUnit: 'MONTHS', gracePeriodDays: '0', offDays: '', maintenance: 'DRIVER', fuel: 'DRIVER' });
  const [privateBusy, setPrivateBusy] = useState(false);
  const [shareInputs, setShareInputs] = useState({});
  const [shares, setShares] = useState({});
  const [shareBusy, setShareBusy] = useState('');

  const loadContracts = () => contractsApi.list({ limit: 50 })
    .then((r) => setContracts(r.data?.data?.contracts || []))
    .catch(() => {})
    .finally(() => setFetching(false));

  useEffect(() => {
    if (!user) return;
    loadContracts();
    marketplaceApi.threads()
      .then((r) => setApprovedThreads((r.data?.data || []).filter((t) => t.interest?.status === 'APPROVED')))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const set = (k, v) => setTerms((p) => ({ ...p, [k]: v }));
  const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };

  // ── Contract estimator (Work & Pay) ──────────────────────────────────────
  // Two simple ways to spread the total payable — the system does the math:
  //  • By duration: owner picks how long (e.g. 3 years) and how often
  //    (weekly), the system works out the payment amount and count.
  //  • By amount: owner picks the payment amount (e.g. 1,400/week), the
  //    system works out how many payments and how long that takes.
  // The vehicle value never goes to the driver; it only feeds the owner's
  // own profit figures below.
  const est = (() => {
    const totalPayable = num(terms.totalPayable);
    if (!totalPayable) return null;
    const deposit = num(terms.depositAmount) || 0;
    const vehicleValue = num(terms.vehicleValue);
    const freq = terms.frequency || 'WEEKLY';
    const freqLabel = freq === 'DAILY' ? 'day' : freq === 'MONTHLY' ? 'month' : 'week';
    const daysPerPeriod = freq === 'DAILY' ? 1 : freq === 'MONTHLY' ? 30.44 : 7;
    const periodsPerYear = freq === 'DAILY' ? 365 : freq === 'MONTHLY' ? 12 : 52;
    const mode = terms.spread === 'amount' ? 'amount' : 'duration';
    let installment = null;
    let usedCount = null;
    if (mode === 'duration') {
      const dv = num(terms.durationValue);
      if (!dv) return null;
      const years = terms.durationUnit === 'MONTHS' ? dv / 12 : terms.durationUnit === 'WEEKS' ? dv / 52 : dv;
      usedCount = Math.max(1, Math.round(years * periodsPerYear));
      installment = Math.ceil(totalPayable / usedCount);
    } else {
      installment = num(terms.installmentAmount);
      if (!installment) return null;
      usedCount = Math.ceil(totalPayable / installment);
    }
    const lastPayment = totalPayable - installment * (usedCount - 1);
    const totalDays = Math.round(usedCount * daysPerPeriod);
    const graceRaw = Number(terms.gracePeriodDays);
    const graceDays = Number.isFinite(graceRaw) && graceRaw >= 0 ? Math.round(graceRaw) : 0;
    // Counting starts when the grace period ends (signing day + grace).
    const countingStart = new Date(); countingStart.setDate(countingStart.getDate() + graceDays);
    const firstDue = new Date(countingStart);
    if (freq === 'MONTHLY') firstDue.setMonth(firstDue.getMonth() + 1);
    else firstDue.setDate(firstDue.getDate() + Math.round(daysPerPeriod));
    const finish = new Date(countingStart);
    if (freq === 'MONTHLY') finish.setMonth(finish.getMonth() + usedCount);
    else finish.setDate(finish.getDate() + totalDays);
    const fmtDur = (n) => (Math.round(n * 10) / 10).toLocaleString('en-GH');
    const unit = (n, name) => `${fmtDur(n)} ${name}${Math.round(n * 10) / 10 === 1 ? '' : 's'}`;
    const durationParts = [unit(usedCount, freqLabel)];
    if (freq !== 'WEEKLY') durationParts.push(unit(totalDays / 7, 'week'));
    if (freq !== 'MONTHLY') durationParts.push(unit(totalDays / 30.44, 'month'));
    durationParts.push(unit(totalDays / 365.25, 'year'));
    const totalReceived = deposit + totalPayable;
    return {
      totalPayable, installment, deposit, vehicleValue, freqLabel, mode, lastPayment,
      graceDays, countingStart, firstDue,
      usedCount, finish,
      durationText: durationParts.join(' ≈ '),
      totalReceived,
      profit: vehicleValue ? totalReceived - vehicleValue : null,
      returnPct: vehicleValue ? ((totalReceived - vehicleValue) / vehicleValue) * 100 : null,
    };
  })();

  const startContract = async () => {
    if (!startFor) return;
    const type = startFor.vehicle?.operatingModel || 'DRIVING_ON';
    const payload = {
      type,
      vehicleId: startFor.vehicleId,
      parties: [{ userId: startFor.otherParty?.id, role: 'DRIVER' }],
    };
    if (type === 'WORK_AND_PAY') {
      if (![terms.vehicleValue, terms.depositAmount, terms.totalPayable].every((v) => num(v))) { setNotice('Fill in the vehicle value, deposit and total payable.'); return; }
      if (!est) { setNotice(terms.spread === 'amount' ? 'Enter the installment amount — the system will work out the number of payments and the duration.' : 'Enter how long the driver should take to finish paying — the system will work out the installment amount.'); return; }
      const graceRaw = Number(terms.gracePeriodDays);
      const graceDays = Number.isFinite(graceRaw) && graceRaw >= 0 ? Math.round(graceRaw) : null;
      if (graceDays === null) { setNotice('Enter the grace period in days (0 or more).'); return; }
      payload.workAndPayTerms = { vehicleValue: num(terms.vehicleValue), depositAmount: num(terms.depositAmount), totalPayable: num(terms.totalPayable), installmentAmount: est.installment, installmentFrequency: terms.frequency, totalInstallments: est.usedCount, gracePeriodDays: graceDays };
    } else if (type === 'RENTAL') {
      payload.rentalTerms = { paymentFrequency: terms.frequency === 'DAILY' ? 'WEEKLY' : terms.frequency };
    } else {
      if (!num(terms.dailySalesAmount)) { setNotice('Enter the daily sales amount for this DriveOn contract.'); return; }
      payload.drivingOnTerms = { dailySalesAmount: num(terms.dailySalesAmount), paymentFrequency: 'DAILY' };
    }
    setStartBusy(true);
    try {
      await contractsApi.create(payload);
      setStartFor(null);
      setNotice(`Contract created for ${startFor.otherParty?.firstName || 'the driver'}. Open it below and generate the driver's access code, then share it in your chat.`);
      loadContracts();
    } catch (e) {
      setNotice(e.response?.data?.message || 'Could not create the contract.');
    } finally { setStartBusy(false); }
  };

  const setPvField = (k, v) => setPv((p) => ({ ...p, [k]: v }));
  const setPtField = (k, v) => setPt((p) => ({ ...p, [k]: v }));
  const setDtField = (k, v) => setDt((p) => ({ ...p, [k]: v }));

  const createPrivateVehicle = async () => {
    if (!pv.registrationNumber.trim() || !pv.make.trim() || !pv.model.trim() || !pv.year || !pv.color.trim()) {
      setNotice('Add the registration number, make, model, year and colour.');
      return;
    }
    setPrivateBusy(true);
    try {
      const res = await vehiclesApi.create({
        registrationNumber: pv.registrationNumber.trim(), make: pv.make.trim(), model: pv.model.trim(),
        year: Number(pv.year), color: pv.color.trim(), type: pv.type, fuelType: pv.fuelType,
        transmission: pv.transmission, operatingModel: privateModel,
        mileage: pv.mileage ? Number(pv.mileage) : undefined,
        region: pv.region || undefined,
        location: pv.address.trim() || undefined, publish: false,
      });
      let vehicle = res.data?.data;
      let photoNote = '';
      if (vehicle?.id && pvPhoto) {
        try {
          const up = await vehiclesApi.uploadPhotos(vehicle.id, [pvPhoto]);
          if (up.data?.data?.id) vehicle = up.data.data;
        } catch { photoNote = ' The vehicle was saved, but the photo could not be uploaded — you can add it later from your Vehicles page.'; }
      }
      setPrivateVehicle(vehicle);
      setPrivateStep(3);
      setNotice(`Vehicle saved privately — it is not on Explore. Now set your ${privateModel === 'DRIVING_ON' ? 'DriveOn' : 'Work & Pay'} terms.${photoNote}`);
    } catch (e) {
      const m = e.response?.data?.message;
      setNotice(Array.isArray(m) ? m.join(' ') : m || 'Could not save the vehicle.');
    } finally { setPrivateBusy(false); }
  };

  const privateInstallments = (() => {
    const total = num(pt.totalPayable); const inst = num(pt.installmentAmount);
    return total && inst ? Math.ceil(total / inst) : null;
  })();

  const createPrivateContract = async () => {
    if (!privateVehicle?.id) { setPrivateStep(2); return; }
    const isDriveOn = privateModel === 'DRIVING_ON';
    const total = num(pt.totalPayable); const inst = num(pt.installmentAmount);
    const deposit = Number(pt.depositAmount) || 0;
    const grace = Math.round(Number(isDriveOn ? dt.gracePeriodDays : pt.gracePeriodDays));
    if (!Number.isFinite(grace) || grace < 0) { setNotice('Enter the grace period in days (0 or more).'); return; }
    if (!isDriveOn && (!total || !inst || !privateInstallments)) { setNotice('Enter the total to be paid and the amount per payment — the number of payments is worked out for you.'); return; }
    if (isDriveOn && !num(dt.dailySalesAmount)) { setNotice('Enter the daily sales amount the driver must bring — that is the DriveOn amount you set.'); return; }
    if (isDriveOn && !num(dt.durationValue)) { setNotice('Enter how long this DriveOn contract should run.'); return; }
    setPrivateBusy(true);
    try {
      await contractsApi.create(isDriveOn ? {
        type: 'DRIVING_ON',
        vehicleId: privateVehicle.id,
        title: `DriveOn — ${privateVehicle.registrationNumber}`,
        terms: {
          source: 'DIRECT', offDays: dt.offDays.trim() || null, gracePeriodDays: grace,
          duration: { value: Number(dt.durationValue), unit: dt.durationUnit },
        },
        responsibilityMatrix: { maintenance: dt.maintenance, fuel: dt.fuel },
        drivingOnTerms: {
          dailySalesAmount: num(dt.dailySalesAmount), paymentFrequency: dt.paymentFrequency,
          driverPaysMaintenance: dt.maintenance === 'DRIVER',
          driverPaysFuel: dt.fuel === 'DRIVER',
          driverPaysInsurance: false,
        },
      } : {
        type: 'WORK_AND_PAY',
        vehicleId: privateVehicle.id,
        title: `Work & Pay — ${privateVehicle.registrationNumber}`,
        terms: { source: 'DIRECT', offDays: pt.offDays.trim() || null },
        responsibilityMatrix: { maintenance: pt.maintenance },
        workAndPayTerms: {
          depositAmount: deposit, totalPayable: total, installmentAmount: inst,
          installmentFrequency: pt.frequency, totalInstallments: privateInstallments, gracePeriodDays: grace,
        },
      });
      setShowPrivate(false);
      setPrivateStep(1);
      setPrivateVehicle(null);
      setNotice('Contract created and saved below as a draft. Open it and share it with the driver by their chat username.');
      loadContracts();
    } catch (e) {
      const m = e.response?.data?.message;
      setNotice(Array.isArray(m) ? m.join(' ') : m || 'Could not create the contract.');
    } finally { setPrivateBusy(false); }
  };

  const shareContract = async (contract, usernameOverride) => {
    const username = (usernameOverride ?? shareInputs[contract.id] ?? '').trim();
    if (!username) { setNotice('Enter the driver\'s chat username first — ask the driver for it.'); return; }
    setShareBusy(contract.id);
    try {
      const r = await contractsApi.share(contract.id, username);
      const d = r.data?.data || {};
      setShares((p) => ({ ...p, [contract.id]: d }));
      setNotice(`Contract sent to @${d.driver?.chatUsername || username} in your chat with them, with a notification${d.emailSent ? ' and an email' : ''}. Now send them the confirmation code shown on the contract.`);
      loadContracts();
    } catch (e) {
      const m = e.response?.data?.message;
      setNotice(Array.isArray(m) ? m.join(' ') : m || 'Could not share the contract.');
    } finally { setShareBusy(''); }
  };

  const sendSharedCode = async (contract) => {
    const share = shares[contract.id];
    if (!share?.code || !share?.threadId) return;
    try {
      await marketplaceApi.sendMessage(share.threadId, {
        body: `Here is your contract confirmation code: ${share.code}\nOpen your contract here: ${share.shareLink}\nEnter the code to accept. Please only accept after you have seen the vehicle and confirmed its documents in person.`,
      });
      setNotice('Confirmation code sent to the driver in chat.');
    } catch (e) {
      setNotice(e.response?.data?.message || 'Could not send the code in chat. You can read the code to the driver yourself.');
    }
  };

  const generateCode = async (contract) => {
    setCodeBusy(contract.id);
    try {
      const r = await marketplaceApi.generateAccessCode(contract.id);
      const code = r.data?.data?.code;
      if (code) setCodes((p) => ({ ...p, [contract.id]: code }));
      setNotice('Access code generated. Share it with the driver in your chat — they enter it on their Contracts page to confirm the contract.');
    } catch (e) {
      setNotice(e.response?.data?.message || 'Could not generate a code. The driver must be the approved driver for this vehicle.');
    } finally { setCodeBusy(''); }
  };

  const sendCodeInChat = async (contract) => {
    const code = codes[contract.id];
    if (!code) return;
    try {
      const r = await marketplaceApi.vehicleInterests(contract.vehicleId);
      const approved = (r.data?.data || []).find((i) => i.status === 'APPROVED' && i.threadId);
      if (!approved) { setNotice('No chat thread found for the approved driver.'); return; }
      const w = contract.workAndPayTerms;
      const freqWord = w ? ({ DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month' }[w.installmentFrequency] || 'week') : null;
      const summary = w
        ? `\n\nYour contract in plain words: you get the ${contract.vehicle?.make || ''} ${contract.vehicle?.model || ''} (${contract.vehicle?.registrationNumber || ''}). You pay ${fmtGHS(w.depositAmount)} deposit upfront, then ${fmtGHS(w.installmentAmount)} every ${freqWord} for ${w.totalInstallments} payments — ${fmtGHS(w.totalPayable)} in total. Grace period: ${w.gracePeriodDays ?? 0} days after you confirm — counting starts when the grace period ends, and your first payment is due one ${freqWord} after counting starts.`
        : '';
      await marketplaceApi.sendMessage(approved.threadId, { body: `Here is your contract access code: ${code}\nOpen Contracts on +Motive and enter this code to confirm your contract for ${contract.vehicle?.registrationNumber || 'your vehicle'}.${summary}` });
      setNotice('Code sent to the driver in chat.');
    } catch (e) {
      setNotice(e.response?.data?.message || 'Could not send the code in chat. You can copy it and paste it into the chat yourself.');
    }
  };

  if (loading) return <div className="min-h-screen bg-chalk flex items-center justify-center"><div className="text-neutral-500 text-sm">Loading…</div></div>;

  return (
    <>
      <SectionHeader title="My Contracts" description="All vehicle contracts you are party to" />
      {notice && <div className="mb-4 rounded-btn bg-brand-50 dark:bg-dark-card border border-brand-100 dark:border-dark-border px-4 py-3 text-sm text-brand-800 dark:text-brand-300 flex items-start justify-between gap-4"><span>{notice}</span><button onClick={() => setNotice('')} className="font-semibold">×</button></div>}

      <div className="mb-6 flex justify-end">
        <button onClick={() => { setShowPrivate((v) => !v); setPrivateStep(privateVehicle ? 3 : 1); }} className="btn-primary text-sm">
          {showPrivate ? 'Close' : 'New contract (agreed in person)'}
        </button>
      </div>

      {showPrivate && (
        <div className="mb-6 bg-white dark:bg-dark-surface border border-neutral-200 dark:border-dark-border rounded-card p-5">
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Step {privateStep} of 3 — {privateStep === 1 ? 'Choose the model' : privateStep === 2 ? 'Add the vehicle' : `${privateModel === 'DRIVING_ON' ? 'DriveOn' : 'Work & Pay'} terms`}</p>
          <p className="text-xs text-neutral-500 mt-1">For a driver you have already agreed with in person. The vehicle stays private — it is not posted on Explore.</p>
          {privateStep === 1 ? (
            <>
              <p className="text-xs text-neutral-500 mt-4">What model are you creating this contract for?</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                <button type="button" onClick={() => setPrivateModel('WORK_AND_PAY')} className={`text-left rounded-lg border px-4 py-3 ${privateModel === 'WORK_AND_PAY' ? 'bg-brand-600 text-white border-brand-600' : 'border-neutral-300 dark:border-dark-border text-neutral-700 dark:text-neutral-200'}`}>
                  <span className="block text-sm font-semibold">Work & Pay</span>
                  <span className={`block text-xs mt-1 ${privateModel === 'WORK_AND_PAY' ? 'text-white/80' : 'text-neutral-500'}`}>The driver pays towards owning the vehicle.</span>
                </button>
                <button type="button" onClick={() => setPrivateModel('DRIVING_ON')} className={`text-left rounded-lg border px-4 py-3 ${privateModel === 'DRIVING_ON' ? 'bg-brand-600 text-white border-brand-600' : 'border-neutral-300 dark:border-dark-border text-neutral-700 dark:text-neutral-200'}`}>
                  <span className="block text-sm font-semibold">DriveOn</span>
                  <span className={`block text-xs mt-1 ${privateModel === 'DRIVING_ON' ? 'text-white/80' : 'text-neutral-500'}`}>The driver brings your set sales amount and keeps the rest.</span>
                </button>
                <div className="text-left rounded-lg border border-dashed border-neutral-300 dark:border-dark-border px-4 py-3 opacity-50">
                  <span className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200">Rent</span>
                  <span className="block text-xs mt-1 text-neutral-500">On hold for now.</span>
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <button onClick={() => setPrivateStep(2)} className="btn-primary text-sm">Continue to vehicle details</button>
              </div>
            </>
          ) : privateStep === 2 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                <label className="text-xs text-neutral-500">Registration number *<input className="input mt-1" placeholder="GR-1234-26" value={pv.registrationNumber} onChange={(e) => setPvField('registrationNumber', e.target.value)} /></label>
                <label className="text-xs text-neutral-500">Make *<input className="input mt-1" placeholder="Toyota" value={pv.make} onChange={(e) => setPvField('make', e.target.value)} /></label>
                <label className="text-xs text-neutral-500">Model *<input className="input mt-1" placeholder="Corolla" value={pv.model} onChange={(e) => setPvField('model', e.target.value)} /></label>
                <label className="text-xs text-neutral-500">Year *<input className="input mt-1" type="number" min="1980" max="2100" value={pv.year} onChange={(e) => setPvField('year', e.target.value)} /></label>
                <label className="text-xs text-neutral-500">Colour *<input className="input mt-1" placeholder="White" value={pv.color} onChange={(e) => setPvField('color', e.target.value)} /></label>
                <label className="text-xs text-neutral-500">Type
                  <select className="input mt-1" value={pv.type} onChange={(e) => setPvField('type', e.target.value)}>
                    {['SEDAN', 'SUV', 'PICKUP', 'MINIBUS', 'BUS', 'TRUCK', 'MOTORCYCLE', 'TRICYCLE', 'OTHER'].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label className="text-xs text-neutral-500">Fuel
                  <select className="input mt-1" value={pv.fuelType} onChange={(e) => setPvField('fuelType', e.target.value)}>
                    {['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'LPG'].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label className="text-xs text-neutral-500">Gearbox
                  <select className="input mt-1" value={pv.transmission} onChange={(e) => setPvField('transmission', e.target.value)}>
                    <option value="AUTOMATIC">Automatic</option><option value="MANUAL">Manual</option>
                  </select>
                </label>
                <label className="text-xs text-neutral-500">Mileage (optional)<input className="input mt-1" type="number" min="0" value={pv.mileage} onChange={(e) => setPvField('mileage', e.target.value)} /></label>
                <label className="text-xs text-neutral-500">Region
                  <select className="input mt-1" value={pv.region} onChange={(e) => setPvField('region', e.target.value)}>
                    <option value="">Select region…</option>
                    {GHANA_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
                <label className="text-xs text-neutral-500 md:col-span-2">Address / area (optional)<input className="input mt-1" placeholder="e.g. Osu, Oxford Street — the area the vehicle is kept" value={pv.address} onChange={(e) => setPvField('address', e.target.value)} /></label>
              </div>
              <div className="mt-4">
                <p className="text-xs text-neutral-500">Vehicle photo</p>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {pvPhotoPreview
                    ? <img src={pvPhotoPreview} alt="Vehicle" className="w-24 h-16 object-cover rounded-lg border border-neutral-200 dark:border-dark-border" />
                    : <span className="w-24 h-16 rounded-lg bg-neutral-100 dark:bg-dark-card border border-neutral-200 dark:border-dark-border flex items-center justify-center text-[11px] text-neutral-400 px-2 text-center">No photo yet</span>}
                  <label className="btn-graphite text-xs cursor-pointer">
                    {pvPhoto ? 'Change photo' : 'Upload a photo'}
                    <input
                      type="file" accept="image/*" className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        setPvPhoto(f);
                        setPvPhotoPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return f ? URL.createObjectURL(f) : ''; });
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {pvPhoto && <button type="button" onClick={() => { setPvPhoto(null); setPvPhotoPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return ''; }); }} className="text-xs text-neutral-500 underline">Remove</button>}
                </div>
                <p className="text-xs text-neutral-400 mt-2">Add a photo so the driver can recognise the car in the app when your contract arrives.</p>
              </div>
              <div className="flex gap-3 justify-end mt-4">
                <button onClick={() => setPrivateStep(1)} className="btn-graphite text-sm">Back to model</button>
                <button onClick={createPrivateVehicle} disabled={privateBusy} className="btn-primary text-sm disabled:opacity-40">{privateBusy ? 'Saving…' : 'Save vehicle and continue to terms'}</button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mt-3">
                {privateVehicle?.imageUrls?.[0] && <img src={resolveVehiclePhoto(privateVehicle.imageUrls[0])} alt="Vehicle" className="w-20 h-14 object-cover rounded-lg border border-neutral-200 dark:border-dark-border" />}
                <p className="text-xs text-neutral-500">{privateVehicle?.make} {privateVehicle?.model} · {privateVehicle?.registrationNumber} · {privateVehicle?.color} · {privateModel === 'DRIVING_ON' ? 'DriveOn' : 'Work & Pay'}{privateVehicle?.region ? ` · ${privateVehicle.region}` : ''}{privateVehicle?.location ? ` · ${privateVehicle.location}` : ''}</p>
              </div>
              {privateModel === 'DRIVING_ON' ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                    <label className="text-xs text-neutral-500">Daily sales the driver must bring (GHS) *<input className="input mt-1" inputMode="decimal" placeholder="e.g. 250" value={dt.dailySalesAmount} onChange={(e) => setDtField('dailySalesAmount', e.target.value)} /></label>
                    <label className="text-xs text-neutral-500">How the sales are paid to you
                      <select className="input mt-1" value={dt.paymentFrequency} onChange={(e) => setDtField('paymentFrequency', e.target.value)}>
                        <option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option>
                      </select>
                    </label>
                    <label className="text-xs text-neutral-500">Grace period (days)<input className="input mt-1" inputMode="numeric" value={dt.gracePeriodDays} onChange={(e) => setDtField('gracePeriodDays', e.target.value)} /></label>
                    <label className="text-xs text-neutral-500">Contract runs for — number<input className="input mt-1" inputMode="numeric" placeholder="e.g. 3" value={dt.durationValue} onChange={(e) => setDtField('durationValue', e.target.value)} /></label>
                    <label className="text-xs text-neutral-500">Period
                      <select className="input mt-1" value={dt.durationUnit} onChange={(e) => setDtField('durationUnit', e.target.value)}>
                        <option value="DAYS">Days</option><option value="WEEKS">Weeks</option><option value="MONTHS">Months</option>
                      </select>
                    </label>
                    <label className="text-xs text-neutral-500">Who takes care of maintenance
                      <select className="input mt-1" value={dt.maintenance} onChange={(e) => setDtField('maintenance', e.target.value)}>
                        <option value="DRIVER">Driver</option><option value="OWNER">Owner</option><option value="SHARED">Shared</option>
                      </select>
                    </label>
                    <label className="text-xs text-neutral-500">Who pays for fuel
                      <select className="input mt-1" value={dt.fuel} onChange={(e) => setDtField('fuel', e.target.value)}>
                        <option value="DRIVER">Driver</option><option value="OWNER">Owner</option><option value="SHARED">Shared</option>
                      </select>
                    </label>
                    <label className="text-xs text-neutral-500 md:col-span-2">Off days (optional)<input className="input mt-1" placeholder="e.g. Sundays, or one day every week" value={dt.offDays} onChange={(e) => setDtField('offDays', e.target.value)} /></label>
                  </div>
                  {num(dt.dailySalesAmount) && (
                    <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-3">
                      On your terms: the driver brings <b>{fmtGHS(num(dt.dailySalesAmount))} sales every day</b>
                      {dt.paymentFrequency === 'WEEKLY' ? `, paid to you weekly (about ${fmtGHS(num(dt.dailySalesAmount) * 7)} a week)` : ', paid to you daily'}
                      {num(dt.durationValue) ? `, for ${dt.durationValue} ${dt.durationUnit.toLowerCase()}` : ''}. The driver keeps everything above the sales amount.
                      Counting starts after the {dt.gracePeriodDays || 0}-day grace period, from the day the driver confirms.
                    </p>
                  )}
                </>
              ) : (
                <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                <label className="text-xs text-neutral-500">Total to be paid (GHS) *<input className="input mt-1" inputMode="decimal" value={pt.totalPayable} onChange={(e) => setPtField('totalPayable', e.target.value)} /></label>
                <label className="text-xs text-neutral-500">Deposit paid upfront (GHS)<input className="input mt-1" inputMode="decimal" value={pt.depositAmount} onChange={(e) => setPtField('depositAmount', e.target.value)} /></label>
                <label className="text-xs text-neutral-500">Amount per payment (GHS) *<input className="input mt-1" inputMode="decimal" value={pt.installmentAmount} onChange={(e) => setPtField('installmentAmount', e.target.value)} /></label>
                <label className="text-xs text-neutral-500">How often they pay
                  <select className="input mt-1" value={pt.frequency} onChange={(e) => setPtField('frequency', e.target.value)}>
                    <option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option>
                  </select>
                </label>
                <label className="text-xs text-neutral-500">Grace period (days)<input className="input mt-1" inputMode="numeric" value={pt.gracePeriodDays} onChange={(e) => setPtField('gracePeriodDays', e.target.value)} /></label>
                <label className="text-xs text-neutral-500">Who takes care of maintenance
                  <select className="input mt-1" value={pt.maintenance} onChange={(e) => setPtField('maintenance', e.target.value)}>
                    <option value="DRIVER">Driver</option><option value="OWNER">Owner</option><option value="SHARED">Shared</option>
                  </select>
                </label>
                <label className="text-xs text-neutral-500 md:col-span-2">Off days (optional)<input className="input mt-1" placeholder="e.g. Sundays, or one day every week" value={pt.offDays} onChange={(e) => setPtField('offDays', e.target.value)} /></label>
              </div>
              {privateInstallments && <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-3">That is <b>{privateInstallments}</b> payments of {fmtGHS(num(pt.installmentAmount))} every {pt.frequency === 'DAILY' ? 'day' : pt.frequency === 'MONTHLY' ? 'month' : 'week'}{privateInstallments > 1 && num(pt.totalPayable) % num(pt.installmentAmount) !== 0 ? `, with the last payment ${fmtGHS(num(pt.totalPayable) - num(pt.installmentAmount) * (privateInstallments - 1))}` : ''}. Counting starts after the {pt.gracePeriodDays || 0}-day grace period, from the day the driver confirms.</p>}
                </>
              )}
              <div className="flex gap-3 justify-end mt-4">
                <button onClick={() => setPrivateStep(2)} className="btn-graphite text-sm">Back to vehicle</button>
                <button onClick={createPrivateContract} disabled={privateBusy} className="btn-primary text-sm disabled:opacity-40">{privateBusy ? 'Creating…' : 'Create contract'}</button>
              </div>
            </>
          )}
        </div>
      )}

      {approvedThreads.length > 0 && (
        <div className="mb-6 bg-white dark:bg-dark-surface border border-brand-200 dark:border-dark-border rounded-card p-4">
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Approved drivers waiting for a contract</p>
          <p className="text-xs text-neutral-500 mt-0.5">These drivers showed interest on Explore and you approved them. Start the contract here, then generate their access code and share it in chat.</p>
          <div className="mt-3 space-y-2">
            {approvedThreads.map((t) => (
              <div key={t.id} className="flex items-center gap-3 flex-wrap border border-neutral-200 dark:border-dark-border rounded-lg px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-neutral-800 dark:text-neutral-100 font-medium">{t.otherParty ? `${t.otherParty.firstName || ''} ${t.otherParty.lastName || ''}`.trim() : 'Driver'} — {t.vehicle?.make} {t.vehicle?.model} ({t.vehicle?.registrationNumber})</p>
                  <p className="text-xs text-neutral-400">{(t.vehicle?.operatingModel || '').replace(/_/g, ' ')}</p>
                </div>
                <button onClick={() => setStartFor(t)} className="btn-primary text-xs">Start contract</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {fetching ? (
        <div className="text-neutral-500 text-sm py-8 text-center">Loading contracts…</div>
      ) : contracts.length === 0 ? (
        <EmptyState icon="📄" title="No contracts yet" description="Contracts appear once a vehicle is assigned and an agreement is created with a driver." />
      ) : (
        <div className="space-y-3">
          {contracts.map((c) => (
            <div
              key={c.id}
              className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-4 cursor-pointer hover:border-neutral-600 transition-colors"
              onClick={() => setSelected(selected?.id === c.id ? null : c)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">{TYPE_LABEL[c.type] || c.type}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {c.vehicle?.registrationNumber || c.vehicleId || '—'} &middot; {fmtDate(c.startDate)} – {fmtDate(c.endDate)}
                  </p>
                </div>
                <StatusBadge status={c.status} />
              </div>

              {selected?.id === c.id && (
                <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-dark-border grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-neutral-500">Total Amount</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{fmtGHS(c.workAndPayTerms?.totalPayable ?? c.totalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Amount Paid</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{fmtGHS(c.workAndPayTerms?.totalPaid ?? c.amountPaid)}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Remaining</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{fmtGHS(c.workAndPayTerms?.remainingBalance ?? ((c.totalAmount || 0) - (c.amountPaid || 0)))}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Installment</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{fmtGHS(c.workAndPayTerms?.installmentAmount ?? c.drivingOnTerms?.dailySalesAmount ?? c.installmentAmount)}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Frequency</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{c.workAndPayTerms?.installmentFrequency || c.drivingOnTerms?.paymentFrequency || c.paymentFrequency || '—'}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Deposit</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{fmtGHS(c.workAndPayTerms?.depositAmount ?? c.depositAmount)}</p>
                  </div>
                  {c.workAndPayTerms && (
                    <div>
                      <p className="text-neutral-500">Grace period</p>
                      <p className="text-neutral-900 dark:text-white mt-0.5">{c.workAndPayTerms.gracePeriodDays ?? 0} days after the driver confirms — counting starts when it ends</p>
                    </div>
                  )}
                  {c.workAndPayTerms?.vehicleValue && (
                    <div>
                      <p className="text-neutral-500">Your profit (only you see this)</p>
                      <p className="text-neutral-900 dark:text-white mt-0.5">{fmtGHS((Number(c.workAndPayTerms.depositAmount) || 0) + (Number(c.workAndPayTerms.totalPayable) || 0) - Number(c.workAndPayTerms.vehicleValue))} over the vehicle value of {fmtGHS(c.workAndPayTerms.vehicleValue)}</p>
                    </div>
                  )}
                  {(c.terms?.offDays || c.responsibilityMatrix?.maintenance) && (
                    <div className="col-span-2">
                      <p className="text-neutral-500">Agreed terms</p>
                      <p className="text-neutral-900 dark:text-white mt-0.5 leading-relaxed">
                        {c.terms?.offDays ? `Off days: ${c.terms.offDays}. ` : ''}
                        {c.responsibilityMatrix?.maintenance ? `Maintenance: ${String(c.responsibilityMatrix.maintenance).toLowerCase()} takes care of it.` : ''}
                      </p>
                    </div>
                  )}
                  {c.drivingOnTerms && (
                    <div className="col-span-2">
                      <p className="text-neutral-500">DriveOn terms (set by you)</p>
                      <p className="text-neutral-900 dark:text-white mt-0.5 leading-relaxed">
                        Driver brings {fmtGHS(c.drivingOnTerms.dailySalesAmount)} sales every day, paid {String(c.drivingOnTerms.paymentFrequency || 'DAILY').toLowerCase()}
                        {c.terms?.duration?.value ? `, for ${c.terms.duration.value} ${String(c.terms.duration.unit || '').toLowerCase()}` : ''}
                        {c.terms?.gracePeriodDays ? `. Grace period: ${c.terms.gracePeriodDays} days` : ''}
                        {c.responsibilityMatrix?.fuel ? `. Fuel: ${String(c.responsibilityMatrix.fuel).toLowerCase()} pays` : ''}
                      </p>
                    </div>
                  )}
                  {['DRAFT', 'PENDING_SIGNATURES'].includes(c.status) && c.vehicleId && (
                    <div className="col-span-2 border-t border-neutral-200 dark:border-dark-border pt-3" onClick={(e) => e.stopPropagation()}>
                      <p className="text-neutral-800 dark:text-neutral-100 font-semibold text-sm">Share with the driver</p>
                      <p className="text-neutral-500 mt-0.5">Ask the driver for their chat username, enter it here, and the contract is sent to them in Chat with a link to open it. You then send their confirmation code in the same chat.</p>
                      {(() => {
                        const dp = (c.parties || []).find((p) => p.role === 'DRIVER' && p.userId);
                        if (!dp) return null;
                        const name = dp.user ? `${dp.user.firstName || ''} ${dp.user.lastName || ''}`.trim() : '';
                        return (
                          <p className="text-neutral-600 dark:text-neutral-300 mt-1.5">
                            Already shared with <b>{name || 'the driver'}</b>{dp.user?.chatUsername ? <> (<b>@{dp.user.chatUsername}</b>)</> : ''}. Sharing again sends a fresh contract card and gives you a new confirmation code — the old code stops working.
                          </p>
                        );
                      })()}
                      {shares[c.id] ? (
                        <div className="mt-2 space-y-2">
                          <p className="text-neutral-600 dark:text-neutral-300">Sent to <b>@{shares[c.id].driver?.chatUsername}</b>. Their confirmation code:</p>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-lg font-bold tracking-[0.3em] text-neutral-900 dark:text-white bg-neutral-100 dark:bg-dark-bg px-3 py-1.5 rounded-lg">{shares[c.id].code}</span>
                            <button onClick={() => sendSharedCode(c)} className="btn-primary text-xs">Send code in chat</button>
                            <Link href={`/owner/messages?thread=${shares[c.id].threadId}`} className="btn-graphite text-xs">Open chat</Link>
                            <button onClick={() => { try { navigator.clipboard.writeText(`${window.location.origin}${shares[c.id].shareLink}`); setNotice('Contract link copied. You can also send it to the driver outside the app.'); } catch {} }} className="btn-graphite text-xs">Copy contract link</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="flex items-center gap-1.5 flex-1 min-w-52">
                            <span className="text-neutral-400 text-sm">@</span>
                            <input
                              className="input flex-1"
                              placeholder="driver's chat username, e.g. kwame.drives"
                              value={shareInputs[c.id] || ''}
                              onChange={(e) => setShareInputs((p) => ({ ...p, [c.id]: e.target.value }))}
                            />
                          </span>
                          <button onClick={() => shareContract(c, (shareInputs[c.id] || '').trim() || (c.parties || []).find((p) => p.role === 'DRIVER')?.user?.chatUsername)} disabled={shareBusy === c.id} className="btn-primary text-xs disabled:opacity-40">{shareBusy === c.id ? 'Sharing…' : (c.parties || []).some((p) => p.role === 'DRIVER' && p.userId) ? 'Resend & get new code' : 'Share contract in chat'}</button>
                        </div>
                      )}
                    </div>
                  )}
                  {c.terms?.source !== 'DIRECT' && ['DRAFT', 'PENDING_SIGNATURES', 'PENDING_APPROVAL'].includes(c.status) && (c.parties || []).some((p) => p.role === 'DRIVER') && (
                    <div className="col-span-2 border-t border-neutral-200 dark:border-dark-border pt-3" onClick={(e) => e.stopPropagation()}>
                      <p className="text-neutral-500">Driver access code</p>
                      <p className="text-neutral-400 mt-0.5">Generate the unique code for the approved driver of this vehicle and share it in your chat. The driver enters it on their Contracts page to confirm and sign this contract. Generating a new code replaces the old one.</p>
                      {codes[c.id] ? (
                        <div className="mt-2 flex items-center gap-3 flex-wrap">
                          <span className="text-lg font-bold tracking-[0.3em] text-neutral-900 dark:text-white bg-neutral-100 dark:bg-dark-bg px-3 py-1.5 rounded-lg">{codes[c.id]}</span>
                          <button onClick={() => sendCodeInChat(c)} className="btn-primary text-xs">Send code in chat</button>
                          <button onClick={() => generateCode(c)} disabled={codeBusy === c.id} className="btn-graphite text-xs disabled:opacity-40">Regenerate</button>
                        </div>
                      ) : (
                        <button onClick={() => generateCode(c)} disabled={codeBusy === c.id} className="btn-primary text-xs mt-2 disabled:opacity-40">{codeBusy === c.id ? 'Generating…' : 'Generate access code'}</button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={!!startFor} onClose={() => setStartFor(null)} title={startFor ? `Contract for ${startFor.vehicle?.make} ${startFor.vehicle?.model}` : ''}>
        {startFor && (
          <div className="space-y-3">
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              Driver: <b>{startFor.otherParty ? `${startFor.otherParty.firstName || ''} ${startFor.otherParty.lastName || ''}`.trim() : 'Driver'}</b> · {startFor.vehicle?.registrationNumber} · {(startFor.vehicle?.operatingModel || '').replace(/_/g, ' ')}
            </p>
            {startFor.vehicle?.operatingModel === 'WORK_AND_PAY' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs text-neutral-500">Vehicle value (GHS) — only you see this<input className="input mt-1" inputMode="decimal" value={terms.vehicleValue} onChange={(e) => set('vehicleValue', e.target.value)} /></label>
                  <label className="text-xs text-neutral-500">Deposit the driver pays upfront (GHS)<input className="input mt-1" inputMode="decimal" value={terms.depositAmount} onChange={(e) => set('depositAmount', e.target.value)} /></label>
                  <label className="text-xs text-neutral-500">Total payable — what you want from this vehicle (GHS)<input className="input mt-1" inputMode="decimal" value={terms.totalPayable} onChange={(e) => set('totalPayable', e.target.value)} /></label>
                  <label className="text-xs text-neutral-500">How often the driver pays
                    <select className="input mt-1" value={terms.frequency} onChange={(e) => set('frequency', e.target.value)}>
                      <option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option>
                    </select>
                  </label>
                </div>
                <p className="text-xs text-neutral-400">The vehicle value is your private record of what the vehicle is worth — the driver never sees it. The driver only contracts on the total payable.</p>
                <div>
                  <p className="text-xs text-neutral-500 mb-1.5">How should the total payable be spread?</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => set('spread', 'duration')} className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold ${terms.spread !== 'amount' ? 'bg-brand-600 text-white border-brand-600' : 'border-neutral-300 dark:border-dark-border text-neutral-600 dark:text-neutral-300'}`}>By how long it should take</button>
                    <button type="button" onClick={() => set('spread', 'amount')} className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold ${terms.spread === 'amount' ? 'bg-brand-600 text-white border-brand-600' : 'border-neutral-300 dark:border-dark-border text-neutral-600 dark:text-neutral-300'}`}>By payment amount</button>
                  </div>
                  {terms.spread === 'amount' ? (
                    <label className="text-xs text-neutral-500 block mt-3">Amount the driver pays every {terms.frequency === 'DAILY' ? 'day' : terms.frequency === 'MONTHLY' ? 'month' : 'week'} (GHS)<input className="input mt-1" inputMode="decimal" placeholder="e.g. 400" value={terms.installmentAmount} onChange={(e) => set('installmentAmount', e.target.value)} /><span className="block mt-1 text-neutral-400">The daily / weekly / monthly choice is “How often the driver pays” above.</span></label>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <label className="text-xs text-neutral-500">Finish paying within — type a number<input className="input mt-1" inputMode="decimal" placeholder="e.g. 3" value={terms.durationValue} onChange={(e) => set('durationValue', e.target.value)} /></label>
                      <label className="text-xs text-neutral-500">Period
                        <select className="input mt-1" value={terms.durationUnit} onChange={(e) => set('durationUnit', e.target.value)}>
                          <option value="YEARS">Years</option><option value="MONTHS">Months</option><option value="WEEKS">Weeks</option>
                        </select>
                      </label>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs text-neutral-500">Grace period (days)<input className="input mt-1" inputMode="numeric" value={terms.gracePeriodDays} onChange={(e) => set('gracePeriodDays', e.target.value)} /></label>
                  <p className="text-xs text-neutral-400 self-end pb-2">Days after the driver confirms before counting starts. 0 means counting starts on the confirmation day.</p>
                </div>
                {est ? (
                  <div className="rounded-lg border border-brand-200 dark:border-dark-border bg-brand-50 dark:bg-dark-card px-3.5 py-3 text-xs leading-relaxed">
                    <p className="font-semibold text-neutral-900 dark:text-neutral-50">How this contract will work</p>
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-neutral-600 dark:text-neutral-300">
                      <span>The driver will pay</span>
                      <span className="text-right font-semibold text-neutral-900 dark:text-neutral-50">{fmtGHS(est.installment)} every {est.freqLabel}</span>
                      <span>Number of payments</span>
                      <span className="text-right font-semibold text-neutral-900 dark:text-neutral-50">{est.usedCount.toLocaleString('en-GH')}{est.lastPayment !== est.installment ? ` (last one ${fmtGHS(est.lastPayment)})` : ''}</span>
                      <span>That takes</span>
                      <span className="text-right font-semibold text-neutral-900 dark:text-neutral-50">{est.durationText}</span>
                      <span>Grace period after the driver confirms</span>
                      <span className="text-right font-semibold text-neutral-900 dark:text-neutral-50">{est.graceDays} day{est.graceDays === 1 ? '' : 's'}</span>
                      <span>Counting starts (if the driver confirms today)</span>
                      <span className="text-right font-semibold text-neutral-900 dark:text-neutral-50">{fmtDate(est.countingStart)}</span>
                      <span>First payment due</span>
                      <span className="text-right font-semibold text-neutral-900 dark:text-neutral-50">{fmtDate(est.firstDue)}</span>
                      <span>Finish date if the driver confirms today</span>
                      <span className="text-right font-semibold text-neutral-900 dark:text-neutral-50">{fmtDate(est.finish)}</span>
                      {est.vehicleValue && (<>
                        <span>Total you will receive (deposit + total payable)</span>
                        <span className="text-right font-semibold text-neutral-900 dark:text-neutral-50">{fmtGHS(est.totalReceived)}</span>
                        <span>Your profit over the vehicle value ({fmtGHS(est.vehicleValue)}) — only you see this</span>
                        <span className="text-right font-semibold text-neutral-900 dark:text-neutral-50">{fmtGHS(est.profit)} ({est.returnPct.toFixed(1)}% return)</span>
                      </>)}
                    </div>
                    <p className="mt-2 text-neutral-700 dark:text-neutral-200 leading-relaxed">
                      <b>In plain words:</b> {startFor.otherParty ? `${startFor.otherParty.firstName || ''} ${startFor.otherParty.lastName || ''}`.trim() : 'The driver'} gets the {startFor.vehicle?.make} {startFor.vehicle?.model} ({startFor.vehicle?.registrationNumber}), pays {est.deposit > 0 ? `${fmtGHS(est.deposit)} deposit upfront, then ` : ''}{fmtGHS(est.installment)} every {est.freqLabel} for {est.usedCount.toLocaleString('en-GH')} payments — {fmtGHS(est.totalPayable)} in total{est.lastPayment !== est.installment ? `, with the last payment ${fmtGHS(est.lastPayment)}` : ''}. After the driver confirms with the access code, there is a <b>{est.graceDays}-day grace period</b> — <b>counting starts on {fmtDate(est.countingStart)}</b> if they confirm today, the first payment is due {fmtDate(est.firstDue)}, and the last is due {fmtDate(est.finish)}. If the driver confirms later, the grace period and every payment date move to start from that later day.
                    </p>
                    {est.lastPayment !== est.installment && (
                      <p className="mt-2 text-neutral-500">The payments add up to exactly {fmtGHS(est.totalPayable)}: the first {est.usedCount - 1} payments are {fmtGHS(est.installment)} and the final one is {fmtGHS(est.lastPayment)}.</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-400">Enter the total payable, then choose how to spread it — by how long it should take, or by payment amount — and the system will work out the rest.</p>
                )}
              </>
            )}
            {startFor.vehicle?.operatingModel === 'DRIVING_ON' && (
              <>
                <label className="text-xs text-neutral-500 block">Daily sales amount (GHS)<input className="input mt-1" inputMode="decimal" value={terms.dailySalesAmount} onChange={(e) => set('dailySalesAmount', e.target.value)} /></label>
                {num(terms.dailySalesAmount) && <p className="text-xs text-neutral-500">That is about <b>{fmtGHS(num(terms.dailySalesAmount) * 7)}</b> per week, <b>{fmtGHS(num(terms.dailySalesAmount) * 30.44)}</b> per month and <b>{fmtGHS(num(terms.dailySalesAmount) * 365.25)}</b> per year.</p>}
              </>
            )}
            {startFor.vehicle?.operatingModel === 'RENTAL' && (
              <label className="text-xs text-neutral-500 block">Payment frequency
                <select className="input mt-1" value={terms.frequency} onChange={(e) => set('frequency', e.target.value)}>
                  <option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option>
                </select>
              </label>
            )}
            <p className="text-xs text-neutral-400">After creating the contract, generate the driver&apos;s access code on the contract and send it in your chat. The driver confirms the contract by entering that code.</p>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setStartFor(null)} className="btn-graphite flex-1 justify-center">Cancel</button>
              <button onClick={startContract} disabled={startBusy} className="btn-primary flex-1 justify-center disabled:opacity-40">{startBusy ? 'Creating…' : 'Create contract'}</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
