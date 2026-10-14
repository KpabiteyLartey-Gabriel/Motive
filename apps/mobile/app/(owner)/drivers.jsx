import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import { useAuth, fmtDate } from '../../lib/useAuth';
import { contractsApi } from '../../lib/api';

export default function OwnerDrivers() {
  const { colors } = useTheme();
  const { user, loading } = useAuth();
  const [contracts, setContracts]   = useState([]);
  const [fetching, setFetching]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Owner sees their drivers via contracts
  const load = useCallback(async () => {
    try {
      const res = await contractsApi.list({ limit: 50 });
      setContracts(res.data?.data?.contracts || []);
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

  // Flatten: one row per contract party who is a driver
  const driverRows = contracts.flatMap((c) =>
    (c.parties || [])
      .filter((p) => p.role === 'DRIVER' && p.userId)
      .map((p) => ({
        contractId:     c.id,
        contractNumber: c.contractNumber,
        contractType:   c.type?.replace(/_/g, ' '),
        contractStatus: c.status,
        userId:         p.userId,
        signedAt:       p.signedAt,
        vehicle:        c.vehicle,
      }))
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} />}
      >
        <Text style={[s.pageTitle, { color: colors.textPrimary }]}>
          {driverRows.length} driver{driverRows.length !== 1 ? 's' : ''} via contracts
        </Text>

        {driverRows.length === 0 ? (
          <View style={[s.empty, { borderColor: colors.border }]}>
            <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>No drivers yet</Text>
            <Text style={[s.emptyText, { color: colors.textMuted }]}>Drivers will appear here once you create contracts.</Text>
          </View>
        ) : (
          driverRows.map((d, i) => {
            const statusColor = d.contractStatus === 'ACTIVE' ? colors.success : colors.textMuted;
            return (
              <View key={`${d.contractId}-${d.userId}`} style={[s.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={[s.cardLabel, { color: colors.textMuted }]}>Driver ID</Text>
                  <Text style={[s.cardValue, { color: colors.textSecondary, fontFamily: 'monospace' }]} numberOfLines={1}>{d.userId.slice(0, 14)}…</Text>
                </View>
                {[
                  { label: 'Contract',  value: d.contractNumber },
                  { label: 'Type',      value: d.contractType },
                  { label: 'Status',    value: d.contractStatus },
                  { label: 'Vehicle',   value: d.vehicle ? `${d.vehicle.make} ${d.vehicle.model} (${d.vehicle.registrationNumber})` : '—' },
                  { label: 'Signed',    value: d.signedAt ? fmtDate(d.signedAt) : 'Not yet signed' },
                ].map(({ label, value }) => (
                  <View key={label} style={[s.infoRow, { borderBottomColor: colors.border }]}>
                    <Text style={[s.infoLabel, { color: colors.textMuted }]}>{label}</Text>
                    <Text style={[s.infoValue, { color: label === 'Status' ? statusColor : colors.textPrimary }]}>{value || '—'}</Text>
                  </View>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pageTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  card:      { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12 },
  cardLabel: { fontSize: 12 },
  cardValue: { fontSize: 12 },
  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1 },
  infoLabel: { fontSize: 13 },
  infoValue: { fontSize: 13, fontWeight: '500', textAlign: 'right', flex: 1 },
  empty:     { borderWidth: 1, borderRadius: 16, padding: 40, alignItems: 'center' },
  emptyTitle:{ fontSize: 15, fontWeight: '600', marginBottom: 8 },
  emptyText: { fontSize: 13, textAlign: 'center' },
});
