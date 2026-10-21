'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { OWNER_NAV } from '@/lib/ownerNav';
import { SectionHeader, EmptyState, StatusBadge } from '@/components/dashboard/DashboardUI';
import Link from 'next/link';
import { vehiclesApi, complianceApi, companiesApi, marketplaceApi, resolveVehiclePhoto } from '@/lib/api';
import VehiclePhotos from '@/components/vehicles/VehiclePhotos';

const NAV = OWNER_NAV;

const STATUS_COLORS = {
  AVAILABLE: 'text-green-400',
  ASSIGNED: 'text-blue-400',
  MAINTENANCE: 'text-yellow-400',
  INACTIVE: 'text-neutral-500',
};

const VEHICLE_TYPES = ['SEDAN', 'SUV', 'PICKUP', 'MINIBUS', 'BUS', 'TRUCK', 'MOTORCYCLE', 'TRICYCLE', 'OTHER'];
const FUEL_TYPES = ['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'LPG'];
const TRANSMISSIONS = ['MANUAL', 'AUTOMATIC'];
const GHANA_REGIONS = ['Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern', 'Greater Accra', 'North East', 'Northern', 'Oti', 'Savannah', 'Upper East', 'Upper West', 'Volta', 'Western', 'Western North'];
const OPERATING_MODELS = [
  { value: 'WORK_AND_PAY', label: 'Work & Pay' },
  { value: 'DRIVING_ON', label: 'Driving On (DriveOn)' },
  { value: 'RENTAL', label: 'Rental' },
];
const EMPTY_FORM = { registrationNumber: '', make: '', model: '', year: new Date().getFullYear(), color: '', chassisNumber: '', type: 'SEDAN', fuelType: 'PETROL', transmission: 'AUTOMATIC', operatingModel: 'WORK_AND_PAY', managingCompanyId: '', mileage: '', estimatedValue: '', region: '' };
const EVIDENCE_SLOTS = [
  { kind: 'frontPlate', label: 'Front of vehicle — number plate clearly visible' },
  { kind: 'rearPlate', label: 'Rear of vehicle — number plate clearly visible' },
  { kind: 'vinPlate', label: 'Chassis / VIN plate — close-up, numbers readable' },
  { kind: 'registrationCert', label: 'Vehicle Registration Certificate (DVLA)' },
];
const VERIFICATION_TEXT = {
  NOT_SUBMITTED: 'Not submitted yet — complete the checklist below and submit for verification.',
  PENDING_REVIEW: 'Submitted — waiting for a Super Admin to verify this vehicle.',
  APPROVED: 'Verified — this vehicle can be published.',
  REJECTED: 'Not verified — read the reason below, correct it, and resubmit.',
};

export default function OwnerVehiclesPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['OWNER'] });
  const [vehicles, setVehicles]   = useState([]);
  const [fetching, setFetching]   = useState(true);
  const [selected, setSelected]   = useState(null);
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState('');
  const [statusBusy, setStatusBusy] = useState(false);
  const [newModel, setNewModel]       = useState('WORK_AND_PAY');
  const [modelBusy, setModelBusy]     = useState(false);
  const [modelMsg, setModelMsg]       = useState('');
  const [pendingReq, setPendingReq]   = useState(null);
  const [companies, setCompanies]     = useState([]);
  const [rentalCompanyId, setRentalCompanyId] = useState('');
  const [vChassis, setVChassis]       = useState('');
  const [verifyBusy, setVerifyBusy]   = useState('');
  const [verifyMsg, setVerifyMsg]     = useState('');

  useEffect(() => {
    if (!user) return;
    companiesApi.list({ limit: 50 })
      .then((r) => setCompanies((r.data?.data?.companies || []).filter((c) => c.status === 'ACTIVE')))
      .catch(() => setCompanies([]));
  }, [user]);

  useEffect(() => {
    if (!selected?.id) { setPendingReq(null); return; }
    setNewModel(selected.operatingModel || 'WORK_AND_PAY');
    setRentalCompanyId(selected.managingCompanyId || '');
    setVChassis(selected.chassisNumber || '');
    setVerifyMsg('');
    setModelMsg('');
    vehiclesApi.getPendingModelChange(selected.id)
      .then((r) => setPendingReq(r.data?.data || null))
      .catch(() => setPendingReq(null));
  }, [selected?.id]);

  const changeModel = async (vehicle) => {
    if (newModel === 'RENTAL' && !rentalCompanyId && !vehicle.managingCompanyId) {
      setModelMsg('Only companies can publish vehicles for rent. Choose the company that will rent this vehicle out.');
      return;
    }
    setModelBusy(true);
    setModelMsg('');
    try {
      const res = await vehiclesApi.changeOperatingModel(vehicle.id, newModel, newModel === 'RENTAL' ? (rentalCompanyId || undefined) : undefined);
      const d = res.data?.data || {};
      if (d.approvalRequired) {
        setPendingReq(d.request);
        if (d.vehicle) {
          setVehicles((prev) => prev.map((x) => (x.id === d.vehicle.id ? { ...x, ...d.vehicle } : x)));
          setSelected((s) => (s?.id === d.vehicle.id ? { ...s, ...d.vehicle } : s));
        }
        setModelMsg('Change requested. Because this is a Work & Pay vehicle with a driver assigned, the driver must approve it before it changes — the vehicle is becoming theirs.');
      } else if (d.vehicle) {
        setVehicles((prev) => prev.map((x) => (x.id === d.vehicle.id ? { ...x, ...d.vehicle } : x)));
        setSelected((s) => (s?.id === d.vehicle.id ? { ...s, ...d.vehicle } : s));
        setModelMsg(d.companyUpdated ? 'Rental company saved. You can publish this vehicle now.' : 'Contract type updated.');
      }
    } catch (e) {
      setModelMsg(e.response?.data?.message || 'Could not change the contract type.');
    } finally {
      setModelBusy(false);
    }
  };

  const applyVehicleUpdate = (updated) => {
    if (!updated?.id) return;
    setVehicles((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
    setSelected((s) => (s?.id === updated.id ? { ...s, ...updated } : s));
  };

  const saveIdentity = async (vehicle) => {
    setVerifyBusy('identity');
    setVerifyMsg('');
    try {
      const res = await vehiclesApi.updateDetails(vehicle.id, { chassisNumber: vChassis.trim() });
      applyVehicleUpdate(res.data?.data);
      setVerifyMsg('Chassis number saved.');
    } catch (e) {
      setVerifyMsg(e.response?.data?.message || 'Could not save those details.');
    } finally {
      setVerifyBusy('');
    }
  };

  const uploadEvidence = async (vehicle, kind, file) => {
    if (!file) return;
    setVerifyBusy(kind);
    setVerifyMsg('');
    try {
      const res = await vehiclesApi.uploadEvidence(vehicle.id, kind, file);
      applyVehicleUpdate(res.data?.data);
    } catch (e) {
      setVerifyMsg(e.response?.data?.message || 'Evidence upload failed.');
    } finally {
      setVerifyBusy('');
    }
  };

  const submitVerification = async (vehicle) => {
    setVerifyBusy('submit');
    setVerifyMsg('');
    try {
      const res = await vehiclesApi.submitVerification(vehicle.id);
      applyVehicleUpdate(res.data?.data);
      setVerifyMsg('Submitted. A Super Admin will check the details against your images; you will be notified of the outcome.');
    } catch (e) {
      const m = e.response?.data?.message || 'Could not submit for verification.';
      setVerifyMsg(Array.isArray(m) ? m.join(' ') : m);
    } finally {
      setVerifyBusy('');
    }
  };

  const loadVehicles = () => {
    vehiclesApi.list({ limit: 50 })
      .then((r) => setVehicles(r.data?.data?.vehicles || []))
      .catch(() => {})
      .finally(() => setFetching(false));
  };

  useEffect(() => {
    if (!user) return;
    loadVehicles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const [interests, setInterests] = useState([]);
  const [interestBusy, setInterestBusy] = useState('');
  useEffect(() => {
    if (!selected?.id) { setInterests([]); return; }
    marketplaceApi.vehicleInterests(selected.id)
      .then((r) => setInterests(r.data?.data || []))
      .catch(() => setInterests([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const actOnInterest = async (interest, action) => {
    setInterestBusy(`${action}-${interest.id}`);
    try {
      if (action === 'approve') await marketplaceApi.approveInterest(interest.id);
      if (action === 'decline') await marketplaceApi.declineInterest(interest.id);
      if (action === 'release') await marketplaceApi.releaseInterest(interest.id);
      const r = await marketplaceApi.vehicleInterests(interest.vehicleId);
      setInterests(r.data?.data || []);
      loadVehicles();
    } catch (e) {
      window.alert(e.response?.data?.message || 'Action failed.');
    } finally {
      setInterestBusy('');
    }
  };

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submitVehicle = async (publish) => {
    setFormError('');
    if (!form.registrationNumber.trim() || !form.make.trim() || !form.model.trim() || !form.year) {
      setFormError('Registration number, make, model and year are required.');
      return;
    }
    if (publish && form.operatingModel === 'RENTAL' && !form.managingCompanyId) {
      setFormError('Only companies can publish vehicles for rent. Choose the company that will rent this vehicle out, or save it as a draft and choose later.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        registrationNumber: form.registrationNumber.trim(),
        make: form.make.trim(),
        model: form.model.trim(),
        year: Number(form.year),
        color: form.color.trim() || undefined,
        type: form.type,
        fuelType: form.fuelType,
        transmission: form.transmission,
        operatingModel: form.operatingModel,
        chassisNumber: form.chassisNumber.trim() || undefined,
        managingCompanyId: form.operatingModel === 'RENTAL' && form.managingCompanyId ? form.managingCompanyId : undefined,
        mileage: form.mileage ? Number(form.mileage) : undefined,
        estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : undefined,
        region: form.region.trim() || undefined,
        publish,
      };
      const res = await vehiclesApi.create(payload);
      const created = res.data?.data;
      setVehicles((prev) => [created, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
      if (created?.id) setSelected(created);
    } catch (e) {
      const m = e.response?.data?.message || 'Could not save the vehicle. Please try again.';
      setFormError(Array.isArray(m) ? m.join(' ') : m);
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (vehicle, status) => {
    setStatusBusy(true);
    try {
      const res = await vehiclesApi.updateStatus(vehicle.id, status);
      const updated = res.data?.data || { ...vehicle, status };
      setVehicles((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
      setSelected((s) => (s?.id === updated.id ? { ...s, ...updated } : s));
    } catch (e) {
      alert(e.response?.data?.message || 'Could not update the vehicle status.');
    } finally {
      setStatusBusy(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-chalk flex items-center justify-center"><div className="text-neutral-500 text-sm">Loading…</div></div>;

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={NAV} title="My Vehicles">
      <SectionHeader title="Registered Vehicles" description="Vehicles registered under your account" />

      <div className="flex justify-end mb-4">
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary text-sm">
          {showForm ? 'Close form' : '+ Add vehicle'}
        </button>
      </div>

      {showForm && (
        <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-5 mb-5">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-1">Add a vehicle</h3>
          <p className="text-xs text-neutral-400 mb-4">Publish it now to make it Available for contracts, or save it as a draft and publish later. You can add photos after saving.</p>
          {formError && <div className="bg-danger/10 border border-danger/20 text-danger text-xs px-4 py-3 rounded-lg mb-4">{formError}</div>}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <label className="text-xs text-neutral-400">Registration number *<input className="input mt-1" placeholder="GR-1234-26" value={form.registrationNumber} onChange={(e) => set('registrationNumber', e.target.value)} /></label>
            <label className="text-xs text-neutral-400">Make *<input className="input mt-1" placeholder="Toyota" value={form.make} onChange={(e) => set('make', e.target.value)} /></label>
            <label className="text-xs text-neutral-400">Model *<input className="input mt-1" placeholder="Corolla" value={form.model} onChange={(e) => set('model', e.target.value)} /></label>
            <label className="text-xs text-neutral-400">Year *<input className="input mt-1" type="number" min="1980" max="2100" value={form.year} onChange={(e) => set('year', e.target.value)} /></label>
            <label className="text-xs text-neutral-400">Colour<input className="input mt-1" placeholder="White" value={form.color} onChange={(e) => set('color', e.target.value)} /></label>
            <label className="text-xs text-neutral-400">Chassis number<input className="input mt-1" placeholder="From the VIN plate / registration certificate" value={form.chassisNumber} onChange={(e) => set('chassisNumber', e.target.value)} /></label>
            <label className="text-xs text-neutral-400">Region
              <select className="input mt-1" value={form.region} onChange={(e) => set('region', e.target.value)}>
                <option value="">Select region…</option>
                {GHANA_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="text-xs text-neutral-400">Vehicle type
              <select className="input mt-1" value={form.type} onChange={(e) => set('type', e.target.value)}>{VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select>
            </label>
            <label className="text-xs text-neutral-400">Fuel
              <select className="input mt-1" value={form.fuelType} onChange={(e) => set('fuelType', e.target.value)}>{FUEL_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select>
            </label>
            <label className="text-xs text-neutral-400">Transmission
              <select className="input mt-1" value={form.transmission} onChange={(e) => set('transmission', e.target.value)}>{TRANSMISSIONS.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select>
            </label>
            <label className="text-xs text-neutral-400">How it will earn
              <select className="input mt-1" value={form.operatingModel} onChange={(e) => set('operatingModel', e.target.value)}>{OPERATING_MODELS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
            </label>
            {form.operatingModel === 'RENTAL' && (
              <label className="text-xs text-neutral-400">Company that will rent it out *
                <select className="input mt-1" value={form.managingCompanyId} onChange={(e) => set('managingCompanyId', e.target.value)}>
                  <option value="">Choose a company…</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}{c.city ? ` — ${c.city}` : ''}</option>)}
                </select>
                <span className="block mt-1 text-neutral-500">Only companies publish rentals. This company will manage and rent out the vehicle.</span>
              </label>
            )}
            <label className="text-xs text-neutral-400">Mileage (km)<input className="input mt-1" type="number" min="0" placeholder="85000" value={form.mileage} onChange={(e) => set('mileage', e.target.value)} /></label>
            <label className="text-xs text-neutral-400">Estimated value (GHS)<input className="input mt-1" type="number" min="0" placeholder="95000" value={form.estimatedValue} onChange={(e) => set('estimatedValue', e.target.value)} /></label>
          </div>
          <div className="flex gap-3 mt-5 flex-wrap">
            <button onClick={() => submitVehicle(true)} disabled={saving} className="btn-primary text-sm disabled:opacity-40">{saving ? 'Saving…' : 'Publish vehicle'}</button>
            <button onClick={() => submitVehicle(false)} disabled={saving} className="btn-graphite text-sm disabled:opacity-40">Save as draft</button>
          </div>
        </div>
      )}

      {fetching ? (
        <div className="text-neutral-500 text-sm py-8 text-center">Loading vehicles…</div>
      ) : vehicles.length === 0 ? (
        <EmptyState icon="🚗" title="No vehicles yet" description="Use the Add vehicle button above to register and publish your first vehicle." />
      ) : (
        <div className="space-y-3">
          {vehicles.map((v) => (
            <div
              key={v.id}
              className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-4 cursor-pointer hover:border-neutral-600 transition-colors"
              onClick={() => setSelected(selected?.id === v.id ? null : v)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">{v.registrationNumber}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">{v.make} {v.model} {v.year && `· ${v.year}`}</p>
                </div>
                <span className={`text-xs font-medium ${STATUS_COLORS[v.status] || 'text-neutral-500'}`}>{v.status}</span>
              </div>

              {selected?.id === v.id && (
                <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-dark-border grid grid-cols-2 gap-3 text-xs" onClick={(e) => e.stopPropagation()}>
                  <div className="col-span-2 flex items-center gap-3 flex-wrap">
                    {v.status === 'DRAFT' && (
                      <button onClick={() => changeStatus(v, 'AVAILABLE')} disabled={statusBusy} className="btn-primary text-xs disabled:opacity-40">Publish vehicle</button>
                    )}
                    {v.status === 'AVAILABLE' && (
                      <button onClick={() => changeStatus(v, 'DRAFT')} disabled={statusBusy} className="btn-graphite text-xs disabled:opacity-40">Unpublish</button>
                    )}
                    {v.status !== 'DRAFT' && v.status !== 'AVAILABLE' && (
                      <span className="text-neutral-400">Status is managed by its contract or maintenance.</span>
                    )}
                    <span className="text-neutral-500">{v.status === 'AVAILABLE' ? 'Published — available for contracts' : v.status === 'DRAFT' ? 'Draft — only you can see it' : v.status.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="col-span-2 border-t border-neutral-200 dark:border-dark-border pt-4">
                    <p className="text-neutral-500 mb-2">Contract type: <span className="font-semibold text-neutral-800 dark:text-neutral-100">{(v.operatingModel || 'Not set').replace(/_/g, ' ')}</span></p>
                    {pendingReq ? (
                      <div className="bg-solar-yellow/10 border border-solar-yellow/30 rounded-lg px-3 py-2.5 text-amber-700 dark:text-amber-300">
                        Waiting for the assigned driver to approve changing {(pendingReq.fromModel || '').replace(/_/g, ' ')} → {(pendingReq.toModel || '').replace(/_/g, ' ')}. Work & Pay vehicles become the driver&apos;s own, so they must agree first.
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <select className="input !w-auto text-xs" value={newModel} onChange={(e) => setNewModel(e.target.value)}>
                          {OPERATING_MODELS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        {newModel === 'RENTAL' && (
                          <select className="input !w-auto text-xs" value={rentalCompanyId} onChange={(e) => setRentalCompanyId(e.target.value)}>
                            <option value="">Choose the company that will rent it out…</option>
                            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}{c.city ? ` — ${c.city}` : ''}</option>)}
                          </select>
                        )}
                        <button onClick={() => changeModel(v)} disabled={modelBusy || (newModel === v.operatingModel && !(newModel === 'RENTAL' && !v.managingCompanyId && rentalCompanyId))} className="btn-primary text-xs disabled:opacity-40">{modelBusy ? 'Saving…' : newModel === v.operatingModel && newModel === 'RENTAL' ? 'Save rental company' : 'Change contract type'}</button>
                        <span className="text-neutral-400">Work & Pay changes with a driver assigned need the driver&apos;s approval. DriveOn can be changed any time. Rental is published through a company you choose.</span>
                      </div>
                    )}
                    {modelMsg && <p className="mt-2 text-neutral-500">{modelMsg}</p>}
                  </div>
                  <div className="col-span-2 border-t border-neutral-200 dark:border-dark-border pt-4">
                    <p className="text-neutral-500 mb-1">Explore &amp; driver interest: <span className="font-semibold text-neutral-800 dark:text-neutral-100">{interests.filter((i) => ['PENDING', 'APPROVED'].includes(i.status)).length} driver{interests.filter((i) => ['PENDING', 'APPROVED'].includes(i.status)).length === 1 ? '' : 's'} interested</span></p>
                    <p className="text-neutral-400 mb-3">Verified, published vehicles appear on Explore for drivers. Approving one driver removes this vehicle from Explore — chat with everyone first, and release the driver later if you want it listed again.</p>
                    {interests.length === 0 ? (
                      <p className="text-neutral-400">No drivers have shown interest yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {interests.map((i) => (
                          <div key={i.id} className="flex items-center gap-3 flex-wrap border border-neutral-200 dark:border-dark-border rounded-lg px-3 py-2.5">
                            <div className="min-w-0 flex-1">
                              <p className="text-neutral-800 dark:text-neutral-100 font-medium">{i.driverUser ? `${i.driverUser.firstName || ''} ${i.driverUser.lastName || ''}`.trim() : 'Driver'} <span className={`ml-1 text-[11px] font-semibold ${i.status === 'APPROVED' ? 'text-green-600' : i.status === 'DECLINED' ? 'text-red-500' : i.status === 'RELEASED' ? 'text-neutral-400' : 'text-amber-600'}`}>{i.status}</span></p>
                              {i.message && <p className="text-neutral-400 truncate">&ldquo;{i.message}&rdquo;</p>}
                            </div>
                            {i.threadId && <Link href={`/owner/messages?thread=${i.threadId}`} className="btn-graphite text-xs">Open chat</Link>}
                            {i.status === 'PENDING' && (
                              <>
                                <button onClick={() => actOnInterest(i, 'approve')} disabled={!!interestBusy} className="btn-primary text-xs disabled:opacity-40">Approve driver</button>
                                <button onClick={() => actOnInterest(i, 'decline')} disabled={!!interestBusy} className="btn-graphite text-xs disabled:opacity-40">Decline</button>
                              </>
                            )}
                            {i.status === 'APPROVED' && (
                              <button onClick={() => actOnInterest(i, 'release')} disabled={!!interestBusy} className="btn-graphite text-xs disabled:opacity-40">Release &amp; relist</button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="col-span-2 border-t border-neutral-200 dark:border-dark-border pt-4">
                    <p className="text-neutral-500 mb-1">Verification before publishing: <span className="font-semibold text-neutral-800 dark:text-neutral-100">{(v.verificationStatus || 'NOT_SUBMITTED').replace(/_/g, ' ')}</span></p>
                    <p className="text-neutral-400 mb-3">{VERIFICATION_TEXT[v.verificationStatus || 'NOT_SUBMITTED']}</p>
                    {v.verificationStatus === 'REJECTED' && v.verificationNote && (
                      <div className="bg-danger/10 border border-danger/20 rounded-lg px-3 py-2.5 text-red-700 dark:text-red-300 mb-3">Reason: {v.verificationNote}</div>
                    )}
                    {v.verificationStatus !== 'APPROVED' && v.verificationStatus !== 'PENDING_REVIEW' && (
                      <>
                        <p className="text-neutral-400 mb-3">A Super Admin confirms these against your evidence: registration <b>{v.registrationNumber}</b>, make/model/year, colour, type and fuel — exactly as on the DVLA registration certificate.</p>
                        <div className="flex items-end gap-2 flex-wrap mb-3">
                          <label className="text-xs text-neutral-400">Chassis number *<input className="input mt-1" placeholder="JTDBR32E862000111" value={vChassis} onChange={(e) => setVChassis(e.target.value)} /></label>
                          <button onClick={() => saveIdentity(v)} disabled={verifyBusy === 'identity'} className="btn-graphite text-xs disabled:opacity-40">{verifyBusy === 'identity' ? 'Saving…' : 'Save chassis number'}</button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                          {EVIDENCE_SLOTS.map((slot) => {
                            const url = v.verificationEvidence?.[slot.kind];
                            return (
                              <div key={slot.kind} className="border border-neutral-200 dark:border-dark-border rounded-lg p-2">
                                <p className="text-[11px] text-neutral-500 mb-2 leading-snug">{slot.label}</p>
                                {url ? <img src={resolveVehiclePhoto(url)} alt="" className="w-full h-20 object-cover rounded-md mb-2" /> : <div className="w-full h-20 rounded-md bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-[11px] text-neutral-400 mb-2">No image yet</div>}
                                <label className="btn-primary text-[11px] inline-block cursor-pointer disabled:opacity-40">
                                  {verifyBusy === slot.kind ? 'Uploading…' : url ? 'Replace image' : 'Upload image'}
                                  <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadEvidence(v, slot.kind, e.target.files?.[0])} />
                                </label>
                              </div>
                            );
                          })}
                        </div>
                        <button onClick={() => submitVerification(v)} disabled={verifyBusy === 'submit'} className="btn-primary text-xs disabled:opacity-40">{verifyBusy === 'submit' ? 'Submitting…' : v.verificationStatus === 'REJECTED' ? 'Resubmit for verification' : 'Submit for verification'}</button>
                      </>
                    )}
                    {verifyMsg && <p className="mt-2 text-neutral-500">{verifyMsg}</p>}
                  </div>
                  <VehiclePhotos vehicle={v} editable onPhotosChange={(upd) => { setVehicles((prev) => prev.map((x) => (x.id === upd.id ? { ...x, ...upd } : x))); setSelected((s) => (s?.id === upd.id ? { ...s, ...upd } : s)); }} />
                  <div>
                    <p className="text-neutral-500">VIN / Chassis</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{v.vin || '—'}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Type</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{v.type || '—'}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Colour</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{v.color || '—'}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Verified</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{v.verified ? 'Yes' : 'Pending'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-neutral-500">Description</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{v.description || '—'}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
