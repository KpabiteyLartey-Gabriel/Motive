import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, palette } from '../../lib/theme';
import { useAuth, fmtDate } from '../../lib/useAuth';
import { incidentsApi, vehiclesApi } from '../../lib/api';

const STATUS_COLOR = {
  REPORTED: 'warning',
  UNDER_INVESTIGATION: 'warning',
  RESOLVED: 'success',
  CLOSED: 'success',
  PENDING_REVIEW: 'warning',
  ESCALATED: 'danger',
};

const INCIDENT_TYPES = [
  'ACCIDENT',
  'THEFT',
  'VANDALISM',
  'BREAKDOWN',
  'TRAFFIC_VIOLATION',
  'ROAD_INCIDENT',
  'OTHER',
];

const SEVERITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export default function DriverIncidents() {
  const { colors } = useTheme();
  const { user, loading } = useAuth();
  const [incidents, setIncidents] = useState([]);
  const [fetching, setFetching]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [vehicleId, setVehicleId] = useState('');
  const [form, setForm] = useState({
    type: 'ACCIDENT',
    severity: 'MEDIUM',
    description: '',
    location: '',
  });

  const load = useCallback(async () => {
    try {
      const [iRes, vRes] = await Promise.allSettled([
        incidentsApi.list({ limit: 30 }),
        vehiclesApi.list({ limit: 1 }),
      ]);
      if (iRes.status === 'fulfilled') setIncidents(iRes.value.data?.data?.incidents || []);
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
    if (!form.description.trim()) {
      Alert.alert('Error', 'Please describe what happened.');
      return;
    }
    setSubmitting(true);
    try {
      await incidentsApi.create({ vehicleId: vehicleId || undefined, ...form });
      Alert.alert('Reported', 'Your incident report has been submitted.');
      setShowForm(false);
      setForm({ type: 'ACCIDENT', severity: 'MEDIUM', description: '', location: '' });
      load();
    } catch (e) {
      Alert.alert('Failed', e.response?.data?.message || 'Could not submit incident report.');
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
        {!showForm ? (
          <TouchableOpacity
            style={[s.btn, { backgroundColor: palette.solarYellow }]}
            onPress={() => setShowForm(true)}
            activeOpacity={0.85}
          >
            <Text style={[s.btnText, { color: '#FFFFFF' }]}>Report an Incident</Text>
          </TouchableOpacity>
        ) : (
          <View style={[s.card, { borderColor: colors.border }]}>
            <Text style={[s.cardTitle, { color: colors.textPrimary }]}>Incident Report</Text>

            <Text style={[s.lbl, { color: colors.textSecondary }]}>Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={s.chipRow}>
                {INCIDENT_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[s.chip, {
                      borderColor: form.type === t ? colors.textPrimary : colors.border,
                      backgroundColor: form.type === t ? colors.elevated : 'transparent',
                    }]}
                    onPress={() => setForm((p) => ({ ...p, type: t }))}
                  >
                    <Text style={[s.chipText, { color: form.type === t ? colors.textPrimary : colors.textMuted }]}>
                      {t.replace(/_/g, ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={[s.lbl, { color: colors.textSecondary }]}>Severity</Text>
            <View style={s.chipRow}>
              {SEVERITY_LEVELS.map((sv) => (
                <TouchableOpacity
                  key={sv}
                  style={[s.chip, {
                    borderColor: form.severity === sv ? colors.textPrimary : colors.border,
                    backgroundColor: form.severity === sv ? colors.elevated : 'transparent',
                  }]}
                  onPress={() => setForm((p) => ({ ...p, severity: sv }))}
                >
                  <Text style={[s.chipText, { color: form.severity === sv ? colors.textPrimary : colors.textMuted }]}>
                    {sv}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[s.lbl, { color: colors.textSecondary }]}>Location (optional)</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              placeholder="e.g. Accra Ring Road, near Danquah Circle"
              placeholderTextColor={colors.textMuted}
              value={form.location}
              onChangeText={(v) => setForm((p) => ({ ...p, location: v }))}
            />

            <Text style={[s.lbl, { color: colors.textSecondary }]}>Description</Text>
            <TextInput
              style={[s.textarea, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              placeholder="Describe what happened in detail…"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={5}
              value={form.description}
              onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity
                style={[s.btn, { flex: 1, backgroundColor: palette.solarYellow, marginBottom: 0 }]}
                onPress={submit}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? <ActivityIndicator color={colors.ctaText} /> : <Text style={[s.btnText, { color: '#FFFFFF' }]}>Submit</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.cancelBtn, { flex: 1, borderColor: colors.border }]}
                onPress={() => setShowForm(false)}
                activeOpacity={0.7}
              >
                <Text style={[s.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Text style={[s.section, { color: colors.textSecondary }]}>My Incidents</Text>
        {incidents.length === 0 ? (
          <View style={[s.empty, { borderColor: colors.border }]}>
            <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>No incidents reported</Text>
            <Text style={[s.emptyText, { color: colors.textMuted }]}>Use this screen to report accidents, theft, or road incidents involving your vehicle.</Text>
          </View>
        ) : (
          <View style={[s.list, { borderColor: colors.border }]}>
            {incidents.map((inc, i) => {
              const dotColor = colors[STATUS_COLOR[inc.status]] || colors.textMuted;
              return (
                <View key={inc.id} style={[s.listRow, { borderBottomColor: colors.border }, i === incidents.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.listTitle, { color: colors.textPrimary }]}>{inc.type?.replace(/_/g, ' ')} — {inc.severity}</Text>
                    {inc.location ? <Text style={[s.listSub, { color: colors.textMuted }]} numberOfLines={1}>{inc.location}</Text> : null}
                    <Text style={[s.listDesc, { color: colors.textMuted }]} numberOfLines={1}>{inc.description}</Text>
                    <Text style={[s.listDate, { color: colors.textMuted }]}>{fmtDate(inc.createdAt)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={[s.dot, { backgroundColor: dotColor }]} />
                    <Text style={[s.listStatus, { color: colors.textSecondary }]}>{inc.status?.replace(/_/g, ' ')}</Text>
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
  chipRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip:       { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  chipText:   { fontSize: 12, fontWeight: '500' },
  input:      { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 },
  textarea:   { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, minHeight: 110, textAlignVertical: 'top' },
  section:    { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 },
  list:       { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  listRow:    { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 8, alignItems: 'center' },
  listTitle:  { fontSize: 13, fontWeight: '600' },
  listSub:    { fontSize: 12, marginTop: 2 },
  listDesc:   { fontSize: 12, marginTop: 1 },
  listDate:   { fontSize: 11, marginTop: 2 },
  dot:        { width: 6, height: 6, borderRadius: 3 },
  listStatus: { fontSize: 11 },
  empty:      { borderWidth: 1, borderRadius: 16, padding: 32, alignItems: 'center' },
  emptyTitle: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  emptyText:  { fontSize: 13, textAlign: 'center' },
});
