import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, palette } from '../../lib/theme';
import { useAuth, fmtDate } from '../../lib/useAuth';
import { disputesApi } from '../../lib/api';

const STATUS_COLOR = { OPEN: 'warning', UNDER_REVIEW: 'warning', RESOLVED: 'success', CLOSED: 'success', ESCALATED: 'danger', MEDIATION: 'warning' };

export default function DriverDisputes() {
  const { colors } = useTheme();
  const { user, loading } = useAuth();
  const [disputes, setDisputes]   = useState([]);
  const [fetching, setFetching]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm]           = useState({ type: 'PAYMENT_DISPUTE', subject: '', description: '' });

  const load = useCallback(async () => {
    try {
      const res = await disputesApi.list({ limit: 30 });
      setDisputes(res.data?.data?.disputes || []);
    } catch {}
    setFetching(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const submit = async () => {
    if (!form.subject.trim() || !form.description.trim()) {
      Alert.alert('Error', 'Subject and description are required.');
      return;
    }
    setSubmitting(true);
    try {
      await disputesApi.create(form);
      Alert.alert('Filed', 'Your dispute has been submitted for review.');
      setShowForm(false);
      setForm({ type: 'PAYMENT_DISPUTE', subject: '', description: '' });
      load();
    } catch (e) {
      Alert.alert('Failed', e.response?.data?.message || 'Could not file dispute.');
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

  const TYPES = ['PAYMENT_DISPUTE', 'CONTRACT_DISPUTE', 'VEHICLE_DAMAGE', 'MAINTENANCE', 'OTHER'];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} />}
      >
        {!showForm ? (
          <TouchableOpacity style={[s.btn, { backgroundColor: palette.solarYellow }]} onPress={() => setShowForm(true)} activeOpacity={0.85}>
            <Text style={[s.btnText, { color: '#FFFFFF' }]}>File a Dispute</Text>
          </TouchableOpacity>
        ) : (
          <View style={[s.card, { borderColor: colors.border }]}>
            <Text style={[s.cardTitle, { color: colors.textPrimary }]}>New Dispute</Text>

            <Text style={[s.lbl, { color: colors.textSecondary }]}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={[s.chips, { marginBottom: 0 }]}>
                {TYPES.map((t) => (
                  <TouchableOpacity key={t} style={[s.chip, { borderColor: form.type === t ? colors.textPrimary : colors.border, backgroundColor: form.type === t ? colors.elevated : 'transparent' }]} onPress={() => setForm((p) => ({ ...p, type: t }))}>
                    <Text style={[s.chipText, { color: form.type === t ? colors.textPrimary : colors.textMuted }]}>{t.replace(/_/g, ' ')}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={[s.lbl, { color: colors.textSecondary }]}>Subject</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              placeholder="Brief subject line"
              placeholderTextColor={colors.textMuted}
              value={form.subject}
              onChangeText={(v) => setForm((p) => ({ ...p, subject: v }))}
            />

            <Text style={[s.lbl, { color: colors.textSecondary }]}>Description</Text>
            <TextInput
              style={[s.textarea, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              placeholder="Describe the issue in detail…"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={5}
              value={form.description}
              onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: palette.solarYellow, marginBottom: 0 }]} onPress={submit} disabled={submitting} activeOpacity={0.85}>
                {submitting ? <ActivityIndicator color={colors.ctaText} /> : <Text style={[s.btnText, { color: '#FFFFFF' }]}>Submit</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[s.cancelBtn, { flex: 1, borderColor: colors.border }]} onPress={() => setShowForm(false)} activeOpacity={0.7}>
                <Text style={[s.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Text style={[s.section, { color: colors.textSecondary }]}>My Cases</Text>
        {disputes.length === 0 ? (
          <View style={[s.empty, { borderColor: colors.border }]}>
            <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>No disputes</Text>
            <Text style={[s.emptyText, { color: colors.textMuted }]}>File a dispute if you have an unresolved issue.</Text>
          </View>
        ) : (
          <View style={[s.list, { borderColor: colors.border }]}>
            {disputes.map((d, i) => {
              const dotColor = colors[STATUS_COLOR[d.status]] || colors.textMuted;
              return (
                <View key={d.id} style={[s.listRow, { borderBottomColor: colors.border }, i === disputes.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.listTitle, { color: colors.textPrimary }]}>{d.subject}</Text>
                    <Text style={[s.listType, { color: colors.textMuted }]}>{d.type?.replace(/_/g, ' ')}</Text>
                    <Text style={[s.listDate, { color: colors.textMuted }]}>{fmtDate(d.createdAt)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={[s.dot, { backgroundColor: dotColor }]} />
                    <Text style={[s.listStatus, { color: colors.textSecondary }]}>{d.status}</Text>
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
  chips:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip:       { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  chipText:   { fontSize: 12, fontWeight: '500' },
  input:      { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 },
  textarea:   { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, minHeight: 110, textAlignVertical: 'top' },
  section:    { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 },
  list:       { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  listRow:    { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 8, alignItems: 'center' },
  listTitle:  { fontSize: 13, fontWeight: '600' },
  listType:   { fontSize: 12, marginTop: 2 },
  listDate:   { fontSize: 11, marginTop: 2 },
  dot:        { width: 6, height: 6, borderRadius: 3 },
  listStatus: { fontSize: 12 },
  empty:      { borderWidth: 1, borderRadius: 16, padding: 32, alignItems: 'center' },
  emptyTitle: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  emptyText:  { fontSize: 13, textAlign: 'center' },
});
