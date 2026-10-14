'use client';

import { useEffect, useState } from 'react';
import { complianceApi } from '@/lib/api';

const DOC_TYPES = ['INSURANCE', 'ROADWORTHINESS', 'VEHICLE_REGISTRATION', 'BUSINESS_LICENSE', 'OTHER'];

export default function VehicleDocuments({ vehicle, canManage }) {
  const [docs, setDocs] = useState([]);
  const [form, setForm] = useState({ documentType: 'INSURANCE', documentNumber: '', issuer: '', expiryDate: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => complianceApi.listForVehicle(vehicle.id).then((r) => setDocs(r.data?.data || [])).catch(() => setDocs([]));
  useEffect(() => { load(); }, [vehicle.id]);

  const add = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await complianceApi.create({ vehicleId: vehicle.id, ...form, expiryDate: form.expiryDate || undefined });
      setForm({ documentType: 'INSURANCE', documentNumber: '', issuer: '', expiryDate: '' });
      load();
    } catch (err) { setError(err.response?.data?.message || 'Could not add document.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="col-span-2 mt-2">
      <p className="text-neutral-500 mb-2">Documents — insurance, roadworthiness &amp; registration</p>
      {error && <p className="text-red-500 mb-2">{Array.isArray(error) ? error.join(', ') : error}</p>}
      {docs.length === 0 ? <p className="text-neutral-400 mb-2">No documents recorded yet.</p> : (
        <div className="space-y-1 mb-3">
          {docs.map((d) => (
            <div key={d.id} className="flex justify-between gap-3">
              <span className="text-neutral-800 dark:text-neutral-200">{d.documentType.replace(/_/g, ' ')}{d.documentNumber ? ` · ${d.documentNumber}` : ''}</span>
              <span className={d.status === 'EXPIRED' ? 'text-red-500' : d.status === 'EXPIRING_SOON' ? 'text-yellow-500' : 'text-green-500'}>
                {d.status}{d.expiryDate ? ` · exp ${new Date(d.expiryDate).toLocaleDateString('en-GB')}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
      {canManage && (
        <form onSubmit={add} className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <select className="input" value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value })}>
            {DOC_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
          <input className="input" placeholder="Document no." value={form.documentNumber} onChange={(e) => setForm({ ...form, documentNumber: e.target.value })} />
          <input className="input" placeholder="Issuer" value={form.issuer} onChange={(e) => setForm({ ...form, issuer: e.target.value })} />
          <input className="input" type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
          <button disabled={busy} className="text-xs font-medium px-3 py-2 rounded-lg border border-neutral-300 dark:border-dark-border disabled:opacity-40">{busy ? 'Adding…' : 'Add document'}</button>
        </form>
      )}
    </div>
  );
}
