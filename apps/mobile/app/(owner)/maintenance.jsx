import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import { useAuth, fmtDate, fmtGHS } from '../../lib/useAuth';
import { maintenanceApi } from '../../lib/api';

const STATUS_COLOR = { REQUESTED: 'warning', APPROVED: 'success', IN_PROGRESS: 'warning', COMPLETED: 'success', CANCELLED: 'danger' };

export default function OwnerMaintenance() {
  const { colors } = useTheme();
  const { user, loading } = useAuth();
  const [requests, setRequests]   = useState([]);
  const [fetching, setFetching]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await maintenanceApi.list({ limit: 50 });
      setRequests(res.data?.data?.requests || []);
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
        <Text style={[s.pageTitle, { color: colors.textPrimary }]}>Maintenance Requests</Text>

        {requests.length === 0 ? (
          <View style={[s.empty, { borderColor: colors.border }]}>
            <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>No maintenance requests</Text>
            <Text style={[s.emptyText, { color: colors.textMuted }]}>Requests for your vehicles will appear here.</Text>
          </View>
        ) : (
          requests.map((r) => {
            const dotColor = colors[STATUS_COLOR[r.status]] || colors.textMuted;
            return (
              <View key={r.id} style={[s.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <View style={[s.cardHeader, { borderBottomColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.cardTitle, { color: colors.textPrimary }]}>{r.type} — {r.urgency}</Text>
                    <Text style={[s.cardDate, { color: colors.textMuted }]}>{fmtDate(r.createdAt)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={[s.dot, { backgroundColor: dotColor }]} />
                    <Text style={[s.status, { color: colors.textSecondary }]}>{r.status}</Text>
                  </View>
                </View>
                <Text style={[s.desc, { color: colors.textSecondary }]} numberOfLines={2}>{r.description}</Text>
                {r.estimatedCost && (
                  <Text style={[s.cost, { color: colors.textMuted }]}>Est. cost: {fmtGHS(r.estimatedCost)}</Text>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pageTitle:  { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  card:       { borderWidth: 1, borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  cardTitle:  { fontSize: 13, fontWeight: '600' },
  cardDate:   { fontSize: 12, marginTop: 2 },
  dot:        { width: 6, height: 6, borderRadius: 3 },
  status:     { fontSize: 12 },
  desc:       { fontSize: 13, paddingHorizontal: 16, paddingVertical: 12, lineHeight: 19 },
  cost:       { fontSize: 12, paddingHorizontal: 16, paddingBottom: 12 },
  empty:      { borderWidth: 1, borderRadius: 16, padding: 40, alignItems: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  emptyText:  { fontSize: 13, textAlign: 'center' },
});
