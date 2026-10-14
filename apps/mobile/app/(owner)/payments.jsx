import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import { useAuth, fmtGHS, fmtDate } from '../../lib/useAuth';
import { paymentsApi } from '../../lib/api';

const STATUS_COLOR = {
  SUCCESSFUL: 'success',
  FAILED:     'danger',
  PENDING:    'warning',
  PROCESSING: 'warning',
  INITIATED:  'warning',
  REVERSED:   'danger',
};

export default function OwnerPayments() {
  const { colors } = useTheme();
  const { user, loading } = useAuth();
  const [payments, setPayments]   = useState([]);
  const [fetching, setFetching]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totals, setTotals]       = useState({ received: 0, pending: 0 });

  const load = useCallback(async () => {
    try {
      const res = await paymentsApi.list({ limit: 100 });
      const list = res.data?.data?.payments || [];
      setPayments(list);
      const received = list.filter((p) => p.status === 'SUCCESSFUL').reduce((acc, p) => acc + Number(p.amount), 0);
      const pending  = list.filter((p) => ['PENDING', 'PROCESSING', 'INITIATED'].includes(p.status)).reduce((acc, p) => acc + Number(p.amount), 0);
      setTotals({ received, pending });
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} />}
      >
        {/* Summary */}
        <View style={[s.summaryRow, { borderColor: colors.border }]}>
          <View style={[s.summaryItem, { borderRightWidth: 1, borderRightColor: colors.border }]}>
            <Text style={[s.summaryValue, { color: colors.success }]}>{fmtGHS(totals.received)}</Text>
            <Text style={[s.summaryLabel, { color: colors.textMuted }]}>Received</Text>
          </View>
          <View style={s.summaryItem}>
            <Text style={[s.summaryValue, { color: colors.warning }]}>{fmtGHS(totals.pending)}</Text>
            <Text style={[s.summaryLabel, { color: colors.textMuted }]}>Pending</Text>
          </View>
        </View>

        <Text style={[s.section, { color: colors.textSecondary }]}>All Transactions</Text>

        {payments.length === 0 ? (
          <View style={[s.empty, { borderColor: colors.border }]}>
            <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>No transactions yet</Text>
            <Text style={[s.emptyText, { color: colors.textMuted }]}>Payment history will appear here.</Text>
          </View>
        ) : (
          <View style={[s.list, { borderColor: colors.border }]}>
            {payments.map((p, i) => {
              const dotColor = colors[STATUS_COLOR[p.status]] || colors.textMuted;
              return (
                <View key={p.id} style={[s.row, { borderBottomColor: colors.border }, i === payments.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.rowAmount, { color: colors.textPrimary }]}>{fmtGHS(p.amount)}</Text>
                    <Text style={[s.rowDate, { color: colors.textMuted }]}>{fmtDate(p.createdAt)}</Text>
                    {p.payerPhone && <Text style={[s.rowRef, { color: colors.textMuted }]}>From: {p.payerPhone}</Text>}
                    {p.contractId && <Text style={[s.rowRef, { color: colors.textMuted }]}>Contract: {p.contractId.slice(0, 8)}…</Text>}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <View style={[s.dot, { backgroundColor: dotColor }]} />
                      <Text style={[s.rowStatus, { color: colors.textSecondary }]}>{p.status}</Text>
                    </View>
                    <Text style={[s.rowMethod, { color: colors.textMuted }]}>{p.paymentMethod || '—'}</Text>
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
  summaryRow:   { flexDirection: 'row', borderWidth: 1, borderRadius: 16, marginBottom: 20, overflow: 'hidden' },
  summaryItem:  { flex: 1, alignItems: 'center', paddingVertical: 20 },
  summaryValue: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  summaryLabel: { fontSize: 11 },
  section:      { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 },
  list:         { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  row:          { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 8 },
  rowAmount:    { fontSize: 15, fontWeight: '700' },
  rowDate:      { fontSize: 12, marginTop: 2 },
  rowRef:       { fontSize: 11, marginTop: 2 },
  dot:          { width: 6, height: 6, borderRadius: 3 },
  rowStatus:    { fontSize: 12 },
  rowMethod:    { fontSize: 11 },
  empty:        { borderWidth: 1, borderRadius: 16, padding: 32, alignItems: 'center' },
  emptyTitle:   { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  emptyText:    { fontSize: 13, textAlign: 'center' },
});
