import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, palette } from '../../lib/theme';
import { useAuth, fmtDate } from '../../lib/useAuth';
import { maintenanceApi, vehiclesApi } from '../../lib/api';
import RenewalsPanel from '../../components/RenewalsPanel';
import ServicesCatalog from '../../components/ServicesCatalog';

const STATUS_COLOR = { REQUESTED: 'warning', APPROVED: 'success', IN_PROGRESS: 'warning', COMPLETED: 'success', CANCELLED: 'danger', SCHEDULED: 'warning' };

export default function DriverMaintenance() {
  const { colors } = useTheme();
  const { user, loading } = useAuth();
  const [requests, setRequests] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [vehicleId, setVehicleId] = useState('');
  const [form, setForm] = useState({ type: 'ROUTINE', description: '', urgency: 'NORMAL' });

  const load = useCallback(async () => {
    try {
      const [rRes, vRes] = await Promise.allSettled([
        maintenanceApi.list({ limit: 30 }),
        vehiclesApi.list({ limit: 1 }),
      ]);
      if (rRes.status === 'fulfilled') setRequests(rRes.value.data?.data?.requests || []);
      if (vRes.status === 'fulfilled') {
        const v = vRes.value.data?.data?.vehicles?.[0];
        if (v) setVehicleId(v.id);
      }
    } catch {}
    setFetching(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const submit = async () => {
    if (!vehicleId) { Alert.alert('Error', 'No vehicle found. Cannot submit request.'); return; }
    if (!form.description.trim()) { Alert.alert('Error', 'Please describe the issue.'); return; }
    setSubmitting(true);
    try {
      await maintenanceApi.create({ vehicleId, ...form });
      Alert.alert('Submitted', 'Your maintenance request has been submitted.');
      setShowForm(false);
      setForm({ type: 'ROUTINE', description: '', urgency: 'NORMAL' });
      load();
    } catch (e) {
      Alert.alert('Failed', e.response?.data?.message || 'Could not submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || fetching) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.textPrimary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} />}
      >
        <RenewalsPanel />
        <ServicesCatalog />
        {!showForm ? (
          <TouchableOpacity style={[s.btn, { backgroundColor: palette.solarYellow }]} onPress={() => setShowForm(true)} activeOpacity={0.85}>
            <Text style={[s.btnText, { color: '#FFFFFF' }]}>Report Issue / Request Service</Text>
          </TouchableOpacity>
        ) : (
          <View style={[s.card, { borderColor: colors.border }]}>
            <Text style={[s.cardTitle, { color: colors.textPrimary }]}>Maintenance Request</Text>

            <Text style={[s.lbl, { color: colors.textSecondary }]}>Type</Text>
            <View style={s.chips}>
              {['ROUTINE', 'BREAKDOWN', 'ACCIDENT', 'INSPECTION'].map((t) => (
                <TouchableOpacity key={t} style={[s.chip, { borderColor: form.type === t ? colors.textPrimary : colors.border, backgroundColor: form.type === t ? colors.elevated : 'transparent' }]} onPress={() => setForm((p) => ({ ...p, type: t }))}>
                  <Text style={[s.chipText, { color: form.type === t ? colors.textPrimary : colors.textMuted }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[s.lbl, { color: colors.textSecondary }]}>Urgency</Text>
            <View style={s.chips}>
              {['LOW', 'NORMAL', 'HIGH', 'CRITICAL'].map((u) => (
                <TouchableOpacity key={u} style={[s.chip, { borderColor: form.urgency === u ? colors.textPrimary : colors.border, backgroundColor: form.urgency === u ? colors.elevated : 'transparent' }]} onPress={() => setForm((p) => ({ ...p, urgency: u }))}>
                  <Text style={[s.chipText, { color: form.urgency === u ? colors.textPrimary : colors.textMuted }]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[s.lbl, { color: colors.textSecondary }]}>Description</Text>
            <TextInput
              style={[s.textarea, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              placeholder="Describe the issue or service neededâ€¦"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              value={form.description}
              onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: palette.solarYellow }]} onPress={submit} disabled={submitting} activeOpacity={0.85}>
                {submitting ? <ActivityIndicator color={colors.ctaText} /> : <Text style={[s.btnText, { color: '#FFFFFF' }]}>Submit</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[s.cancelBtn, { flex: 1, borderColor: colors.border }]} onPress={() => setShowForm(false)} activeOpacity={0.7}>
                <Text style={[s.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Text style={[s.section, { color: colors.textSecondary }]}>My Requests</Text>
        {requests.length === 0 ? (
          <View style={[s.empty, { borderColor: colors.border }]}>
            <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>No requests yet</Text>
          </View>
        ) : (
          <View style={[s.list, { borderColor: colors.border }]}>
            {requests.map((r, i) => {
              const dotColor = colors[STATUS_COLOR[r.status]] || colors.textMuted;
              return (
                <View key={r.id} style={[s.listRow, { borderBottomColor: colors.border }, i === requests.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.listTitle, { color: colors.textPrimary }]}>{r.type} â€” {r.urgency}</Text>
                    <Text style={[s.listDesc, { color: colors.textMuted }]} numberOfLines={1}>{r.description}</Text>
                    <Text style={[s.listDate, { color: colors.textMuted }]}>{fmtDate(r.createdAt)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 3 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <View style={[s.dot, { backgroundColor: dotColor }]} />
                      <Text style={[s.listStatus, { color: colors.textSecondary }]}>{r.status}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  btn:        { borderRadius: 40, paddingVertical: 16, alignItems: 'center', marginBottom: 20 },
  btnText:    { fontWeight: '700', fontSize: 15 },
  cancelBtn:  { borderWidth: 1, borderRadius: 40, paddingVertical: 16, alignItems: 'center' },
  cancelText: { fontWeight: '600', fontSize: 15 },
  card:       { borderWidth: 1, borderRadius: 16, padding: 18, marginBottom: 20, gap: 4 },
  cardTitle:  { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  lbl:        { fontSize: 13, fontWeight: '500', marginBottom: 6, marginTop: 8 },
  chips:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip:       { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  chipText:   { fontSize: 12, fontWeight: '500' },
  textarea:   { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, minHeight: 90, textAlignVertical: 'top' },
  section:    { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 },
  list:       { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  listRow:    { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 8 },
  listTitle:  { fontSize: 13, fontWeight: '600' },
  listDesc:   { fontSize: 12, marginTop: 2 },
  listDate:   { fontSize: 11, marginTop: 2 },
  dot:        { width: 6, height: 6, borderRadius: 3 },
  listStatus: { fontSize: 12 },
  empty:      { borderWidth: 1, borderRadius: 16, padding: 32, alignItems: 'center' },
  emptyTitle: { fontSize: 14, fontWeight: '600' },
});
