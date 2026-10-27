import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useTheme, palette } from '../../lib/theme';
import { useAuth, fmtGHS } from '../../lib/useAuth';
import { marketplaceApi, resolveVehiclePhoto } from '../../lib/api';

const MODEL_LABEL = { WORK_AND_PAY: 'Work & Pay', DRIVING_ON: 'DriveOn', RENTAL: 'Rental' };
const MODEL_FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'RENTAL', label: 'Rental' },
  { key: 'WORK_AND_PAY', label: 'Work & Pay' },
  { key: 'DRIVING_ON', label: 'DriveOn' },
];

// The User Dashboard IS Explore: one grid of the vehicles companies
// publish for Rental, Work & Pay and DriveOn. Individual owners never
// list here — their deals are private.
export default function UserDashboard() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [vehicles, setVehicles] = useState([]);
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [noteFor, setNoteFor] = useState(null);
  const [note, setNote] = useState('');
  const [model, setModel] = useState('ALL');
  const canShowInterest = user?.primaryRole === 'DRIVER';

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([marketplaceApi.explore().catch(() => null), marketplaceApi.myInterests().catch(() => null)]);
      setVehicles(a?.data?.data || []);
      setMine(b?.data?.data || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  const interestByVehicle = {};
  mine.forEach((i) => { interestByVehicle[i.vehicleId] = i; });

  const shown = model === 'ALL' ? vehicles : vehicles.filter((v) => v.operatingModel === model);
  const countFor = (key) => (key === 'ALL' ? vehicles.length : vehicles.filter((v) => v.operatingModel === key).length);

  const express = async () => {
    if (!noteFor) return;
    setBusyId(noteFor.id);
    try {
      await marketplaceApi.expressInterest(noteFor.id, note.trim() || undefined);
      setNoteFor(null);
      setNote('');
      Alert.alert('Interest sent', 'The company has your chat. Check Chat to talk to them.');
      load();
    } catch (e) {
      Alert.alert('Could not send interest', e.response?.data?.message || 'Please try again.');
    }
    setBusyId(null);
  };

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color={palette.brand} /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={shown}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        ListHeaderComponent={(
          <View>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 12 }}>
              {canShowInterest
                ? 'Vehicles companies have published for Rental, Work & Pay and DriveOn.'
                : 'Browse vehicles here. Showing interest and chatting with a company is available once your account is set up as a Driver.'}
            </Text>
            <View style={s.chips}>
              {MODEL_FILTERS.map((f) => (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => setModel(f.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: model === f.key }}
                  style={[s.chip, { borderColor: model === f.key ? palette.brand : colors.border, backgroundColor: model === f.key ? palette.brand : 'transparent' }]}
                >
                  <Text style={[s.chipText, { color: model === f.key ? '#fff' : colors.textSecondary }]}>{f.label} ({countFor(f.key)})</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 20 }}>No vehicles here right now. When companies publish verified vehicles for Rental, Work &amp; Pay or DriveOn, they will appear here.</Text>}
        renderItem={({ item: v }) => {
          const interest = interestByVehicle[v.id];
          return (
            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {v.imageUrls?.[0] ? <Image source={{ uri: resolveVehiclePhoto(v.imageUrls[0]) }} style={s.photo} /> : <View style={[s.photo, { backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: colors.textMuted, fontSize: 12 }}>No photo yet</Text></View>}
              <View style={s.badgeRow}>
                <View style={[s.badge, { backgroundColor: palette.brand }]}><Text style={s.badgeText}>{MODEL_LABEL[v.operatingModel] || 'Available'}</Text></View>
                <View style={[s.badge, { backgroundColor: '#00000088' }]}><Text style={s.badgeText}>{v.interestCount} interested</Text></View>
              </View>
              <View style={{ padding: 14 }}>
                <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 15 }}>{v.make} {v.model} · {v.year}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{v.registrationNumber} · {v.color || ''} · {(v.type || '').replace(/_/g, ' ')} · {(v.fuelType || '').replace(/_/g, ' ')} · {v.location || v.region || ''}</Text>
                <View style={s.row}><Text style={{ color: colors.textMuted, fontSize: 12 }}>Contract type</Text><Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '700' }}>{MODEL_LABEL[v.operatingModel] || 'To be agreed'}</Text></View>
                {v.estimatedValue != null && <View style={s.row}><Text style={{ color: colors.textMuted, fontSize: 12 }}>Vehicle value</Text><Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '700' }}>{fmtGHS(v.estimatedValue)}</Text></View>}
                <View style={s.row}><Text style={{ color: colors.textMuted, fontSize: 12 }}>Listed by</Text><Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '700' }}>{v.managingCompany?.name || 'Company'}</Text></View>
                {interest ? (
                  <View style={{ marginTop: 12 }}>
                    <Text style={{ color: interest.status === 'APPROVED' ? palette.brand : colors.textMuted, fontSize: 12, fontWeight: '600' }}>
                      {interest.status === 'APPROVED' ? 'The company approved you for this vehicle.' : interest.status === 'DECLINED' ? 'The company chose another driver this time.' : interest.status === 'RELEASED' ? 'You were released from this vehicle.' : 'Interest sent — waiting for the company.'}
                    </Text>
                    {interest.threadId && <TouchableOpacity onPress={() => router.push({ pathname: '/(user)/messages', params: { thread: interest.threadId } })} style={[s.chatBtn, { borderColor: colors.border }]}><Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700' }}>Open chat with company</Text></TouchableOpacity>}
                  </View>
                ) : noteFor?.id === v.id ? (
                  <View style={{ marginTop: 12 }}>
                    <TextInput
                      style={[s.note, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                      placeholder="Tell the company about yourself (licence, experience)…"
                      placeholderTextColor={colors.textMuted}
                      value={note}
                      onChangeText={setNote}
                      multiline
                    />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity onPress={() => setNoteFor(null)} style={[s.chatBtn, { flex: 1, borderColor: colors.border }]}><Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700' }}>Cancel</Text></TouchableOpacity>
                      <TouchableOpacity onPress={express} disabled={busyId === v.id} style={[s.chatBtn, { flex: 1, backgroundColor: palette.brand, borderColor: palette.brand }]}><Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{busyId === v.id ? 'Sending…' : 'Send interest'}</Text></TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => { setNoteFor(v); setNote(''); }} style={[s.interestBtn, { backgroundColor: palette.brand }]}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Show interest</Text></TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  photo: { width: '100%', height: 170 },
  badgeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -34, paddingHorizontal: 10 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  interestBtn: { borderRadius: 24, paddingVertical: 12, alignItems: 'center', marginTop: 14 },
  chatBtn: { borderWidth: 1, borderRadius: 24, paddingVertical: 11, alignItems: 'center', marginTop: 10 },
  note: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 13, minHeight: 70, textAlignVertical: 'top', marginBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 12.5, fontWeight: '700' },
});
