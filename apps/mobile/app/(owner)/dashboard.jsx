import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';
import { useAuth, fmtGHS, fmtDate, greeting } from '../../lib/useAuth';
import { vehiclesApi, contractsApi, paymentsApi, notificationsApi } from '../../lib/api';
import { Card, Badge, StatTile, EmptyState, ActionTile, statusTone } from '../../components/ui';

export default function OwnerDashboard() {
  const { colors } = useTheme();
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({ vehicles: 0, activeContracts: 0, recentPayments: 0 });
  const [recentPayments, setRecent] = useState([]);
  const [unread, setUnread] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [vRes, cRes, pRes, nRes] = await Promise.allSettled([
        vehiclesApi.list({ limit: 100 }),
        contractsApi.list({ limit: 100, status: 'ACTIVE' }),
        paymentsApi.list({ limit: 5 }),
        notificationsApi.list({ limit: 1, status: 'PENDING' }),
      ]);
      setStats({
        vehicles: vRes.status === 'fulfilled' ? (vRes.value.data?.data?.vehicles || []).length : 0,
        activeContracts: cRes.status === 'fulfilled' ? (cRes.value.data?.data?.contracts || []).length : 0,
        recentPayments: pRes.status === 'fulfilled' ? (pRes.value.data?.data?.payments || []).length : 0,
      });
      setRecent(pRes.status === 'fulfilled' ? (pRes.value.data?.data?.payments || []) : []);
      setUnread(nRes.status === 'fulfilled' ? (nRes.value.data?.data?.pagination?.total || 0) : 0);
    } catch {}
    setFetching(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  if (loading || fetching) {
    return (
      <SafeAreaView style={[s.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Loading your fleet…</Text>
      </SafeAreaView>
    );
  }

  const totalReceived = recentPayments.filter((p) => p.status === 'SUCCESSFUL').reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const ACTIONS = [
    { label: 'My Vehicles', icon: 'car-outline', route: '/(owner)/vehicles' },
    { label: 'Drivers', icon: 'people-outline', route: '/(owner)/drivers' },
    { label: 'Payments', icon: 'card-outline', route: '/(owner)/payments' },
    { label: 'Tracking', icon: 'navigate-outline', route: '/(owner)/tracking' },
    { label: 'Maintenance', icon: 'build-outline', route: '/(owner)/maintenance' },
    { label: 'Alerts', icon: 'notifications-outline', route: '/(owner)/notifications', badge: unread > 0 ? String(unread) : null },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={[s.greeting, { color: colors.textSecondary }]}>{greeting()},</Text>
            <Text style={[s.name, { color: colors.textPrimary }]} numberOfLines={1}>{user?.firstName} {user?.lastName}</Text>
          </View>
          <Badge label="Owner" tone="success" />
        </View>

        <Card style={{ marginBottom: 16 }}>
          <Text style={[s.cardTitle, { color: colors.textPrimary }]}>Fleet at a glance</Text>
          <View style={s.stats}>
            <StatTile label="Vehicles" value={String(stats.vehicles)} />
            <StatTile label="Active contracts" value={String(stats.activeContracts)} />
            <StatTile label="Received (recent)" value={fmtGHS(totalReceived)} />
          </View>
          {stats.vehicles === 0 && (
            <Text style={[s.cardNote, { color: colors.textSecondary }]}>Add your first vehicle to start creating contracts and receiving payments.</Text>
          )}
        </Card>

        <Text style={[s.section, { color: colors.textPrimary }]}>Quick actions</Text>
        <View style={s.grid}>
          {ACTIONS.map((a) => <ActionTile key={a.label} {...a} onPress={() => router.push(a.route)} />)}
        </View>

        <View style={s.rowBetween}>
          <Text style={[s.section, { color: colors.textPrimary }]}>Recent payments</Text>
          <TouchableOpacity onPress={() => router.push('/(owner)/payments')} hitSlop={10}>
            <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 14 }}>View all</Text>
          </TouchableOpacity>
        </View>
        {recentPayments.length === 0 ? (
          <EmptyState icon="card-outline" title="No payments yet" description="Payments from your drivers will appear here as soon as they are made." />
        ) : (
          <Card style={{ padding: 6 }}>
            {recentPayments.map((p, i) => (
              <View key={p.id} style={[s.payRow, i < recentPayments.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.separator }]}>
                <View style={[s.payIcon, { backgroundColor: colors.brandSoft }]}>
                  <Ionicons name={p.status === 'SUCCESSFUL' ? 'arrow-down' : p.status === 'FAILED' ? 'close' : 'time-outline'} size={18} color={colors.brandText} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.payAmount, { color: colors.textPrimary }]}>{fmtGHS(p.amount)}</Text>
                  <Text style={[s.payDate, { color: colors.textMuted }]}>{fmtDate(p.createdAt)}</Text>
                </View>
                <Badge label={(p.status || '').replace(/_/g, ' ')} tone={statusTone(p.status)} />
              </View>
            ))}
          </Card>
        )}

        <TouchableOpacity style={[s.signOut, { borderColor: colors.border }]} onPress={logout} activeOpacity={0.8} accessibilityRole="button">
          <Ionicons name="log-out-outline" size={18} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 15 }}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  content: { padding: 20, paddingBottom: 36 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 12 },
  greeting: { fontSize: 14 },
  name: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4, marginTop: 2 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardNote: { fontSize: 13.5, lineHeight: 19, marginTop: 12 },
  stats: { flexDirection: 'row', gap: 10, marginTop: 14 },
  section: { fontSize: 17, fontWeight: '700', marginTop: 8, marginBottom: 12, letterSpacing: -0.2 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20, justifyContent: 'space-between' },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 10 },
  payIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  payAmount: { fontSize: 15, fontWeight: '700' },
  payDate: { fontSize: 12.5, marginTop: 2 },
  signOut: { marginTop: 22, borderWidth: 1, borderRadius: 12, minHeight: 52, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
});
