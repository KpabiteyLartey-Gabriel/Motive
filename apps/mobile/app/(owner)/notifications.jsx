import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import { useAuth, fmtDate } from '../../lib/useAuth';
import { notificationsApi } from '../../lib/api';

const FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'UNREAD', label: 'Unread' },
  { key: 'PAYMENTS', label: 'Payments' },
  { key: 'ANNOUNCEMENTS', label: 'Announcements' },
  { key: 'ACCOUNT', label: 'Account' },
];

function categoryOf(n) {
  if (n.type?.startsWith('PAYMENT')) return 'PAYMENTS';
  if (n.type === 'ADMIN_ANNOUNCEMENT') return 'ANNOUNCEMENTS';
  return 'ACCOUNT';
}

export default function OwnerNotifications() {
  const { colors } = useTheme();
  const { user, loading } = useAuth();
  const [items, setItems]         = useState([]);
  const [fetching, setFetching]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]       = useState('ALL');

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
      setItems((prev) => prev.map((n) => n.id === id ? { ...n, status: 'READ', readAt: new Date().toISOString() } : n));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setItems((prev) => prev.map((n) => ({ ...n, status: 'READ', readAt: n.readAt || new Date().toISOString() })));
    } catch {}
  };

  if (loading || fetching) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.textPrimary} />
      </SafeAreaView>
    );
  }

  const unread = items.filter((n) => !n.readAt).length;
  const visible = items.filter((n) => {
    if (filter === 'ALL') return true;
    if (filter === 'UNREAD') return !n.readAt;
    return categoryOf(n) === filter;
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} />}
      >
        <View style={[s.topRow, { borderBottomColor: colors.border }]}>
          <Text style={[s.topTitle, { color: colors.textPrimary }]}>
            Notifications {unread > 0 && <Text style={{ color: colors.warning }}>({unread})</Text>}
          </Text>
          {unread > 0 && (
            <TouchableOpacity onPress={markAllRead} activeOpacity={0.7}>
              <Text style={[s.markAll, { color: colors.textSecondary }]}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {FILTERS.map((f) => (
            <TouchableOpacity key={f.key} onPress={() => setFilter(f.key)} activeOpacity={0.7}
              style={[s.chip, { borderColor: colors.border, backgroundColor: filter === f.key ? colors.brand : 'transparent' }]}>
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: filter === f.key ? '#fff' : colors.textSecondary }}>
                {f.label}{f.key === 'UNREAD' && unread ? ` (${unread})` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {visible.length === 0 ? (
          <View style={[s.empty, { borderColor: colors.border }]}>
            <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>{filter === 'UNREAD' ? 'All caught up' : 'No notifications'}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 6, textAlign: 'center' }}>Payments you receive, announcements and account updates will appear here.</Text>
          </View>
        ) : (
          visible.map((n) => {
            const isUnread = !n.readAt;
            return (
              <TouchableOpacity
                key={n.id}
                style={[s.item, { borderBottomColor: colors.border, backgroundColor: isUnread ? colors.elevated : 'transparent' }]}
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
  chips:     { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  empty:     { margin: 20, borderWidth: 1, borderRadius: 16, padding: 40, alignItems: 'center' },
  emptyTitle:{ fontSize: 15, fontWeight: '600' },
});
