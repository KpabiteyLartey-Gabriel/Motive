import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, palette } from '../../lib/theme';
import { useAuth, fmtGHS } from '../../lib/useAuth';
import { contractsApi } from '../../lib/api';
import { Card, Badge, Field, PrimaryButton } from '../../components/ui';
import OffDaysPicker from '../../components/OffDaysPicker';
import { emptyOffDays, formatOffDays, hasOffDays } from '../../lib/offDays';

const TYPE_LABEL = { WORK_AND_PAY: 'Work & Pay', DRIVING_ON: 'DriveOn', RENTAL: 'Rental' };

function summary(c) {
  const agreed = c.terms || {};
  const off = hasOffDays(agreed.offDays) ? ` Off days: ${agreed.offDaysLabel || formatOffDays(agreed.offDays)}.` : '';
  if (c.type === 'WORK_AND_PAY' && c.workAndPayTerms) {
    const w = c.workAndPayTerms;
    return `${fmtGHS(w.depositAmount)} deposit, then ${fmtGHS(w.installmentAmount)} every ${String(w.installmentFrequency || 'WEEKLY').toLowerCase()} x ${w.totalInstallments} — ${fmtGHS(w.totalPayable)} total. Grace ${w.gracePeriodDays ?? 0} days${off}.`;
  }
  if (c.type === 'DRIVING_ON' && c.drivingOnTerms) {
    const d = c.drivingOnTerms;
    const dur = agreed.duration?.value ? `${agreed.duration.value} ${String(agreed.duration.unit || '').toLowerCase()}` : 'open-ended';
    return `${fmtGHS(d.dailySalesAmount)} sales, paid ${String(d.paymentFrequency || 'DAILY').toLowerCase()} · Runs ${dur} · Grace ${agreed.gracePeriodDays ?? 0} days${off}. Driver sets renewal date when signing.`;
  }
  if (c.type === 'RENTAL' && c.rentalTerms) {
    const r = c.rentalTerms;
    return `${r.salaryAmount != null ? `${fmtGHS(r.salaryAmount)} ` : ''}paid ${String(r.paymentFrequency || 'WEEKLY').toLowerCase()} · Grace ${agreed.gracePeriodDays ?? 0} days${off}.`;
  }
  return c.description || 'No terms set.';
}

function stateOf(c) {
  if (c.status === 'ACTIVE') return { label: 'Active contract', tone: 'success' };
  const driverParty = (c.parties || []).find((p) => p.role === 'DRIVER');
  if (driverParty && !driverParty.signedAt) return { label: 'Awarded — waiting to sign', tone: 'warning' };
  if (driverParty?.signedAt) return { label: 'Signed', tone: 'success' };
  if (c.vehicleId) return { label: 'Attached to a vehicle', tone: 'warning' };
  return { label: 'Template — not attached', tone: 'neutral' };
}

