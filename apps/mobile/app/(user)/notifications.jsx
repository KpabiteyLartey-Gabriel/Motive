import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, palette } from '../../lib/theme';
import { useAuth, fmtDate } from '../../lib/useAuth';
import { notificationsApi } from '../../lib/api';
import { EmptyState } from '../../components/ui';

// Notifications: opened from the bell in the header, not a tab.
export default function UserNotifications() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await notificationsApi.list({ limit: 50 }).catch(() => null);
      setItems(r?.data?.data?.notifications || []);
    } catch {}
    setFetching(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  const markRead = async (n) => {
    if (n.readAt) return;
    try {
      await notificationsApi.markRead(n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
    } catch {}
  };

  if (fetching) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }} edges={['bottom']}>
        <ActivityIndicator color={palette.brand} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={<EmptyState icon="notifications-outline" title="No notifications" description="Updates about your account will appear here." />}
        renderItem={({ item: n }) => (
          <TouchableOpacity
            onPress={() => markRead(n)}
            activeOpacity={0.8}
            style={[s.card, { backgroundColor: colors.card, borderColor: n.readAt ? colors.border : palette.brand }]}
            accessibilityRole="button"
          >
            <View style={s.rowBetween}>
              <Text style={[s.title, { color: colors.textPrimary }]}>{n.title || 'Notification'}</Text>
              <Text style={[s.date, { color: colors.textMuted }]}>{fmtDate(n.createdAt)}</Text>
            </View>
            {n.body ? <Text style={[s.body, { color: colors.textSecondary }]}>{n.body}</Text> : null}
            {!n.readAt ? <Text style={[s.unread, { color: palette.brand }]}>Unread</Text> : null}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  title: { fontSize: 14.5, fontWeight: '700', flex: 1 },
  date: { fontSize: 11.5 },
  body: { fontSize: 13.5, lineHeight: 19, marginTop: 6 },
  unread: { fontSize: 11.5, fontWeight: '700', marginTop: 8 },
});
