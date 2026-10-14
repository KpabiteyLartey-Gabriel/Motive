import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import { useAuth, fmtGHS, fmtDate } from '../../lib/useAuth';
import { vehiclesApi, complianceApi, resolveVehiclePhoto } from '../../lib/api';
import VehiclePhotos from '../../components/VehiclePhotos';
import { Image } from 'react-native';

export default function OwnerVehicles() {
  const { colors } = useTheme();
  const { user, loading } = useAuth();
  const [vehicles, setVehicles]   = useState([]);
  const [fetching, setFetching]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected]   = useState(null);
  const [compliance, setCompliance] = useState([]);

  const load = useCallback(async () => {
    try {
      const res = await vehiclesApi.list({ limit: 50 });
      setVehicles(res.data?.data?.vehicles || []);
    } catch {}
    setFetching(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const openVehicle = async (v) => {
    setSelected(v);
    try {
      const res = await complianceApi.listForVehicle(v.id);
      setCompliance(res.data?.data || []);
    } catch { setCompliance([]); }
  };

  if (loading || fetching) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.textPrimary} />
      </SafeAreaView>
    );
  }

  if (selected) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <TouchableOpacity onPress={() => setSelected(null)} style={[s.back, { borderColor: colors.border }]}>
            <Text style={[s.backText, { color: colors.textSecondary }]}>← Back to fleet</Text>
          </TouchableOpacity>

          <Text style={[s.vTitle, { color: colors.textPrimary }]}>{selected.make} {selected.model}</Text>
          <Text style={[s.vPlate, { color: colors.textSecondary }]}>{selected.registrationNumber} · {selected.year}</Text>
          <VehiclePhotos vehicle={selected} colors={colors} />

          {[
            { label: 'Status',       value: selected.status },
            { label: 'Type',         value: selected.type },
            { label: 'Fuel',         value: selected.fuelType },
            { label: 'Transmission', value: selected.transmission },
            { label: 'Color',        value: selected.color },
            { label: 'Mileage',      value: selected.mileage ? `${selected.mileage.toLocaleString()} km` : '—' },
            { label: 'Value',        value: selected.estimatedValue ? fmtGHS(selected.estimatedValue) : '—' },
            { label: 'Operating',    value: selected.operatingModel?.replace(/_/g, ' ') },
          ].map(({ label, value }) => (
            <View key={label} style={[s.infoRow, { borderBottomColor: colors.border }]}>
              <Text style={[s.infoLabel, { color: colors.textMuted }]}>{label}</Text>
              <Text style={[s.infoValue, { color: colors.textPrimary }]}>{value || '—'}</Text>
            </View>
          ))}

          {compliance.length > 0 && (
            <>
              <Text style={[s.section, { color: colors.textSecondary, marginTop: 20 }]}>Compliance</Text>
              {compliance.map((c) => {
                const expColor = c.status === 'EXPIRED' ? colors.danger : c.status === 'EXPIRING_SOON' ? colors.warning : colors.success;
                return (
                  <View key={c.id} style={[s.infoRow, { borderBottomColor: colors.border }]}>
                    <Text style={[s.infoLabel, { color: colors.textMuted }]}>{c.documentType?.replace(/_/g, ' ')}</Text>
                    <Text style={[s.infoValue, { color: expColor }]}>{c.status?.replace(/_/g, ' ')}{c.expiryDate ? ` · ${fmtDate(c.expiryDate)}` : ''}</Text>
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
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
        <Text style={[s.pageTitle, { color: colors.textPrimary }]}>
          {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''}
        </Text>

        {vehicles.length === 0 ? (
          <View style={[s.empty, { borderColor: colors.border }]}>
            <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>No vehicles yet</Text>
            <Text style={[s.emptyText, { color: colors.textMuted }]}>Register a vehicle to get started.</Text>
          </View>
        ) : (
          vehicles.map((v) => {
            const statusColor = v.status === 'ACTIVE' || v.status === 'ASSIGNED' ? colors.success
              : v.status === 'UNDER_MAINTENANCE' ? colors.warning
              : colors.textMuted;
            return (
              <TouchableOpacity
                key={v.id}
                style={[s.vCard, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => openVehicle(v)}
                activeOpacity={0.75}
              >
                {v.imageUrls?.[0] ? <Image source={{ uri: resolveVehiclePhoto(v.imageUrls[0]) }} style={s.thumb} /> : null}
                <View style={{ flex: 1 }}>
                  <Text style={[s.vCardTitle, { color: colors.textPrimary }]}>{v.make} {v.model} ({v.year})</Text>
                  <Text style={[s.vCardPlate, { color: colors.textSecondary }]}>{v.registrationNumber}</Text>
                  <Text style={[s.vCardModel, { color: colors.textMuted }]}>{v.operatingModel?.replace(/_/g, ' ') || v.type}</Text>
                </View>
                <View>
                  <View style={[s.statusDot, { backgroundColor: statusColor }]} />
                  <Text style={[s.vCardArrow, { color: colors.textMuted }]}>→</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pageTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  vCard:     { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  vCardTitle:{ fontSize: 15, fontWeight: '700' },
  vCardPlate:{ fontSize: 13, marginTop: 2 },
  vCardModel:{ fontSize: 12, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 4, alignSelf: 'flex-end' },
  vCardArrow:{ fontSize: 16, alignSelf: 'flex-end' },
  back:      { borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'flex-start', marginBottom: 16 },
  backText:  { fontSize: 13 },
  vTitle:    { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  vPlate:    { fontSize: 14, marginBottom: 20 },
  section:   { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1 },
  infoLabel: { fontSize: 13 },
  infoValue: { fontSize: 13, fontWeight: '500', textAlign: 'right', flex: 1 },
  empty:     { borderWidth: 1, borderRadius: 16, padding: 40, alignItems: 'center' },
  emptyTitle:{ fontSize: 15, fontWeight: '600', marginBottom: 8 },
  emptyText: { fontSize: 13 },
  thumb:     { width: 56, height: 56, borderRadius: 10, marginRight: 12, backgroundColor: '#222' },
});
