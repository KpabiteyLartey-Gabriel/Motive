import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import { useAuth, fmtDate } from '../../lib/useAuth';
import { vehiclesApi, complianceApi } from '../../lib/api';
import VehiclePhotos from '../../components/VehiclePhotos';
import { PrimaryButton } from '../../components/ui';

const MODELS = [
  { value: 'WORK_AND_PAY', label: 'Work & Pay' },
  { value: 'DRIVING_ON', label: 'DriveOn' },
  { value: 'RENTAL', label: 'Rental' },
];

function InfoRow({ label, value, colors }) {
  return (
    <View style={[s.row, { borderBottomColor: colors.border }]}>
      <Text style={[s.label, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[s.value, { color: colors.textPrimary }]}>{value || '—'}</Text>
    </View>
  );
}

export default function DriverVehicle() {
  const { colors } = useTheme();
  const { user, loading } = useAuth();

  const [vehicle, setVehicle]       = useState(null);
  const [compliance, setCompliance] = useState([]);
  const [fetching, setFetching]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingReq, setPendingReq] = useState(null);
  const [busy, setBusy]             = useState(false);
  const [msg, setMsg]               = useState('');

  const load = useCallback(async () => {
    try {
      const res = await vehiclesApi.list({ limit: 1 });
      const vehicles = res.data?.data?.vehicles || [];
      const v = vehicles[0] || null;
      setVehicle(v);
      if (v) {
        const cRes = await complianceApi.listForVehicle(v.id);
        setCompliance(cRes.data?.data || []);
        try {
          const pRes = await vehiclesApi.getPendingModelChange(v.id);
          setPendingReq(pRes.data?.data || null);
        } catch { setPendingReq(null); }
      }
    } catch {}
    setFetching(false);
    setRefreshing(false);
  }, []);

  const decide = async (approve) => {
    if (!vehicle || !pendingReq) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await vehiclesApi.decideModelChange(vehicle.id, pendingReq.id, approve);
      const d = res.data?.data || {};
      if (d.vehicle) setVehicle((v) => ({ ...v, ...d.vehicle }));
      setPendingReq(null);
      setMsg(approve ? 'Approved — the contract type has been changed.' : 'Rejected — the contract type stays as it is.');
    } catch (e) {
      setMsg(e.response?.data?.message || 'Could not record your decision.');
    } finally {
      setBusy(false);
    }
  };

  const changeOwnModel = async (target) => {
    if (!vehicle || target === vehicle.operatingModel) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await vehiclesApi.changeOperatingModel(vehicle.id, target);
      const d = res.data?.data || {};
      if (d.vehicle) setVehicle((v) => ({ ...v, ...d.vehicle }));
      if (d.approvalRequired) setMsg('This needs the owner to propose it and you to approve.');
      else setMsg('Contract type updated.');
    } catch (e) {
      setMsg(e.response?.data?.message || 'Could not change the contract type.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { if (user) load(); }, [user, load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading || fetching) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.textPrimary} />
      </SafeAreaView>
    );
  }

  if (!vehicle) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={[s.empty, { borderColor: colors.border }]}>
          <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>No vehicle assigned</Text>
          <Text style={[s.emptyText, { color: colors.textMuted }]}>You don't have an assigned vehicle yet.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusColor = vehicle.status === 'ACTIVE' || vehicle.status === 'ASSIGNED'
    ? colors.success : colors.warning;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} />}
      >
        {/* Hero */}
        <View style={[s.hero, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[s.heroTitle, { color: colors.textPrimary }]}>
            {vehicle.make} {vehicle.model}
          </Text>
          <Text style={[s.heroPlate, { color: colors.textSecondary }]}>{vehicle.registrationNumber}</Text>
          <View style={[s.badge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
            <View style={[s.badgeDot, { backgroundColor: statusColor }]} />
            <Text style={[s.badgeText, { color: statusColor }]}>{vehicle.status}</Text>
          </View>
        </View>

        <VehiclePhotos vehicle={vehicle} colors={colors} />

        {/* Details */}
        <Text style={[s.section, { color: colors.textSecondary }]}>Vehicle Details</Text>
        <View style={[s.block, { borderColor: colors.border }]}>
          <InfoRow label="Year"        value={String(vehicle.year)} colors={colors} />
          <InfoRow label="Color"       value={vehicle.color} colors={colors} />
          <InfoRow label="Type"        value={vehicle.type} colors={colors} />
          <InfoRow label="Fuel"        value={vehicle.fuelType} colors={colors} />
          <InfoRow label="Transmission"value={vehicle.transmission} colors={colors} />
          <InfoRow label="VIN"         value={vehicle.vin} colors={colors} />
          <InfoRow label="Operating"   value={vehicle.operatingModel?.replace(/_/g, ' ')} colors={colors} />
        </View>

        {/* Contract type */}
        <Text style={[s.section, { color: colors.textSecondary }]}>Contract Type</Text>
        <View style={[s.block, { borderColor: colors.border, padding: 16 }]}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 }}>
            {(vehicle.operatingModel || 'Not set').replace(/_/g, ' ')}
          </Text>
          {pendingReq ? (
            <>
              <Text style={{ fontSize: 13, color: colors.warning, lineHeight: 19, marginBottom: 6 }}>
                The owner wants to change this vehicle from {(pendingReq.fromModel || '').replace(/_/g, ' ')} to {(pendingReq.toModel || '').replace(/_/g, ' ')}.
              </Text>
              <Text style={{ fontSize: 12.5, color: colors.textMuted, lineHeight: 18, marginBottom: 12 }}>
                This is a Work &amp; Pay vehicle, which becomes your own — so the change only happens if you approve it.
              </Text>
              <PrimaryButton title="Approve change" loading={busy} onPress={() => decide(true)} />
              <TouchableOpacity onPress={() => decide(false)} disabled={busy} style={{ alignItems: 'center', paddingVertical: 13 }}>
                <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 14 }}>Reject — keep Work &amp; Pay</Text>
              </TouchableOpacity>
            </>
          ) : vehicle.operatingModel === 'WORK_AND_PAY' ? (
            <Text style={{ fontSize: 12.5, color: colors.textMuted, lineHeight: 18 }}>
              This vehicle is on Work &amp; Pay and becomes yours. Only the owner can propose a change, and it will need your approval here first.
            </Text>
          ) : (
            <>
              <Text style={{ fontSize: 12.5, color: colors.textMuted, lineHeight: 18, marginBottom: 10 }}>
                DriveOn can be changed directly. Rental is published through a company, so switching to Rental goes through the owner and their chosen company.
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {MODELS.map((m) => {
                  const active = vehicle.operatingModel === m.value;
                  return (
                    <TouchableOpacity key={m.value} disabled={busy || active} onPress={() => changeOwnModel(m.value)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: active ? colors.brand : colors.border, backgroundColor: active ? colors.brandSoft : colors.card }}>
                      <Text style={{ fontSize: 12.5, fontWeight: '700', color: active ? colors.brandText : colors.textSecondary }}>{m.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {busy ? <Text style={{ fontSize: 12.5, color: colors.textMuted, marginTop: 8 }}>Saving…</Text> : null}
            </>
          )}
          {msg ? <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 8, lineHeight: 19 }}>{msg}</Text> : null}
        </View>

        {/* Compliance */}
        {compliance.length > 0 && (
          <>
            <Text style={[s.section, { color: colors.textSecondary }]}>Compliance & Documents</Text>
            <View style={[s.block, { borderColor: colors.border }]}>
              {compliance.map((c, i) => {
                const expColor = c.status === 'EXPIRED' ? colors.danger
                  : c.status === 'EXPIRING_SOON' ? colors.warning
                  : colors.success;
                return (
                  <View key={c.id} style={[s.row, { borderBottomColor: colors.border }, i === compliance.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.value, { color: colors.textPrimary }]}>{c.documentType?.replace(/_/g, ' ')}</Text>
                      {c.expiryDate && <Text style={[s.label, { color: colors.textMuted, marginTop: 2 }]}>Expires {fmtDate(c.expiryDate)}</Text>}
                    </View>
                    <Text style={[s.compStatus, { color: expColor }]}>{c.status?.replace(/_/g, ' ')}</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  hero:       { borderWidth: 1, borderRadius: 16, padding: 20, marginBottom: 20, gap: 6 },
  heroTitle:  { fontSize: 22, fontWeight: '700' },
  heroPlate:  { fontSize: 14, fontFamily: 'monospace' },
  badge:      { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
  badgeDot:   { width: 6, height: 6, borderRadius: 3 },
  badgeText:  { fontSize: 12, fontWeight: '600' },
  section:    { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  block:      { borderWidth: 1, borderRadius: 16, overflow: 'hidden', marginBottom: 20 },
  row:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1 },
  label:      { fontSize: 13 },
  value:      { fontSize: 13, fontWeight: '500', textAlign: 'right', flex: 1 },
  compStatus: { fontSize: 12, fontWeight: '600', marginLeft: 8 },
  empty:      { margin: 20, borderWidth: 1, borderRadius: 16, padding: 40, alignItems: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  emptyText:  { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
