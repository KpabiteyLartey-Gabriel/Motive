'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { SectionHeader, EmptyState, Modal } from '@/components/dashboard/DashboardUI';

import { marketplaceApi, resolveVehiclePhoto } from '@/lib/api';

const MODEL_LABEL = { WORK_AND_PAY: 'Work & Pay', DRIVING_ON: 'DriveOn', RENTAL: 'Rental' };
const MODEL_FILTERS = [
  { key: 'ALL', label: 'All vehicles' },
  { key: 'RENTAL', label: 'Rental' },
  { key: 'WORK_AND_PAY', label: 'Work & Pay' },
  { key: 'DRIVING_ON', label: 'DriveOn' },
];

// The portal Dashboard IS Explore: one grid of the vehicles companies
// publish for Rental, Work & Pay and DriveOn. Individual owners never
// list here — their deals are private — so every card is a company's.
export default function PortalDashboardPage() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [mine, setMine] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [noteFor, setNoteFor] = useState(null);
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState('');
  const [model, setModel] = useState('ALL');
  const canShowInterest = user?.primaryRole === 'DRIVER';

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const [a, b] = await Promise.all([
        marketplaceApi.explore().catch(() => ({ data: { data: [] } })),
        marketplaceApi.myInterests().catch(() => ({ data: { data: [] } })),
      ]);
      setVehicles(a.data?.data || []);
      setMine(b.data?.data || []);
    } finally { setFetching(false); }
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  const interestByVehicle = {};
  mine.forEach((i) => { interestByVehicle[i.vehicleId] = i; });

  const shown = model === 'ALL' ? vehicles : vehicles.filter((v) => v.operatingModel === model);
  const countFor = (key) => (key === 'ALL' ? vehicles.length : vehicles.filter((v) => v.operatingModel === key).length);

  const express = async (vehicle) => {
    setBusyId(vehicle.id);
    try {
      await marketplaceApi.expressInterest(vehicle.id, note.trim() || undefined);
      setNoteFor(null);
      setNote('');
      setNotice('Interest sent. Check Chat to talk to the company.');
      load();
    } catch (e) {
      setNotice(e.response?.data?.message || 'Could not send interest.');
    } finally { setBusyId(null); }
  };

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight text-ink dark:text-white">Welcome, {user?.firstName || 'User'}</h2>
        <p className="mt-0.5 text-sm text-steel dark:text-neutral-400">Vehicles companies have published for Rental, Work &amp; Pay and DriveOn.</p>
      </div>

      {notice && (
        <div className="mb-4 rounded-btn border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-800 dark:border-dark-border dark:bg-dark-card dark:text-brand-300 flex items-start justify-between gap-4">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} className="font-semibold">×</button>
        </div>
      )}
      {!canShowInterest && (
        <p className="mb-4 rounded-card border border-line bg-white px-4 py-3 text-sm text-steel shadow-card dark:border-dark-border dark:bg-dark-card dark:text-neutral-300">
          You can browse vehicles here. Showing interest and chatting with a company is available once your account is set up as a Driver.
        </p>
      )}

      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filter by contract type">
        {MODEL_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setModel(f.key)}
            aria-pressed={model === f.key}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              model === f.key
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-white text-steel border border-line hover:text-ink dark:bg-dark-card dark:border-dark-border dark:text-neutral-300 dark:hover:text-white'
            }`}
          >
            {f.label} <span className={model === f.key ? 'text-white/75' : 'text-neutral-400'}>({countFor(f.key)})</span>
          </button>
        ))}
      </div>

      <SectionHeader title="Available now" action={<span className="text-xs text-neutral-500">Verified vehicles published by companies.</span>} />
      {fetching ? (
        <p className="text-sm text-neutral-500">Loading vehicles…</p>
      ) : shown.length === 0 ? (
        <EmptyState icon="explore" title="No vehicles here right now" description="When companies publish verified vehicles for Rental, Work & Pay or DriveOn, they will appear here." />
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {shown.map((v) => {
            const interest = interestByVehicle[v.id];
            const cover = v.imageUrls?.[0];
            return (
              <article key={v.id} className="bg-white dark:bg-dark-surface border border-neutral-200 dark:border-dark-border rounded-card overflow-hidden flex flex-col">
                <div className="relative aspect-[16/9] bg-neutral-100 dark:bg-dark-card">
                  {cover ? <img src={resolveVehiclePhoto(cover)} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs text-neutral-400">No photo yet</div>}
                  <span className="absolute top-3 left-3 text-[11px] font-semibold bg-brand-600 text-white px-2.5 py-1 rounded-full">{MODEL_LABEL[v.operatingModel] || 'Available'}</span>
                  <span className="absolute top-3 right-3 text-[11px] font-semibold bg-black/55 text-white px-2.5 py-1 rounded-full">{v.interestCount} driver{v.interestCount === 1 ? '' : 's'} interested</span>
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="text-[15px] font-semibold text-neutral-900 dark:text-neutral-50">{v.make} {v.model} <span className="text-neutral-400 font-normal">· {v.year}</span></h3>
                  <p className="text-xs text-neutral-500 mt-0.5">{v.registrationNumber} · {v.color || ''} · {(v.type || '').replace(/_/g, ' ')} · {(v.fuelType || '').replace(/_/g, ' ')} · {v.location || v.region || ''}</p>
                  <div className="mt-3 space-y-1.5 text-xs text-neutral-600 dark:text-neutral-300">
                    <p className="flex justify-between"><span>Contract type</span><span className="font-semibold text-neutral-900 dark:text-neutral-50">{MODEL_LABEL[v.operatingModel] || 'To be agreed'}</span></p>
                    {v.estimatedValue != null && <p className="flex justify-between"><span>Vehicle value</span><span className="font-semibold text-neutral-900 dark:text-neutral-50">GHS {Number(v.estimatedValue).toLocaleString()}</span></p>}
                    <p className="flex justify-between"><span>Listed by</span><span className="font-medium">{v.managingCompany?.name || 'Company'}</span></p>
                  </div>
                  <div className="mt-auto pt-4">
                    {interest ? (
                      <div className="space-y-2">
                        <p className={`text-xs font-medium ${interest.status === 'APPROVED' ? 'text-green-600' : interest.status === 'DECLINED' ? 'text-red-500' : 'text-amber-600'}`}>
                          {interest.status === 'APPROVED' ? 'The company approved you for this vehicle.' : interest.status === 'DECLINED' ? 'The company chose another driver this time.' : interest.status === 'RELEASED' ? 'You were released from this vehicle.' : 'Interest sent — waiting for the company.'}
                        </p>
                        {interest.threadId && <Link href={`/portal/chat?thread=${interest.threadId}`} className="btn-graphite text-xs w-full justify-center">Open chat with company</Link>}
                      </div>
                    ) : (
                      <button type="button" onClick={() => { setNoteFor(v); setNote(''); }} className="btn-primary text-sm w-full justify-center">Show interest</button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal open={!!noteFor} onClose={() => setNoteFor(null)} title={noteFor ? `Interested in ${noteFor.make} ${noteFor.model}` : ''}>
        {canShowInterest ? (
          <>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">The company will see your interest and can chat with you in-app before deciding. Tell them a little about yourself.</p>
            <textarea className="input mt-4" rows={4} placeholder="e.g. Licensed driver with 6 years experience in Accra…" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setNoteFor(null)} className="btn-graphite flex-1 justify-center">Cancel</button>
              <button type="button" onClick={() => noteFor && express(noteFor)} disabled={busyId === noteFor?.id} className="btn-primary flex-1 justify-center disabled:opacity-40">{busyId === noteFor?.id ? 'Sending…' : 'Send interest'}</button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">Showing interest is available on a Driver account. You can still browse vehicles from this portal.</p>
            <button type="button" onClick={() => setNoteFor(null)} className="btn-primary mt-5 w-full justify-center">Close</button>
          </>
        )}
      </Modal>
    </>
  );
}
