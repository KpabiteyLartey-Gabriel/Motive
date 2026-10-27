'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { SectionHeader, EmptyState } from '@/components/dashboard/DashboardUI';
import { vehiclesApi, contractsApi, marketplaceApi, resolveVehiclePhoto } from '@/lib/api';
import { termsSummary } from '../contracts/page.jsx';

const VEHICLE_TYPES = [
  ['MOTORCYCLE', 'Motorbike'], ['TRICYCLE', 'Tricycle'], ['SEDAN', 'Car (saloon)'], ['SUV', 'SUV'],
  ['PICKUP', 'Pickup'], ['VAN', 'Van'], ['MINIBUS', 'Minibus'], ['BUS', 'Bus'], ['TRUCK', 'Truck'],
  ['TRAILER', 'Trailer'], ['OTHER', 'Other'],
];
const REGIONS = ['Greater Accra', 'Ashanti', 'Western', 'Central', 'Eastern', 'Volta', 'Northern', 'Bono', 'Bono East', 'Ahafo', 'Western North', 'Oti', 'North East', 'Savannah', 'Upper East', 'Upper West'];
const TYPE_LABEL = { WORK_AND_PAY: 'Work & Pay', DRIVING_ON: 'DriveOn', RENTAL: 'Rental' };

const EMPTY_FORM = {
  registrationNumber: '', make: '', model: '', year: new Date().getFullYear(), color: '',
  type: 'SEDAN', fuelType: 'PETROL', transmission: 'AUTOMATIC', mileage: '', region: '', location: '',
};

// The driver's uploaded profile picture, resolved against the API
// origin (uploads are stored as relative paths). Falls back to their
// initial when they have no picture or it fails to load.
function DriverAvatar({ photoUrl, name }) {
  const [failed, setFailed] = useState(false);
  const src = photoUrl ? resolveVehiclePhoto(photoUrl) : '';
  if (!src || failed) {
    return <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white" aria-hidden="true">{(name || '?').charAt(0)}</span>;
  }
  return <img src={src} alt="" onError={() => setFailed(true)} className="h-6 w-6 shrink-0 rounded-full object-cover" />;
}

