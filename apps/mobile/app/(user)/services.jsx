import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import { useAuth, fmtDate } from '../../lib/useAuth';
import { maintenanceApi } from '../../lib/api';
import RenewalsPanel from '../../components/RenewalsPanel';
import ServicesCatalog from '../../components/ServicesCatalog';
import { Badge, EmptyState } from '../../components/ui';

// Services tab: the user's service & maintenance requests, mirroring the
// Maintenance tabs in the Driver and Owner apps.
export default function UserServices() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await maintenanceApi.list({ limit: 50 }).catch(() => null);
      setRequests(r?.data?.data?.requests || []);
    } catch {}
    setFetching(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  if (fetching) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }} edges={['bottom']}>
        <ActivityIndicator color={colors.textPrimary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <RenewalsPanel />
        <ServicesCatalog />
        {requests.length === 0 ? (
          <EmptyState icon="build-outline" title="No service requests" description="Service and maintenance requests for vehicles you are linked to will appear here." />
        ) : (
          requests.map((r) => (
            <View key={r.id} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={s.rowBetween}>
                <Text style={[s.title, { color: colors.textPrimary }]}>{(r.type || 'Maintenance').replace(/_/g, ' ')}</Text>
                <Badge label={r.status || ''} tone="warning" />
              </View>
              <Text style={[s.meta, { color: colors.textMuted }]}>
                {r.vehicle?.registrationNumber ? `${r.vehicle.registrationNumber} Â· ` : ''}{fmtDate(r.createdAt)}
              </Text>
              {r.description ? <Text style={[s.desc, { color: colors.textSecondary }]}>{r.description}</Text> : null}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  title: { fontSize: 14.5, fontWeight: '700', flex: 1 },
  meta: { fontSize: 12, marginTop: 4 },
  desc: { fontSize: 13.5, lineHeight: 19, marginTop: 8 },
});
