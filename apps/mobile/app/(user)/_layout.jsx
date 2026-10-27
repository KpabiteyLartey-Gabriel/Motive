import { Tabs, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';
import { TabIcon } from '../../components/TabIcon';
import { notificationsApi } from '../../lib/api';
import { registerPushToken } from '../../lib/push';

// User portal tabs: Dashboard (the Explore vehicle grid), Chat,
// My Accounts, Services, Settings last. Notifications are not a tab —
// the bell in the header opens them.
function NotificationBell() {
  const { colors } = useTheme();
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let live = true;
    notificationsApi.list({ limit: 50 })
      .then((r) => {
        if (!live) return;
        const items = r.data?.data?.notifications || [];
        setUnread(items.filter((n) => !n.readAt).length);
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  return (
    <TouchableOpacity
      onPress={() => router.push('/(user)/notifications')}
      hitSlop={10}
      style={{ marginRight: 16 }}
      accessibilityRole="button"
      accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'}
    >
      <Ionicons name="notifications-outline" size={23} color={colors.brand} />
      {unread > 0 && (
        <View style={s.badge}>
          <Text style={s.badgeText}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function UserLayout() {
  const { colors } = useTheme();

  useEffect(() => { registerPushToken(); }, []);

  const screenOpts = {
    tabBarActiveTintColor: colors.tabActive,
    tabBarInactiveTintColor: colors.tabInactive,
    tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, borderTopWidth: 1, height: 70, paddingTop: 6, paddingBottom: 10, paddingHorizontal: 6 },
    tabBarItemStyle: { borderRadius: 14, marginHorizontal: 2 },
    tabBarActiveBackgroundColor: 'transparent',
    tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 2 },
    headerStyle: { backgroundColor: colors.surface },
    headerTintColor: colors.brand,
    headerTitleStyle: { fontWeight: '700', color: colors.textPrimary },
    headerShadowVisible: false,
    headerRight: () => <NotificationBell />,
  };

  return (
    <Tabs screenOptions={screenOpts}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Dashboard',
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name="home" color={color} size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Chat',
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name="messages" color={color} size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: 'My Accounts',
          tabBarLabel: 'Accounts',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name="profile" color={color} size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: 'Services',
          tabBarLabel: 'Services',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name="services" color={color} size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name="settings" color={color} size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen name="notifications" options={{ title: 'Notifications', href: null }} />
      <Tabs.Screen name="add-account" options={{ title: 'Add Account', href: null }} />
    </Tabs>
  );
}

const s = StyleSheet.create({
  badge: { position: 'absolute', top: -6, right: -10, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
