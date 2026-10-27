'use client';

import { useEffect, useState } from 'react';
import { servicesApi, vehiclesApi } from '@/lib/api';

// Services published by Service Providers — detailing, oil change, tyre
// sales, towing and the rest of what keeps a vehicle neat, good and safe.
// Anyone can request one for a vehicle; the provider accepts or declines,
// and both sides track it here in Servicing.

export const SERVICE_CATEGORY_LABELS = {
  DETAILING: 'Detailing',
  CAR_WASH: 'Car wash',
  OIL_CHANGE: 'Oil change',
  TYRE_SALES: 'Tyre sales',
  WHEEL_ALIGNMENT: 'Wheel alignment',
  BRAKES: 'Brakes',
  BATTERY: 'Battery',
  AC_SERVICE: 'AC service',
  DIAGNOSTICS: 'Diagnostics',
  GENERAL_SERVICING: 'General servicing',
  TOWING: 'Towing & recovery',
  OTHER: 'Other services',
};

const STATUS_STYLE = {
  REQUESTED: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  ACCEPTED: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  DECLINED: 'bg-red-500/15 text-red-600 dark:text-red-400',
  COMPLETED: 'bg-neutral-500/15 text-neutral-600 dark:text-neutral-300',
  CANCELLED: 'bg-neutral-500/15 text-neutral-500 dark:text-neutral-400',
};

