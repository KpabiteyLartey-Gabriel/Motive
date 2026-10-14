import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import { useAuth, fmtDate } from '../../lib/useAuth';
import { notificationsApi } from '../../lib/api';

export default function DriverNotifications() {
  const { colors } = useTheme();
  const { user, loading } = useAuth();

  const [items, setItems]         = useState([]);
  const [fetching, setFetching]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await notificationsApi.list({ limit: 50 });
      setItems(res.data?.data?.notifications || []);
    } catch {}
    setFetching(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const markRead = async (id) => {
    try {
      await notificationsApi.markRead(id);
      setItems((prev) => prev.map((n) => n.id === id ? { ...n, status: 'READ', readAt: new Date() } : n));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setItems((prev) => prev.map((n) => ({ ...n, status: 'READ' })));
    } catch {}
  };

  if (loading || fetching) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.textPrimary} />
      </SafeAreaView>
    );
  }

  const unread = items.filter((n) => n.status !== 'READ').length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} />}
      >
        {/* Header row */}
        <View style={[s.topRow, { borderBottomColor: colors.border }]}>
          <Text style={[s.topTitle, { color: colors.textPrimary }]}>
            Notifications {unread > 0 && <Text style={{ color: colors.warning }}>({unread} unread)</Text>}
          </Text>
          {unread > 0 && (
            <TouchableOpacity onPress={markAllRead} activeOpacity={0.7}>
              <Text style={[s.markAll, { color: colors.textSecondary }]}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>

        {items.length === 0 ? (
          <View style={[s.empty, { borderColor: colors.border }]}>
            <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>No notifications</Text>
            <Text style={[s.emptyText, { color: colors.textMuted }]}>You're all caught up.</Text>
          </View>
        ) : (
          items.map((n) => {
            const isUnread = n.status !== 'READ';
            return (
              <TouchableOpacity
                key={n.id}
                style={[s.item, {
                  borderBottomColor: colors.border,
                  backgroundColor: isUnread ? colors.elevated : 'transparent',
                }]}
                onPress={() => isUnread && markRead(n.id)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  {n.subject && <Text style={[s.subject, { color: colors.textPrimary }]}>{n.subject}</Text>}
                  <Text style={[s.body, { color: isUnread ? colors.textSecondary : colors.textMuted }]} numberOfLines={3}>{n.body}</Text>
                  <Text style={[s.date, { color: colors.textMuted }]}>{fmtDate(n.createdAt)}</Text>
                </View>
                {isUnread && <View style={[s.dot, { backgroundColor: colors.warning }]} />}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  topRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  topTitle:  { fontSize: 16, fontWeight: '700' },
  markAll:   { fontSize: 13 },
  item:      { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  subject:   { fontSize: 14, fontWeight: '600', marginBottom: 3 },
  body:      { fontSize: 13, lineHeight: 19 },
  date:      { fontSize: 11, marginTop: 5 },
  dot:       { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  empty:     { margin: 20, borderWidth: 1, borderRadius: 16, padding: 40, alignItems: 'center' },
  emptyTitle:{ fontSize: 15, fontWeight: '600', marginBottom: 8 },
  emptyText: { fontSize: 13 },
});
