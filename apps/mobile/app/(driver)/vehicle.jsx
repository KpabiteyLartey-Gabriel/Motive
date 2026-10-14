import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import { useAuth, fmtDate } from '../../lib/useAuth';
import { vehiclesApi, complianceApi } from '../../lib/api';
import VehiclePhotos from '../../components/VehiclePhotos';

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

  const load = useCallback(async () => {
    try {
      const res = await vehiclesApi.list({ limit: 1 });
      const vehicles = res.data?.data?.vehicles || [];
      const v = vehicles[0] || null;
      setVehicle(v);
      if (v) {
        const cRes = await complianceApi.listForVehicle(v.id);
        setCompliance(cRes.data?.data || []);
      }
    } catch {}
    setFetching(false);
    setRefreshing(false);
  }, []);

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
          <InfoRow label="Engine No."  value={vehicle.engineNumber} colors={colors} />
          <InfoRow label="Operating"   value={vehicle.operatingModel?.replace(/_/g, ' ')} colors={colors} />
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