// My Vehicles: every motor vehicle the owner has uploaded, in a grid.
// Each card can take a contract (Attach contract -> pick from the owner's
// created contracts) and then be awarded to a driver found by search.
export default function OwnerVehiclesPage() {
  const { user } = useAuth({ requiredRoles: ['OWNER'] });
  const [vehicles, setVehicles] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [attachFor, setAttachFor] = useState(null); // vehicle id
  const [attachPick, setAttachPick] = useState('');
  const [photoTarget, setPhotoTarget] = useState(null); // vehicle receiving a photo
  const [photoBusy, setPhotoBusy] = useState('');
  const photoInputRef = useRef(null);
  const [awardFor, setAwardFor] = useState(null); // contract id
  const [driverQuery, setDriverQuery] = useState('');
  const [driverResults, setDriverResults] = useState([]);
  const [pickedDriver, setPickedDriver] = useState(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const [v, c] = await Promise.all([
        vehiclesApi.list({ limit: 100 }),
        contractsApi.list({ limit: 100 }).catch(() => ({ data: { data: { contracts: [] } } })),
      ]);
      setVehicles(v.data?.data?.vehicles || v.data?.data || []);
      setContracts(c.data?.data?.contracts || []);
    } catch { setError('Could not load your vehicles.'); }
    finally { setFetching(false); }
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  const contractByVehicle = {};
  contracts.forEach((c) => { if (c.vehicleId) contractByVehicle[c.vehicleId] = c; });
  const attachable = contracts.filter((c) => !c.vehicleId && c.status === 'DRAFT' && !(c.parties || []).some((p) => p.role === 'DRIVER'));

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // Owners can add a vehicle picture at any time — when creating the
  // vehicle or later from its card. The newest picture becomes the cover.
  const pickVehiclePhoto = (vehicle) => {
    setPhotoTarget(vehicle);
    photoInputRef.current?.click();
  };

  const onVehiclePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const vehicle = photoTarget;
    setPhotoTarget(null);
    if (!file || !vehicle) return;
    if (!file.type.startsWith('image/')) { setError('Choose an image file for the vehicle picture.'); return; }
    setPhotoBusy(vehicle.id); setError(''); setNotice('');
    try {
      const oldUrls = vehicle.imageUrls || [];
      const res = await vehiclesApi.uploadPhotos(vehicle.id, [file]);
      const updated = res.data?.data || res.data;
      const allUrls = updated?.imageUrls || [];
      const newUrl = allUrls.find((u) => !oldUrls.includes(u)) || allUrls[allUrls.length - 1];
      if (newUrl && oldUrls.length) {
        await vehiclesApi.setPhotos(vehicle.id, [newUrl, ...oldUrls]).catch(() => {});
      }
      setNotice(`Picture added to ${vehicle.make} ${vehicle.model}.`);
      load();
    } catch (err) {
      const m = err.response?.data?.message || 'Could not upload that picture. Please try another image.';
      setError(Array.isArray(m) ? m.join(' ') : m);
    } finally { setPhotoBusy(''); }
  };

  const submitVehicle = async () => {
    setError('');
    if (!form.registrationNumber.trim() || !form.make.trim() || !form.model.trim() || !form.year) {
      setError('Registration number, make, model and year are required.');
      return;
    }
    setSaving(true);
    try {
      const res = await vehiclesApi.create({
        registrationNumber: form.registrationNumber.trim(),
        make: form.make.trim(),
        model: form.model.trim(),
        year: Number(form.year),
        color: form.color.trim() || undefined,
        type: form.type,
        fuelType: form.fuelType,
        transmission: form.transmission,
        mileage: form.mileage ? Number(form.mileage) : undefined,
        region: form.region || undefined,
        location: form.location.trim() || undefined,
        publish: false,
      });
      const created = res.data?.data;
      if (created?.id && photo) {
        await vehiclesApi.uploadPhotos(created.id, [photo]).catch(() => {});
      }
      setForm(EMPTY_FORM);
      setPhoto(null);
      setShowForm(false);
      setNotice('Vehicle added. Attach a contract to it below, then award it to a driver.');
      load();
    } catch (e) {
      const m = e.response?.data?.message || 'Could not save the vehicle. Please try again.';
      setError(Array.isArray(m) ? m.join(' ') : m);
    } finally { setSaving(false); }
  };

  const attach = async (vehicle) => {
    if (!attachPick) { setError('Choose one of your created contracts first.'); return; }
    setBusy('attach'); setError(''); setNotice('');
    try {
      await contractsApi.attach(attachPick, vehicle.id);
      setAttachFor(null);
      setAttachPick('');
      setNotice('Contract attached. You can award it to a driver now.');
      load();
    } catch (e) {
      const m = e.response?.data?.message || 'Could not attach the contract.';
      setError(Array.isArray(m) ? m.join(' ') : m);
    } finally { setBusy(''); }
  };

  const searchDrivers = async () => {
    if (!driverQuery.trim()) return;
    setBusy('search'); setError('');
    try {
      const res = await marketplaceApi.searchChatUsers(driverQuery.trim());
      setDriverResults(res.data?.data || []);
      if (!(res.data?.data || []).length) setNotice('No one found with that name or @username. Ask the driver for their exact chat username.');
    } catch { setError('Could not search for drivers.'); }
    finally { setBusy(''); }
  };

  const award = async (contract) => {
    if (!pickedDriver?.chatUsername) { setError('Find and select the driver first.'); return; }
    setBusy('award'); setError(''); setNotice('');
    try {
      const res = await contractsApi.award(contract.id, pickedDriver.chatUsername);
      const data = res.data?.data || res.data;
      setAwardFor(null);
      setPickedDriver(null);
      setDriverResults([]);
      setDriverQuery('');
      setNotice(data?.requiresDriverAccount
        ? `Awarded to @${data.driver.chatUsername}. They do not have a Driver account yet — their signing code has been sent to their phone, email and notifications, and stays valid until they create their Driver account and sign.`
        : `Awarded to @${data.driver.chatUsername}. Their signing code has been sent to their phone, email and notifications. The contract becomes active on this vehicle when they sign.`);
      load();
    } catch (e) {
      const m = e.response?.data?.message || 'Could not award the contract.';
      setError(Array.isArray(m) ? m.join(' ') : m);
    } finally { setBusy(''); }
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-ink dark:text-white">My Vehicles</h2>
          <p className="mt-0.5 max-w-xl text-sm text-steel dark:text-neutral-400">
            Every motor vehicle you own — motorbikes, tricycles, cars, vans, trucks and trailers. Attach one of your contracts to a vehicle, then award it to a driver.
          </p>
        </div>
        <button type="button" onClick={() => setShowForm((v) => !v)} className="btn-primary text-sm">{showForm ? 'Close' : '+ Add vehicle'}</button>
      </div>

      {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div>}
      {notice && <div className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm font-medium text-green-700 dark:text-green-400">{notice}</div>}

      {showForm && (
        <section className="mb-6 rounded-card border border-line bg-white p-6 shadow-card dark:border-dark-border dark:bg-dark-card dark:shadow-none">
          <h3 className="text-sm font-semibold text-ink dark:text-white">Add a vehicle — basic, public information only</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="v-type" className="label">Vehicle kind</label>
              <select id="v-type" className="input" value={form.type} onChange={(e) => set('type', e.target.value)}>
                {VEHICLE_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div><label htmlFor="v-reg" className="label">Registration number</label><input id="v-reg" className="input" placeholder="e.g. GR 1234-26" value={form.registrationNumber} onChange={(e) => set('registrationNumber', e.target.value)} /></div>
            <div><label htmlFor="v-make" className="label">Make</label><input id="v-make" className="input" placeholder="e.g. Toyota" value={form.make} onChange={(e) => set('make', e.target.value)} /></div>
            <div><label htmlFor="v-model" className="label">Model</label><input id="v-model" className="input" placeholder="e.g. Hiace" value={form.model} onChange={(e) => set('model', e.target.value)} /></div>
            <div><label htmlFor="v-year" className="label">Year</label><input id="v-year" type="number" className="input" value={form.year} onChange={(e) => set('year', e.target.value)} /></div>
            <div><label htmlFor="v-color" className="label">Colour</label><input id="v-color" className="input" value={form.color} onChange={(e) => set('color', e.target.value)} /></div>
            <div><label htmlFor="v-miles" className="label">Mileage (km)</label><input id="v-miles" type="number" min="0" className="input" value={form.mileage} onChange={(e) => set('mileage', e.target.value)} /></div>
            <div>
              <label htmlFor="v-fuel" className="label">Fuel</label>
              <select id="v-fuel" className="input" value={form.fuelType} onChange={(e) => set('fuelType', e.target.value)}>
                <option value="PETROL">Petrol</option><option value="DIESEL">Diesel</option><option value="ELECTRIC">Electric</option><option value="HYBRID">Hybrid</option><option value="LPG">LPG</option>
              </select>
            </div>
            <div>
              <label htmlFor="v-gear" className="label">Gearbox</label>
              <select id="v-gear" className="input" value={form.transmission} onChange={(e) => set('transmission', e.target.value)}>
                <option value="AUTOMATIC">Automatic</option><option value="MANUAL">Manual</option>
              </select>
            </div>
            <div>
              <label htmlFor="v-region" className="label">Region</label>
              <select id="v-region" className="input" value={form.region} onChange={(e) => set('region', e.target.value)}>
                <option value="">Choose region…</option>
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div><label htmlFor="v-loc" className="label">Area / address</label><input id="v-loc" className="input" placeholder="e.g. Osu, Accra" value={form.location} onChange={(e) => set('location', e.target.value)} /></div>
            <div>
              <label htmlFor="v-photo" className="label">Picture of the vehicle</label>
              <input id="v-photo" type="file" accept="image/jpeg,image/png,image/webp" className="input" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
              {photo && <p className="mt-1 text-xs text-steel">{photo.name}</p>}
            </div>
          </div>
          <button type="button" disabled={saving} onClick={submitVehicle} className="btn-primary mt-6 disabled:opacity-50">{saving ? 'Saving…' : 'Add vehicle'}</button>
        </section>
      )}

      <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onVehiclePhoto} aria-label="Upload a vehicle picture" />
      <SectionHeader title="Your vehicles" />
      {fetching ? (
        <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="skeleton h-32" />)}</div>
      ) : vehicles.length === 0 ? (
        <EmptyState icon="vehicle" title="No vehicles yet" description="Add your first vehicle above — any motor vehicle counts, from a motorbike to a trailer." />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {vehicles.map((v) => {
            const contract = contractByVehicle[v.id];
            const isActive = contract?.status === 'ACTIVE';
            const awarded = contract && (contract.parties || []).some((p) => p.role === 'DRIVER');
            const cover = v.imageUrls?.[0];
            return (
              <article key={v.id} className="bg-white dark:bg-dark-surface border border-neutral-200 dark:border-dark-border rounded-card overflow-hidden flex flex-col">
                <div className="relative aspect-[16/9] bg-neutral-100 dark:bg-dark-card">
                  {cover ? <img src={resolveVehiclePhoto(cover)} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs text-neutral-400">No photo yet</div>}
                  <button
                    type="button"
                    onClick={() => pickVehiclePhoto(v)}
                    disabled={photoBusy === v.id}
                    className="absolute bottom-3 right-3 rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur transition hover:bg-black/80 disabled:opacity-50"
                  >
                    {photoBusy === v.id ? 'Uploading…' : cover ? 'Change photo' : 'Add photo'}
                  </button>
                  {contract && <span className="absolute top-3 left-3 text-[11px] font-semibold bg-brand-600 text-white px-2.5 py-1 rounded-full">{TYPE_LABEL[contract.type] || contract.type}</span>}
                  <span className={`absolute top-3 right-3 text-[11px] font-semibold px-2.5 py-1 rounded-full ${isActive ? 'bg-green-600 text-white' : 'bg-black/55 text-white'}`}>
                    {isActive ? 'Active contract' : awarded ? 'Awarded — awaiting signing' : contract ? 'Contract attached' : v.status}
                  </span>
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="text-[15px] font-semibold text-neutral-900 dark:text-neutral-50">{v.make} {v.model} <span className="text-neutral-400 font-normal">· {v.year}</span></h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {v.registrationNumber} · {(VEHICLE_TYPES.find(([t]) => t === v.type)?.[1] || v.type)} · {v.color || ''}{v.mileage ? ` · ${Number(v.mileage).toLocaleString()} km` : ''} · {v.location || v.region || ''}
                  </p>

                  {contract ? (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">{contract.title || 'Contract'} <span className="font-normal text-neutral-400">({contract.contractNumber})</span></p>
                      {(() => {
                        const driverParty = (contract.parties || []).find((p) => p.role === 'DRIVER' && p.user);
                        if (!driverParty) return null;
                        const d = driverParty.user;
                        const name = [d.firstName, d.lastName].filter(Boolean).join(' ') || 'Driver';
                        return (
                          <p className="mt-2 flex items-center gap-2 text-xs">
                            <DriverAvatar photoUrl={d.profilePhotoUrl} name={name} />
                            <span className="font-semibold text-neutral-800 dark:text-neutral-100">{driverParty.signedAt ? 'Driver: ' : 'Awarded to: '}{name}</span>
                            {d.chatUsername && <span className="text-neutral-400">@{d.chatUsername}</span>}
                            <span className={driverParty.signedAt ? 'font-semibold text-green-700 dark:text-green-400' : 'font-medium text-amber-600'}>
                              {driverParty.signedAt ? '· Confirmed' : '· Awaiting signing'}
                            </span>
                          </p>
                        );
                      })()}
                      <p className="mt-1 text-xs leading-relaxed text-neutral-500">{termsSummary(contract)}</p>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-neutral-500">No contract attached yet.</p>
                  )}

                  <div className="mt-auto pt-4 space-y-2">
                    {!contract && attachFor !== v.id && (
                      <button type="button" onClick={() => { setAttachFor(v.id); setAttachPick(''); }} className="btn-primary text-sm w-full justify-center">Attach contract</button>
                    )}
                    {!contract && attachFor === v.id && (
                      <div className="space-y-2">
                        {attachable.length === 0 ? (
                          <p className="text-xs text-neutral-500">You have no unattached contracts. <Link href="/owner/contracts" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">Create one first →</Link></p>
                        ) : (
                          <>
                            <label htmlFor={`attach-${v.id}`} className="label">Choose one of your contracts</label>
                            <select id={`attach-${v.id}`} className="input" value={attachPick} onChange={(e) => setAttachPick(e.target.value)}>
                              <option value="">Select contract…</option>
                              {attachable.map((c) => <option key={c.id} value={c.id}>{c.title || 'Untitled'} — {TYPE_LABEL[c.type] || c.type} ({c.contractNumber})</option>)}
                            </select>
                            <div className="flex gap-2">
                              <button type="button" disabled={busy === 'attach' || !attachPick} onClick={() => attach(v)} className="btn-primary flex-1 justify-center text-sm disabled:opacity-50">{busy === 'attach' ? 'Attaching…' : 'Attach'}</button>
                              <button type="button" onClick={() => setAttachFor(null)} className="btn-graphite flex-1 justify-center text-sm">Cancel</button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    {contract && !awarded && awardFor !== contract.id && (
                      <button type="button" onClick={() => { setAwardFor(contract.id); setPickedDriver(null); setDriverResults([]); }} className="btn-primary text-sm w-full justify-center">Award contract</button>
                    )}
                    {contract && !awarded && awardFor === contract.id && (
                      <div className="space-y-2">
                        <label htmlFor={`award-${v.id}`} className="label">Search the driver by name or @username</label>
                        <div className="flex gap-2">
                          <input id={`award-${v.id}`} className="input" placeholder="e.g. kofi or @kofi" value={driverQuery} onChange={(e) => setDriverQuery(e.target.value)} />
                          <button type="button" disabled={busy === 'search'} onClick={searchDrivers} className="btn-graphite shrink-0 text-sm">{busy === 'search' ? '…' : 'Search'}</button>
                        </div>
                        {driverResults.map((d) => (
                          <button
                            key={d.user?.id || d.id}
                            type="button"
                            onClick={() => setPickedDriver(d.user || d)}
                            className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${pickedDriver && (pickedDriver.id === (d.user?.id || d.id)) ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40' : 'border-line dark:border-dark-border'}`}
                          >
                            {(d.user?.profilePhotoUrl || d.profilePhotoUrl) ? <img src={d.user?.profilePhotoUrl || d.profilePhotoUrl} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{(d.user?.firstName || d.firstName || '?')[0]}</span>}
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-ink dark:text-white">{d.user?.firstName || d.firstName} {d.user?.lastName || d.lastName} <span className="font-normal text-neutral-400">@{d.user?.chatUsername || d.chatUsername}</span></span>
                              <span className="block truncate text-xs text-neutral-500">{(d.accounts || d.user?.accounts || []).map((a) => a.label || a.kind || a).join(' · ') || 'User account only — no Driver account yet'}</span>
                            </span>
                          </button>
                        ))}
                        <div className="flex gap-2">
                          <button type="button" disabled={busy === 'award' || !pickedDriver} onClick={() => award(contract)} className="btn-primary flex-1 justify-center text-sm disabled:opacity-50">{busy === 'award' ? 'Awarding…' : 'Award to this driver'}</button>
                          <button type="button" onClick={() => setAwardFor(null)} className="btn-graphite flex-1 justify-center text-sm">Cancel</button>
                        </div>
                        <p className="text-xs text-neutral-500">Their signing code goes straight to their phone, email and notifications. Without a Driver account they create one first — the code stays valid.</p>
                      </div>
                    )}
                    {contract && awarded && !isActive && (
                      <p className="text-xs font-medium text-amber-600">Awarded — the vehicle becomes an active {TYPE_LABEL[contract.type] || ''} contract when the driver signs.</p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
