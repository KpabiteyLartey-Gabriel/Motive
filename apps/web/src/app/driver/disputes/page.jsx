'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { SectionHeader, EmptyState, StatusBadge } from '@/components/dashboard/DashboardUI';
import { disputesApi } from '@/lib/api';

const NAV = [
  { href: '/driver/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { href: '/driver/vehicle',   icon: 'vehicle', label: 'My Vehicle' },
  { href: '/driver/contracts', icon: 'contract', label: 'Contracts' },
  { href: '/driver/payments',  icon: 'payments', label: 'Payments' },
  { href: '/driver/earnings',  icon: 'earnings', label: 'Earnings' },
  { href: '/driver/documents', icon: 'documents', label: 'Documents' },
  { href: '/driver/disputes',  icon: 'disputes', label: 'Disputes' },
];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const DISPUTE_TYPES = [
  'PAYMENT_DISPUTE',
  'CONTRACT_DISPUTE',
  'VEHICLE_DAMAGE',
  'MAINTENANCE',
  'REVENUE_DISAGREEMENT',
  'OTHER',
];

export default function DriverDisputesPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['DRIVER'] });
  const [disputes, setDisputes]   = useState([]);
  const [fetching, setFetching]   = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm]           = useState({ type: 'PAYMENT_DISPUTE', subject: '', description: '' });
  const [error, setError]         = useState('');

  const load = () => {
    setFetching(true);
    disputesApi.list({ limit: 50 })
      .then((r) => setDisputes(r.data?.data?.disputes || []))
      .catch(() => {})
      .finally(() => setFetching(false));
  };

  useEffect(() => { if (user) load(); }, [user]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.subject.trim() || !form.description.trim()) {
      setError('Subject and description are required.');
      return;
    }
    setSubmitting(true);
    try {
      await disputesApi.create(form);
      setShowForm(false);
      setForm({ type: 'PAYMENT_DISPUTE', subject: '', description: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not file dispute.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-chalk flex items-center justify-center"><div className="text-neutral-500 text-sm">Loading…</div></div>;

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={NAV} title="Disputes">
      <div className="flex items-center justify-between mb-6">
        <SectionHeader title="My Disputes" description="Cases you have opened or are involved in" />
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-graphite text-sm"
          >
            File Dispute
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-5 mb-6 space-y-4">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">New Dispute</h3>

          <div>
            <label className="block text-xs text-neutral-500 mb-1.5">Category</label>
            <div className="flex flex-wrap gap-2">
              {DISPUTE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, type: t }))}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    form.type === t ? 'border-white text-white bg-chalk dark:bg-dark-elevated' : 'border-neutral-200 dark:border-dark-border text-neutral-400 hover:border-neutral-600'
                  }`}
                >
                  {t.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-neutral-500 mb-1.5">Subject</label>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
              placeholder="Brief subject line"
              className="w-full bg-chalk dark:bg-dark-elevated border border-neutral-200 dark:border-dark-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500"
            />
          </div>

          <div>
            <label className="block text-xs text-neutral-500 mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Describe the issue in detail…"
              rows={4}
              className="w-full bg-chalk dark:bg-dark-elevated border border-neutral-200 dark:border-dark-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500 resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-white text-black text-sm font-semibold rounded-lg hover:bg-neutral-100 transition-colors disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(''); }}
              className="btn-ghost-dark text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {fetching ? (
        <div className="text-neutral-500 text-sm py-8 text-center">Loading disputes…</div>
      ) : disputes.length === 0 ? (
        <EmptyState icon="⚖️" title="No disputes" description="File a dispute if you have an unresolved issue with a payment, contract, or vehicle condition." />
      ) : (
        <div className="space-y-3">
          {disputes.map((d) => (
            <div key={d.id} className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">{d.subject}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">{d.type?.replace(/_/g, ' ')} &middot; Filed {fmtDate(d.createdAt)}</p>
                </div>
                <StatusBadge status={d.status} />
              </div>
              {d.description && (
                <p className="text-xs text-neutral-500 mt-3 leading-relaxed line-clamp-2">{d.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
