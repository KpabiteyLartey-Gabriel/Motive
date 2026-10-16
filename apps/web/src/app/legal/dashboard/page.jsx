'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/useAuth';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { StatCard, EmptyState, StatusBadge } from '@/components/dashboard/DashboardUI';
import { disputesApi, contractsApi, complianceApi, vehiclesApi } from '@/lib/api';

import { LEGAL_NAV, LEGAL_ROLES } from '@/lib/legalNav';

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function LegalDashboardPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: LEGAL_ROLES });
  const [disputes, setDisputes] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [fetching, setFetching] = useState(true);

  const load = useCallback(() => {
    if (!user) return;
    Promise.all([
      disputesApi.list({ limit: 100 }).catch(() => null),
      contractsApi.list({ limit: 100 }).catch(() => null),
      complianceApi.list({ limit: 100 }).catch(() => null),
      vehiclesApi.list({ limit: 100 }).catch(() => null),
    ]).then(([d, c, docs, v]) => {
      setDisputes(d?.data?.data?.disputes || []);
      setContracts(c?.data?.data?.contracts || []);
      setDocuments(docs?.data?.data?.records || []);
      setVehicles(v?.data?.data?.vehicles || []);
    }).finally(() => setFetching(false));
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const open       = disputes.filter((d) => ['OPEN', 'AWAITING_RESPONSE', 'UNDER_REVIEW'].includes(d.status));
  const mediation  = disputes.filter((d) => d.status === 'MEDIATION');
  const escalated  = disputes.filter((d) => d.status === 'ESCALATED');
  const resolved   = disputes.filter((d) => ['RESOLVED', 'CLOSED'].includes(d.status));
  const unassigned = disputes.filter((d) => !d.assignedTo);
  const recent     = disputes.slice(0, 8);

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={LEGAL_NAV} title="Legal Dashboard">
      <div className="mb-8">
        <h2 className="text-xl font-medium text-graphite dark:text-paper mb-1" style={{ letterSpacing: "-0.02em" }}>Legal &amp; Dispute Overview</h2>
        <p className="text-sm text-steel dark:text-neutral-500">Active cases and resolution status across the platform</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard label="Open Cases"      value={open.length}      sub="Pending resolution" />
        <StatCard label="In Mediation"    value={mediation.length} sub="Active mediation" />
        <StatCard label="Escalated"       value={escalated.length} sub="Requires attention" accent />
        <StatCard label="Resolved"        value={resolved.length}  sub="Closed successfully" />
      </div>

      {/* Contracts & paperwork oversight */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard label="Vehicles Monitored" value={vehicles.length} sub="All registered vehicles" />
        <StatCard label="Active Contracts" value={contracts.filter((c) => c.status === 'ACTIVE').length} sub="Across all vehicles" />
        <StatCard label="Pending Signatures" value={contracts.filter((c) => ['DRAFT', 'PENDING_SIGNATURES'].includes(c.status)).length} sub="Awaiting parties" />
        <StatCard label="Documents Needing Attention" value={documents.filter((d) => ['EXPIRED', 'EXPIRING_SOON', 'PENDING_RENEWAL'].includes(d.status)).length} sub="Expired / expiring paperwork" accent />
      </div>
      <div className="flex flex-wrap gap-2 mb-8">
        <a href="/legal/contracts" className="text-xs font-medium px-3 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">Manage contracts</a>
        <a href="/legal/vehicles" className="text-xs font-medium px-3 py-2 rounded-lg border border-neutral-300 dark:border-dark-border">Contracts & paperwork per vehicle</a>
        <a href="/legal/documents" className="text-xs font-medium px-3 py-2 rounded-lg border border-neutral-300 dark:border-dark-border">All vehicle paperwork</a>
      </div>

      {unassigned.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-5 py-4 mb-6 flex items-center gap-3">
          <span className="text-yellow-400 text-sm font-semibold">{unassigned.length} unassigned</span>
          <span className="text-yellow-500/70 text-xs">case{unassigned.length !== 1 ? 's' : ''} without a case officer — assign them from the Cases list.</span>
          <a href="/legal/cases" className="ml-auto text-xs text-yellow-400 underline hover:text-yellow-300">View cases</a>
        </div>
      )}

      {/* Recent cases */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Recent Cases</h3>
        <a href="/legal/cases" className="text-xs text-neutral-500 hover:text-white transition-colors">View all →</a>
      </div>

      {fetching ? (
        <div className="text-neutral-500 text-sm py-6 text-center">Loading cases…</div>
      ) : recent.length === 0 ? (
        <EmptyState icon="⚖️" title="No dispute cases" description="Cases will appear here as users raise disputes." />
      ) : (
        <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-neutral-200 dark:border-dark-border rounded-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-dark-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 hidden sm:table-cell">Initiator</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 hidden md:table-cell">Assigned</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 hidden lg:table-cell">Opened</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-200 dark:divide-dark-border">
              {recent.map((d) => (
                <tr key={d.id} className="hover:bg-chalk dark:hover:bg-dark-elevated transition-colors">
                  <td className="px-4 py-3 text-xs text-neutral-300">{d.type?.replace(/_/g, ' ') || '—'}</td>
                  <td className="px-4 py-3 text-xs text-white hidden sm:table-cell">
                    {d.initiator ? `${d.initiator.firstName} ${d.initiator.lastName}` : '—'}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                  <td className="px-4 py-3 text-xs text-neutral-400 hidden md:table-cell">
                    {d.assignedTo ? `${d.assignedTo.firstName} ${d.assignedTo.lastName}` : <span className="text-yellow-500">Unassigned</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-500 hidden lg:table-cell">{fmt(d.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <a href={`/legal/case/${d.id}`} className="text-xs text-neutral-500 hover:text-white transition-colors">
                      View →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardShell>
  );
}