// Owner Contracts: reusable templates (caption + financial terms).
// Attach one to a vehicle in My Vehicles, then award it to a driver.
export default function OwnerContracts() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [contracts, setContracts] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    type: 'WORK_AND_PAY', title: '', description: '', totalPayable: '', depositAmount: '', installmentAmount: '',
    dailySalesAmount: '', rentalAmount: '', durationValue: '', durationUnit: 'MONTHS', gracePeriodDays: '3', offDays: emptyOffDays(),
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    try {
      const res = await contractsApi.list({ limit: 100 }).catch(() => null);
      setContracts(res?.data?.data?.contracts || []);
    } catch {}
    setFetching(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  const create = async () => {
    if (!form.title.trim()) { Alert.alert('Caption needed', 'Give the contract a caption — that is the name shown in lists.'); return; }
    const payload = {
      type: form.type, title: form.title.trim(), description: form.description.trim() || undefined,
      terms: {
        offDays: hasOffDays(form.offDays) ? form.offDays : undefined, offDaysLabel: hasOffDays(form.offDays) ? formatOffDays(form.offDays) : undefined,
        gracePeriodDays: Number(form.gracePeriodDays) || 0,
        ...(form.type !== 'WORK_AND_PAY' && form.durationValue ? { duration: { value: Number(form.durationValue), unit: form.durationUnit } } : {}),
      },
    };
    if (form.type === 'WORK_AND_PAY') {
      const total = Number(form.totalPayable), dep = Number(form.depositAmount), inst = Number(form.installmentAmount);
      if (!(total > 0 && inst > 0)) { Alert.alert('Terms needed', 'Enter the total the driver pays and the installment amount.'); return; }
      payload.workAndPayTerms = {
        depositAmount: dep || 0, totalPayable: total, installmentAmount: inst, installmentFrequency: 'WEEKLY',
        totalInstallments: Math.max(1, Math.ceil((total - (dep || 0)) / inst)), gracePeriodDays: Number(form.gracePeriodDays) || 0,
      };
    } else if (form.type === 'DRIVING_ON') {
      if (!(Number(form.dailySalesAmount) > 0)) { Alert.alert('Terms needed', 'Enter the daily sales amount.'); return; }
      payload.drivingOnTerms = { dailySalesAmount: Number(form.dailySalesAmount), paymentFrequency: 'DAILY', driverPaysFuel: true, driverPaysMaintenance: false, driverPaysInsurance: false };
    } else {
      if (!(Number(form.rentalAmount) > 0)) { Alert.alert('Terms needed', 'Enter the rental amount.'); return; }
      payload.rentalTerms = { salaryAmount: Number(form.rentalAmount), paymentFrequency: 'WEEKLY', driverPaysFuel: true, driverPaysMaintenance: false, driverPaysInsurance: false };
    }
    setBusy(true);
    try {
      await contractsApi.create(payload);
      setShowForm(false);
      Alert.alert('Contract created', 'Attach it to a vehicle in My Vehicles, then award it to a driver.');
      load();
    } catch (e) {
      Alert.alert('Could not create', e.response?.data?.message || 'Please try again.');
    }
    setBusy(false);
  };

  if (fetching) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }} edges={['bottom']}><ActivityIndicator color={palette.brand} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        <Text style={[s.intro, { color: colors.textMuted }]}>
          Create contracts with your financial terms. Attach one to a vehicle, then award it — the terms transfer to the driver when they sign.
        </Text>
        <PrimaryButton title={showForm ? 'Close form' : '+ New contract'} onPress={() => setShowForm((v) => !v)} />

        {showForm && (
          <Card style={{ padding: 16, marginTop: 16 }}>
            <View style={s.typeRow}>
              {Object.keys(TYPE_LABEL).map((t) => (
                <TouchableOpacity key={t} onPress={() => set('type', t)} style={[s.typeChip, { borderColor: form.type === t ? palette.brand : colors.border, backgroundColor: form.type === t ? palette.brand : 'transparent' }]} accessibilityRole="button" accessibilityState={{ selected: form.type === t }}>
                  <Text style={{ color: form.type === t ? '#fff' : colors.textSecondary, fontWeight: '700', fontSize: 12.5 }}>{TYPE_LABEL[t]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Field label="Caption — what this contract is called" placeholder="e.g. Hiace Work & Pay — Accra route" value={form.title} onChangeText={(v) => set('title', v)} />
            <Field label="Description (optional)" placeholder="Anything the driver should know" value={form.description} onChangeText={(v) => set('description', v)} />
            {form.type === 'WORK_AND_PAY' && (
              <>
                <Field label="Total the driver pays (GHS)" placeholder="60000" keyboardType="numeric" value={form.totalPayable} onChangeText={(v) => set('totalPayable', v)} />
                <Field label="Deposit upfront (GHS)" placeholder="5000" keyboardType="numeric" value={form.depositAmount} onChangeText={(v) => set('depositAmount', v)} />
                <Field label="Each weekly installment (GHS)" placeholder="1200" keyboardType="numeric" value={form.installmentAmount} onChangeText={(v) => set('installmentAmount', v)} />
              </>
            )}
            {form.type === 'DRIVING_ON' && (
              <Field label="Daily sales the driver brings (GHS)" placeholder="350" keyboardType="numeric" value={form.dailySalesAmount} onChangeText={(v) => set('dailySalesAmount', v)} />
            )}
            {form.type === 'RENTAL' && (
              <Field label="Rental amount, paid weekly (GHS)" placeholder="1500" keyboardType="numeric" value={form.rentalAmount} onChangeText={(v) => set('rentalAmount', v)} />
            )}
            {form.type !== 'WORK_AND_PAY' && (
              <>
                <Field label="How long it runs (number)" placeholder="6" keyboardType="numeric" value={form.durationValue} onChangeText={(v) => set('durationValue', v)} />
                <Field label="Period (DAYS, WEEKS, MONTHS or YEARS)" placeholder="MONTHS" autoCapitalize="characters" value={form.durationUnit} onChangeText={(v) => set('durationUnit', v.toUpperCase())} />
              </>
            )}
            <Field label="Grace period (days)" placeholder="3" keyboardType="numeric" value={form.gracePeriodDays} onChangeText={(v) => set('gracePeriodDays', v)} />
            <OffDaysPicker value={form.offDays} onChange={(v) => set('offDays', v)} />
            <PrimaryButton title="Create contract" onPress={create} loading={busy} />
          </Card>
        )}

        <Text style={[s.section, { color: colors.textSecondary }]}>Created contracts</Text>
        {contracts.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: 13.5, lineHeight: 20 }}>No contracts yet. Create your first one above.</Text>
        ) : contracts.map((c) => {
          const st = stateOf(c);
          return (
            <Card key={c.id} style={{ padding: 16, marginBottom: 12 }}>
              <View style={s.rowBetween}>
                <Text style={[s.title, { color: colors.textPrimary }]}>{c.title || 'Untitled contract'}</Text>
                <Badge label={st.label} tone={st.tone} />
              </View>
              <Text style={[s.meta, { color: colors.textMuted }]}>{c.contractNumber} · {TYPE_LABEL[c.type] || c.type}</Text>
              <Text style={[s.body, { color: colors.textSecondary }]}>{summary(c)}</Text>
              {c.vehicle ? <Text style={[s.meta, { color: colors.textMuted }]}>Vehicle: {c.vehicle.make} {c.vehicle.model} ({c.vehicle.registrationNumber})</Text> : null}
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  intro: { fontSize: 12.5, lineHeight: 18, marginBottom: 12 },
  section: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 20, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  title: { fontSize: 15, fontWeight: '700', flex: 1 },
  meta: { fontSize: 12, marginTop: 4 },
  body: { fontSize: 13.5, lineHeight: 20, marginTop: 8 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  typeChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
});
