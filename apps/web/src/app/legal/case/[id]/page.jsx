'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { StatusBadge } from '@/components/dashboard/DashboardUI';
import { disputesApi } from '@/lib/api';

import { LEGAL_NAV, LEGAL_ROLES } from '@/lib/legalNav';

const TRANSITION_STATUSES = [
  'OPEN', 'AWAITING_RESPONSE', 'UNDER_REVIEW', 'MEDIATION',
  'DECISION_PENDING', 'RESOLVED', 'REJECTED', 'ESCALATED', 'CLOSED', 'APPEALED',
];

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between px-4 py-3 gap-4 border-b border-neutral-200 dark:border-dark-border last:border-0">
      <span className="text-xs text-neutral-500 flex-shrink-0 w-28">{label}</span>
      <span className="text-xs text-neutral-300 text-right break-all">{value || '—'}</span>
    </div>
  );
}

function TimelineEntry({ entry }) {
  const isMessage  = entry._type === 'message';
  const isEvidence = entry._type === 'evidence';

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${
          isEvidence ? 'bg-blue-400' : isMessage ? 'bg-neutral-500' : 'bg-yellow-400'
        }`} />
        <div className="w-px flex-1 bg-dark-border mt-1" />
      </div>
      <div className="pb-5 flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-white">
            {entry.author
              ? `${entry.author.firstName} ${entry.author.lastName}`
              : isEvidence ? 'Evidence' : 'System'}
          </span>
          <span className="text-xs text-neutral-600">{fmt(entry.createdAt)}</span>
          {isEvidence && (
            <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded">Evidence</span>
          )}
        </div>
        {isMessage && entry.content && (
          <p className="text-xs text-neutral-400 leading-relaxed">{entry.content}</p>
        )}
        {isEvidence && (
          <div className="bg-chalk dark:bg-dark-elevated border border-neutral-200 dark:border-dark-border rounded-lg px-3 py-2 mt-1 inline-flex items-center gap-2">
            <span className="text-xs text-neutral-300">{entry.type || 'File'}</span>
            {entry.url && (
              <a href={entry.url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                View ↗
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LegalCaseDetailPage() {
  const { id } = useParams();
  const { user, loading, logout } = useAuth({ requiredRoles: LEGAL_ROLES });
  const [dispute, setDispute]       = useState(null);
  const [fetching, setFetching]     = useState(true);
  const [notFound, setNotFound]     = useState(false);

  // Status transition
  const [newStatus, setNewStatus]   = useState('');
  const [resolution, setResolution] = useState('');
  const [updating, setUpdating]     = useState(false);
  const [statusErr, setStatusErr]   = useState('');

  // Message
  const [msgText, setMsgText]       = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [msgErr, setMsgErr]         = useState('');

  const load = useCallback(() => {
    if (!id || !user) return;
    setFetching(true);
    disputesApi.getById(id)
      .then((r) => {
        setDispute(r.data?.data?.dispute || r.data?.data || null);
        if (!r.data?.data) setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setFetching(false));
  }, [id, user]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (e) => {
    e.preventDefault();
    if (!newStatus) { setStatusErr('Select a status.'); return; }
    setStatusErr('');
    setUpdating(true);
    try {
      await disputesApi.updateStatus(id, newStatus, resolution || undefined);
      setNewStatus('');
      setResolution('');
      load();
    } catch (err) {
      setStatusErr(err.response?.data?.message || 'Could not update status.');
    } finally {
      setUpdating(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!msgText.trim()) { setMsgErr('Message cannot be empty.'); return; }
    setMsgErr('');
    setSendingMsg(true);
    try {
      await disputesApi.addMessage(id, { content: msgText });
      setMsgText('');
      load();
    } catch (err) {
      setMsgErr(err.response?.data?.message || 'Could not send message.');
    } finally {
      setSendingMsg(false);
    }
  };

  if (loading || fetching) {
    return (
      <div className="min-h-screen bg-chalk flex items-center justify-center">
        <div className="text-neutral-500 text-sm">Loading…</div>
      </div>
    );
  }

  if (notFound || !dispute) {
    return (
      <DashboardShell loading={loading} user={user} logout={logout} navItems={LEGAL_NAV} title="Case Not Found">
        <div className="py-20 text-center">
          <p className="text-sm text-steel dark:text-neutral-500">Case not found or you do not have access.</p>
          <a href="/legal/cases" className="mt-4 inline-block text-xs text-neutral-400 hover:text-white transition-colors">← Back to cases</a>
        </div>
      </DashboardShell>
    );
  }

  // Build chronological timeline from messages + evidence
  const messages  = (dispute.messages  || []).map((m) => ({ ...m, _type: 'message' }));
  const evidence  = (dispute.evidence  || []).map((ev) => ({ ...ev, _type: 'evidence' }));
  const timeline  = [...messages, ...evidence].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  return (
    <DashboardShell loading={loading} user={user} logout={logout} navItems={LEGAL_NAV} title="Case Detail">
      {/* Back */}
      <div className="mb-5">
        <a href="/legal/cases" className="text-xs text-neutral-500 hover:text-white transition-colors">← Back to cases</a>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div>
          <p className="text-xs text-neutral-600 font-mono mb-1">{dispute.id}</p>
          <h2 className="text-xl font-bold text-white mb-2">{dispute.type?.replace(/_/g, ' ') || 'Dispute Case'}</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={dispute.status} />
            {dispute.priority && (
              <span className="px-2 py-0.5 bg-chalk dark:bg-dark-elevated border border-neutral-200 dark:border-dark-border rounded-full text-xs text-neutral-400">
                {dispute.priority} priority
              </span>
            )}
          </div>
        </div>
        {dispute.resolvedAt && (
          <div className="text-right">
            <p className="text-xs text-neutral-500">Resolved</p>
            <p className="text-xs text-neutral-300">{fmtDate(dispute.resolvedAt)}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — details + actions */}
        <div className="lg:col-span-1 space-y-5">

          {/* Case details */}
          <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-neutral-200 dark:border-dark-border rounded-card overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-200 dark:border-dark-border">
              <p className="text-xs font-semibold text-white">Case Details</p>
            </div>
            <DetailRow label="Initiator"   value={dispute.initiator  ? `${dispute.initiator.firstName} ${dispute.initiator.lastName}`   : null} />
            <DetailRow label="Respondent"  value={dispute.respondent ? `${dispute.respondent.firstName} ${dispute.respondent.lastName}` : null} />
            <DetailRow label="Contract"    value={dispute.contractId} />
            <DetailRow label="Vehicle"     value={dispute.vehicle ? `${dispute.vehicle.make} ${dispute.vehicle.model} (${dispute.vehicle.registrationNumber || dispute.vehicle.licensePlate || ''})` : null} />
            <DetailRow label="Assigned To" value={dispute.assignedTo ? `${dispute.assignedTo.firstName} ${dispute.assignedTo.lastName}` : 'Unassigned'} />
            <DetailRow label="Opened"      value={fmtDate(dispute.createdAt)} />
          </div>

          {/* Description */}
          {dispute.description && (
            <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-neutral-200 dark:border-dark-border rounded-card p-4">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-2">Description</p>
              <p className="text-xs text-neutral-300 leading-relaxed">{dispute.description}</p>
            </div>
          )}

          {/* Resolution */}
          {dispute.resolution && (
            <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-neutral-200 dark:border-dark-border rounded-card p-4">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-2">Resolution</p>
              <p className="text-xs text-neutral-300 leading-relaxed">{dispute.resolution}</p>
            </div>
          )}

          {/* Status update */}
          <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-neutral-200 dark:border-dark-border rounded-card p-4">
            <p className="text-xs font-semibold text-white mb-3">Update Status</p>
            <form onSubmit={updateStatus} className="space-y-3">
              <select
                className="input w-full"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
              >
                <option value="">Select new status…</option>
                {TRANSITION_STATUSES.filter((s) => s !== dispute.status).map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                ))}
              </select>
              {['RESOLVED', 'REJECTED', 'CLOSED'].includes(newStatus) && (
                <textarea
                  className="input w-full resize-none"
                  rows={3}
                  placeholder="Resolution note (required for closed/resolved)…"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                />
              )}
              {statusErr && <p className="text-xs text-red-400">{statusErr}</p>}
              <button
                type="submit"
                disabled={updating || !newStatus}
                className="w-full btn-solar py-2 text-xs disabled:opacity-50"
              >
                {updating ? 'Updating…' : 'Update Status'}
              </button>
            </form>
          </div>
        </div>

        {/* Right column — timeline + messaging */}
        <div className="lg:col-span-2 space-y-5">

          {/* Timeline */}
          <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-neutral-200 dark:border-dark-border rounded-card p-5">
            <p className="text-xs font-semibold text-white mb-5">Timeline</p>
            {timeline.length === 0 ? (
              <p className="text-xs text-neutral-500">No messages or evidence yet.</p>
            ) : (
              <div>
                {timeline.map((entry, i) => (
                  <TimelineEntry key={`${entry._type}-${entry.id || i}`} entry={entry} />
                ))}
              </div>
            )}
          </div>

          {/* Evidence list */}
          {evidence.length > 0 && (
            <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-neutral-200 dark:border-dark-border rounded-card overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-200 dark:border-dark-border">
                <p className="text-xs font-semibold text-white">Evidence ({evidence.length})</p>
              </div>
              <div className="divide-y divide-neutral-200 dark:divide-neutral-200 dark:divide-dark-border">
                {evidence.map((ev) => (
                  <div key={ev.id} className="px-4 py-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-neutral-900 dark:text-white font-medium">{ev.type || 'File'}</p>
                      {ev.description && <p className="text-xs text-neutral-500 mt-0.5">{ev.description}</p>}
                      <p className="text-xs text-neutral-600 mt-0.5">{fmtDate(ev.createdAt)}</p>
                    </div>
                    {ev.url && (
                      <a href={ev.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex-shrink-0">
                        View ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add message */}
          <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-neutral-200 dark:border-dark-border rounded-card p-4">
            <p className="text-xs font-semibold text-white mb-3">Add Case Note / Message</p>
            <form onSubmit={sendMessage} className="space-y-3">
              <textarea
                className="input w-full resize-none"
                rows={4}
                placeholder="Add a note, ruling, or communication to the case record…"
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
              />
              {msgErr && <p className="text-xs text-red-400">{msgErr}</p>}
              <button
                type="submit"
                disabled={sendingMsg || !msgText.trim()}
                className="btn-graphite py-2 px-5 text-xs disabled:opacity-50"
              >
                {sendingMsg ? 'Sending…' : 'Add Note'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