function fmtPrice(s) {
  if (s.priceGhs === null || s.priceGhs === undefined) return 'Ask for price';
  const base = `GHS ${Number(s.priceGhs).toLocaleString('en-GH', { maximumFractionDigits: 2 })}`;
  return s.priceNote ? `${s.priceNote === 'from' ? 'From ' : ''}${base}${s.priceNote !== 'from' ? ` ${s.priceNote}` : ''}` : base;
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const inputCls = 'w-full bg-white dark:bg-white/5 border border-neutral-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-chalk [color-scheme:light] dark:[color-scheme:dark]';

export default function ServicesCatalog() {
  const [services, setServices] = useState(null);
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [formFor, setFormFor] = useState(null);
  const [form, setForm] = useState({ vehicleId: '', vehicleLabel: '', preferredDate: '', contactPhone: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [myRequests, setMyRequests] = useState([]);
  const [incoming, setIncoming] = useState(null);
  const [providerNotes, setProviderNotes] = useState({});

  const loadRequests = () => {
    servicesApi.myRequests().then((r) => setMyRequests(r.data?.data?.requests || [])).catch(() => {});
    servicesApi.incomingRequests().then((r) => setIncoming(r.data?.data?.requests || [])).catch(() => setIncoming(null));
  };

  useEffect(() => {
    servicesApi.list(category ? { category } : undefined)
      .then((r) => setServices(r.data?.data?.services || r.data?.services || []))
      .catch((e) => setError(e?.response?.data?.message || 'Could not load services.'));
  }, [category]);

  useEffect(() => {
    vehiclesApi.myRenewals()
      .then((r) => setVehicles((r.data?.data?.vehicles || []).map((v) => v.vehicle)))
      .catch(() => {});
    loadRequests();
  }, []);

  const openForm = (s) => {
    setNotice('');
    setFormFor(s.id);
    setForm({ vehicleId: vehicles[0]?.id || '', vehicleLabel: '', preferredDate: '', contactPhone: '', notes: '' });
  };

  const submitRequest = async (s) => {
    setSubmitting(true);
    setError('');
    try {
      await servicesApi.request(s.id, {
        vehicleId: form.vehicleId || undefined,
        vehicleLabel: form.vehicleId ? undefined : form.vehicleLabel.trim() || undefined,
        preferredDate: form.preferredDate || undefined,
        contactPhone: form.contactPhone.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      setFormFor(null);
      setNotice(`Request sent to ${s.provider.businessName} for "${s.title}". They will accept or decline — watch "My service requests" below and your notifications.`);
      loadRequests();
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not send the request.');
    } finally { setSubmitting(false); }
  };

  const actOnMine = async (r) => {
    await servicesApi.updateRequestStatus(r.id, { status: 'CANCELLED' }).catch(() => {});
    loadRequests();
  };

  const actOnIncoming = async (r, status) => {
    await servicesApi.updateRequestStatus(r.id, { status, providerNote: providerNotes[r.id] || undefined }).catch(() => {});
    loadRequests();
  };

  const categories = ['', ...Object.keys(SERVICE_CATEGORY_LABELS)];

  return (
    <section className="border border-neutral-200 dark:border-white/10 bg-white dark:bg-transparent rounded-2xl p-5 mb-6 shadow-sm dark:shadow-none">
      <h2 className="font-semibold text-neutral-900 dark:text-chalk">Services for your vehicle</h2>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
        Published by service providers — the work that keeps a vehicle neat, in good shape and
        safe on the road. Pick a service, say which vehicle it is for, and send the request.
      </p>

      <div className="flex gap-2 flex-wrap mt-4">
        {categories.map((c) => (
          <button
            key={c || 'ALL'}
            onClick={() => setCategory(c)}
            className={`text-xs px-3 py-1.5 rounded-full border ${category === c
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'border-neutral-300 dark:border-white/15 text-neutral-600 dark:text-neutral-300'}`}
          >
            {c ? SERVICE_CATEGORY_LABELS[c] : 'All services'}
          </button>
        ))}
      </div>

      {notice && <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-3">{notice}</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400 mt-3">{error}</p>}
      {!services && !error && <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-4">Loading services…</p>}
      {services && services.length === 0 && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-4">
          No services published yet{category ? ' in this category' : ''}. Service providers publish here.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 mt-4">
        {services?.map((s) => (
          <article key={s.id} className="border border-neutral-200 dark:border-white/10 rounded-xl p-4 flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                {SERVICE_CATEGORY_LABELS[s.category] || s.category}
              </span>
              <span className="text-sm font-semibold text-neutral-900 dark:text-chalk">{fmtPrice(s)}</span>
            </div>
            <h3 className="font-medium text-neutral-900 dark:text-chalk mt-3">{s.title}</h3>
            {s.description && <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{s.description}</p>}
            <div className="mt-auto pt-3">
              <p className="text-xs font-medium text-neutral-700 dark:text-neutral-200">{s.provider.businessName}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {[s.provider.city, s.provider.region].filter(Boolean).join(', ') || 'Ghana'}
                {s.durationMins ? ` · about ${s.durationMins} mins` : ''}
              </p>
              <div className="flex gap-2 mt-2 flex-wrap">
                <button onClick={() => (formFor === s.id ? setFormFor(null) : openForm(s))} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-medium">
                  {formFor === s.id ? 'Close' : 'Request this service'}
                </button>
                {s.provider.phone && (
                  <a href={`tel:${s.provider.phone.replace(/\s/g, '')}`} className="text-xs px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-white/15 text-neutral-700 dark:text-neutral-200 font-medium">
                    Call provider
                  </a>
                )}
              </div>

              {formFor === s.id && (
                <div className="mt-3 border-t border-neutral-100 dark:border-white/10 pt-3 space-y-2">
                  {vehicles.length > 0 ? (
                    <select value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })} className={inputCls}>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>{v.year} {v.make} {v.model} · {v.registrationNumber}</option>
                      ))}
                      <option value="">Other vehicle — describe it below</option>
                    </select>
                  ) : null}
                  {!form.vehicleId && (
                    <input value={form.vehicleLabel} onChange={(e) => setForm({ ...form, vehicleLabel: e.target.value })} placeholder="Describe your vehicle, e.g. My 2018 Toyota Corolla, GE-2477-24" className={inputCls} />
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <input type="date" value={form.preferredDate} onChange={(e) => setForm({ ...form, preferredDate: e.target.value })} className={inputCls} />
                    <input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} placeholder="Your phone (optional)" className={inputCls} />
                  </div>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Anything the provider should know? (optional)" rows={2} className={inputCls} />
                  <button onClick={() => submitRequest(s)} disabled={submitting} className="text-xs px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-60">
                    {submitting ? 'Sending…' : 'Send request'}
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      {myRequests.length > 0 && (
        <div className="mt-6">
          <h3 className="font-medium text-neutral-900 dark:text-chalk">My service requests</h3>
          <div className="grid gap-3 md:grid-cols-2 mt-3">
            {myRequests.map((r) => (
              <article key={r.id} className="border border-neutral-200 dark:border-white/10 rounded-xl p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-neutral-900 dark:text-chalk">{r.service.title}</span>
                  <span className={`text-[11px] px-2 py-1 rounded-full ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  {r.provider.businessName} · {r.vehicleLabel}
                  {r.preferredDate ? ` · preferred ${fmtDate(r.preferredDate)}` : ''}
                </p>
                {r.providerNote && <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1">Provider: {r.providerNote}</p>}
                {r.status === 'REQUESTED' && (
                  <button onClick={() => actOnMine(r)} className="mt-2 text-xs px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-white/15 text-neutral-700 dark:text-neutral-200">Cancel request</button>
                )}
              </article>
            ))}
          </div>
        </div>
      )}

      {incoming && incoming.length > 0 && (
        <div className="mt-6">
          <h3 className="font-medium text-neutral-900 dark:text-chalk">Requests for my services</h3>
          <div className="grid gap-3 md:grid-cols-2 mt-3">
            {incoming.map((r) => (
              <article key={r.id} className="border border-neutral-200 dark:border-white/10 rounded-xl p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-neutral-900 dark:text-chalk">{r.service.title}</span>
                  <span className={`text-[11px] px-2 py-1 rounded-full ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  {r.requester?.name || 'A +Motive user'}
                  {r.requester?.chatUsername ? ` · @${r.requester.chatUsername}` : ''}
                  {r.contactPhone ? ` · ${r.contactPhone}` : r.requester?.phone ? ` · ${r.requester.phone}` : ''}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{r.vehicleLabel}{r.preferredDate ? ` · preferred ${fmtDate(r.preferredDate)}` : ''}</p>
                {r.notes && <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1">“{r.notes}”</p>}
                {(r.status === 'REQUESTED' || r.status === 'ACCEPTED') && (
                  <div className="mt-2 space-y-2">
                    <input value={providerNotes[r.id] || ''} onChange={(e) => setProviderNotes({ ...providerNotes, [r.id]: e.target.value })} placeholder="Reply note, e.g. Saturday 9am works" className={inputCls} />
                    <div className="flex gap-2 flex-wrap">
                      {r.status === 'REQUESTED' && <>
                        <button onClick={() => actOnIncoming(r, 'ACCEPTED')} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-medium">Accept</button>
                        <button onClick={() => actOnIncoming(r, 'DECLINED')} className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white font-medium">Decline</button>
                      </>}
                      {r.status === 'ACCEPTED' && (
                        <button onClick={() => actOnIncoming(r, 'COMPLETED')} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-medium">Mark completed</button>
                      )}
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
