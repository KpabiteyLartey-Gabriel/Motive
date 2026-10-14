'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { ADMIN_NAV } from '@/components/dashboard/AdminHelpers';
import { adminApi } from '@/lib/api';

const PROVIDER_INFO = {
  MTN_DIRECT_P2P: {
    label: 'MTN Direct P2P',
    description: 'Uses MTN MoMo Collections API to debit the driver\'s wallet and the Disbursements API to credit the owner\'s wallet. Supports MTN mobile wallets only.',
    networks: ['MTN'],
    recommended: true,
  },
  HUBTEL_DIRECTPAY: {
    label: 'Hubtel DirectPay',
    description: 'Hubtel DirectPay debit/credit. Supports MTN, Telecel and AirtelTigo wallets. Requires a unity.hubtel.com account to be configured.',
    networks: ['MTN', 'Telecel', 'AirtelTigo'],
    recommended: false,
  },
  MOCK: {
    label: 'Mock (Development Only)',
    description: 'Simulates payments in development. Cannot be activated in production.',
    networks: ['ALL'],
    recommended: false,
    devOnly: true,
  },
};

function NetworkBadge({ network }) {
  const colors = {
    MTN:       'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    Telecel:   'bg-red-500/10 text-red-400 border-red-500/20',
    AirtelTigo:'bg-sky-500/10 text-sky-400 border-sky-500/20',
    ALL:       'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border font-medium ${colors[network] || colors.ALL}`}>
      {network}
    </span>
  );
}

function ProviderCard({ name, info, isActive, isBlocked, onSwitch, switching }) {
  return (
    <div className={`bg-neutral-50 dark:bg-dark-card border rounded-card p-5 transition-all ${
      isActive
        ? 'border-accent shadow-[0_0_0_1px_rgba(59,130,246,0.3)]'
        : 'border-neutral-200 dark:border-dark-border hover:border-neutral-300 dark:hover:border-neutral-200 dark:border-dark-border/80'
    }`}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">{info.label}</h3>
            {isActive && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/20">
                ✓ Active
              </span>
            )}
            {info.recommended && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-chip text-xs font-medium bg-accent/10 text-accent border border-accent/20">
                Recommended
              </span>
            )}
            {info.devOnly && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-chip text-xs font-medium bg-warning/10 text-warning border border-warning/20">
                Dev Only
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">{info.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {info.networks.map((n) => (
          <NetworkBadge key={n} network={n} />
        ))}
      </div>

      <button
        disabled={isActive || isBlocked || switching}
        onClick={() => onSwitch(name)}
        className={`w-full py-2 rounded-lg border text-xs font-medium transition-colors ${
          isActive
            ? 'border-neutral-300 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500 cursor-default'
            : isBlocked
            ? 'border-neutral-200 dark:border-neutral-800 text-neutral-400 dark:text-neutral-600 cursor-not-allowed opacity-50'
            : 'border-accent/40 text-accent hover:bg-accent/10 disabled:opacity-40'
        }`}
      >
        {switching
          ? 'Switching…'
          : isActive
          ? 'Currently active'
          : isBlocked
          ? 'Not available in production'
          : `Switch to ${info.label}`}
      </button>
    </div>
  );
}

export default function AdminSettingsPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['ADMIN', 'SUPER_ADMIN'] });
  const [providerStatus, setProviderStatus] = useState(null);
  const [fetching, setFetching]             = useState(false);
  const [switching, setSwitching]           = useState(false);
  const [error, setError]                   = useState('');
  const [success, setSuccess]               = useState('');

  const loadStatus = () => {
    if (!user) return;
    setFetching(true);
    adminApi
      .getProviderStatus()
      .then((res) => setProviderStatus(res.data.data || res.data))
      .catch(() => setError('Failed to load payment provider status.'))
      .finally(() => setFetching(false));
  };

  useEffect(() => { loadStatus(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSwitch = async (providerName) => {
    setError('');
    setSuccess('');
    setSwitching(true);
    try {
      const res = await adminApi.switchProvider(providerName);
      setProviderStatus(res.data.data || res.data);
      setSuccess(`Payment provider switched to ${PROVIDER_INFO[providerName]?.label || providerName}.`);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to switch provider.');
    } finally {
      setSwitching(false);
    }
  };

  const activeProvider = providerStatus?.active;
  const available      = providerStatus?.available || [];

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={ADMIN_NAV} title="Settings">
      <div className="mb-8">
        <h2 className="font-medium text-graphite dark:text-paper mb-1" style={{ fontSize: "1.25rem", letterSpacing: "-0.02em" }}>Platform Settings</h2>
        <p className="text-sm text-steel dark:text-neutral-500">Manage platform configuration. Changes take effect immediately — no restart required.</p>
      </div>

      {/* Payment Provider Section */}
      <section className="mb-10">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-1">Payment Provider</h3>
          <p className="text-xs text-neutral-500">
            The active provider is used for all new payment requests. Existing pending payments continue through their original provider.
            Switching providers does not require a server restart.
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-danger/10 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 bg-success/10 border border-success/20 text-success text-sm px-4 py-3 rounded-lg">
            {success}
          </div>
        )}

        {fetching && !providerStatus && (
          <div className="py-10 text-center text-sm text-neutral-500">Loading provider status…</div>
        )}

        {providerStatus && (
          <>
            {/* Current active banner */}
            <div className="bg-chalk dark:bg-dark-elevated border border-neutral-200 dark:border-dark-border rounded-xl px-5 py-4 mb-5 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-success flex-shrink-0" />
              <div>
                <p className="text-xs text-neutral-500">Currently active payment provider</p>
                <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                  {PROVIDER_INFO[activeProvider]?.label || activeProvider}
                </p>
              </div>
            </div>

            {/* Provider cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {available.map((p) => {
                const info    = PROVIDER_INFO[p.name] || { label: p.name, description: p.description, networks: p.supportedNetworks || [] };
                const blocked = p.blocked === true;
                return (
                  <ProviderCard
                    key={p.name}
                    name={p.name}
                    info={info}
                    isActive={p.name === activeProvider}
                    isBlocked={blocked}
                    onSwitch={handleSwitch}
                    switching={switching}
                  />
                );
              })}
            </div>

            {/* Warning */}
            <div className="mt-5 bg-warning/5 border border-warning/20 rounded-xl px-5 py-4">
              <p className="text-xs font-semibold text-warning mb-1">⚠ Before switching providers</p>
              <ul className="text-xs text-neutral-400 space-y-1 list-disc list-inside">
                <li>Confirm the target provider credentials are configured in the environment.</li>
                <li>Pending payments in progress will continue through their original provider.</li>
                <li>Switching to Mock is blocked in production.</li>
                <li>Hubtel DirectPay requires a <span className="text-neutral-900 dark:text-white">unity.hubtel.com</span> account and credentials.</li>
              </ul>
            </div>
          </>
        )}
      </section>
    </DashboardShell>
  );
}
