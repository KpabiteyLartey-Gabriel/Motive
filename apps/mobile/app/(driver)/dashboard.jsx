import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';
import { useAuth, fmtGHS, fmtDate, greeting } from '../../lib/useAuth';
import { contractsApi, paymentsApi, notificationsApi } from '../../lib/api';
import { Card, Badge, StatTile, ProgressBar, EmptyState, ActionTile, PrimaryButton, statusTone } from '../../components/ui';

export default function DriverDashboard() {
  const { colors } = useTheme();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [contract, setContract] = useState(null);
  const [payments, setPayments] = useState([]);
  const [unread, setUnread] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [cRes, pRes, nRes] = await Promise.allSettled([
        contractsApi.list({ limit: 1, status: 'ACTIVE' }),
        paymentsApi.list({ limit: 5 }),
        notificationsApi.list({ limit: 1, status: 'PENDING' }),
      ]);
      if (cRes.status === 'fulfilled') setContract((cRes.value.data?.data?.contracts || [])[0] || null);
      if (pRes.status === 'fulfilled') setPayments(pRes.value.data?.data?.payments || []);
      if (nRes.status === 'fulfilled') setUnread(nRes.value.data?.data?.pagination?.total || 0);
    } catch {}
    setFetching(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  if (loading || fetching) {
    return (
      <SafeAreaView style={[s.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Loading your dashboard…</Text>
      </SafeAreaView>
    );
  }

  const wap = contract?.workAndPayTerms;
  const total = Number(wap?.totalAmount ?? wap?.totalPayable ?? 0);
  const paid = Number(wap?.totalPaid ?? 0);
  const pct = total > 0 ? (paid / total) * 100 : 0;

  const ACTIONS = [
    { label: 'Make Payment', icon: 'card-outline', route: '/(driver)/payments' },
    { label: 'My Contract', icon: 'document-text-outline', route: '/(driver)/contract' },
    { label: 'My Vehicle', icon: 'car-outline', route: '/(driver)/vehicle' },
    { label: 'Track Vehicle', icon: 'navigate-outline', route: '/(driver)/tracking' },
    { label: 'Maintenance', icon: 'build-outline', route: '/(driver)/maintenance' },
    { label: 'Alerts', icon: 'notifications-outline', route: '/(driver)/notifications', badge: unread > 0 ? String(unread) : null },
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
          <Badge label="Driver" tone="success" />
        </View>

        {contract ? (
          <Card style={{ marginBottom: 16 }}>
            <View style={s.rowBetween}>
              <Text style={[s.cardTitle, { color: colors.textPrimary }]}>{contract.contractNumber || 'Active contract'}</Text>
              <Badge label={(contract.status || 'ACTIVE').replace(/_/g, ' ')} tone={statusTone(contract.status)} />
            </View>
            <View style={s.stats}>
              <StatTile label="Total paid" value={fmtGHS(wap?.totalPaid ?? 0)} />
              <StatTile label="Remaining" value={fmtGHS(wap?.remainingBalance ?? 0)} />
              <StatTile label="Next payment" value={fmtGHS(wap?.installmentAmount ?? 0)} />
            </View>
            {total > 0 && (
              <View style={{ marginTop: 16 }}>
                <ProgressBar value={pct} />
                <Text style={[s.progressNote, { color: colors.textSecondary }]}>{Math.round(pct)}% of {fmtGHS(total)} paid — you are on track.</Text>
              </View>
            )}
            <PrimaryButton title="Make a payment" onPress={() => router.push('/(driver)/payments')} style={{ marginTop: 16 }} />
          </Card>
        ) : (
          <EmptyState icon="document-text-outline" title="No active contract yet" description="When an owner assigns you a vehicle, your contract and payment plan will appear here." />
        )}

        <Text style={[s.section, { color: colors.textPrimary }]}>Quick actions</Text>
        <View style={s.grid}>
          {ACTIONS.map((a) => <ActionTile key={a.label} {...a} onPress={() => router.push(a.route)} />)}
        </View>

        <View style={s.rowBetween}>
          <Text style={[s.section, { color: colors.textPrimary }]}>Recent payments</Text>
          <TouchableOpacity onPress={() => router.push('/(driver)/payments')} hitSlop={10}>
            <Text style={[s.viewAll, { color: colors.brand }]}>View all</Text>
          </TouchableOpacity>
        </View>
        {payments.length === 0 ? (
          <EmptyState icon="card-outline" title="No payments yet" description="Payments you make will show here with their status and receipt date." />
        ) : (
          <Card style={{ padding: 6 }}>
            {payments.map((p, i) => (
              <View key={p.id} style={[s.payRow, i < payments.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.separator }]}>
                <View style={[s.payIcon, { backgroundColor: colors.brandSoft }]}>
                  <Ionicons name={p.status === 'SUCCESSFUL' ? 'checkmark' : p.status === 'FAILED' ? 'close' : 'time-outline'} size={18} color={colors.brandText} />
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
  cardTitle: { fontSize: 16, fontWeight: '700', flex: 1 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  stats: { flexDirection: 'row', gap: 10, marginTop: 14 },
  progressNote: { fontSize: 13, marginTop: 8 },
  section: { fontSize: 17, fontWeight: '700', marginTop: 8, marginBottom: 12, letterSpacing: -0.2 },
  viewAll: { fontSize: 14, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20, justifyContent: 'space-between' },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 10 },
  payIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  payAmount: { fontSize: 15, fontWeight: '700' },
  payDate: { fontSize: 12.5, marginTop: 2 },
  signOut: { marginTop: 22, borderWidth: 1, borderRadius: 12, minHeight: 52, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
});
