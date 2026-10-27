import { Tabs, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';
import { TabIcon } from '../../components/TabIcon';
import { registerPushToken } from '../../lib/push';
import { notificationsApi } from '../../lib/api';

// Notifications are not a tab — the bell in the header opens them.
function NotificationBell() {
  const { colors } = useTheme();
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let live = true;
    notificationsApi.list({ limit: 50 })
      .then((r) => { if (live) setUnread((r.data?.data?.notifications || []).filter((n) => !n.readAt).length); })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  return (
    <TouchableOpacity onPress={() => router.push('/(owner)/notifications')} hitSlop={10} style={{ marginRight: 16 }} accessibilityRole="button" accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
      <Ionicons name="notifications-outline" size={23} color={colors.brand} />
      {unread > 0 && <View style={bell.badge}><Text style={bell.badgeText}>{unread > 99 ? '99+' : unread}</Text></View>}
    </TouchableOpacity>
  );
}

const bell = StyleSheet.create({
  badge: { position: 'absolute', top: -6, right: -10, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});

export default function OwnerLayout() {
  const { colors } = useTheme();

  useEffect(() => { registerPushToken(); }, []);

  const screenOpts = {
    tabBarActiveTintColor: colors.tabActive,
    tabBarInactiveTintColor: colors.tabInactive,
    tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, borderTopWidth: 1, height: 70, paddingTop: 6, paddingBottom: 10, paddingHorizontal: 6 },
    tabBarItemStyle: { borderRadius: 14, marginHorizontal: 2 },
    tabBarActiveBackgroundColor: 'transparent',
    tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 2 },
    headerStyle:        { backgroundColor: colors.surface },
    headerTintColor: colors.brand,
    headerTitleStyle:   { fontWeight: '700', color: colors.textPrimary },
    headerShadowVisible: false,
    headerRight: () => <NotificationBell />,
  };

  // Owner tabs: Dashboard, Chat, Payments, Contracts, My Vehicles,
  // Servicing, Tracking, My Account, Settings. On mobile the first five
  // sit in the tab bar; the rest open from Dashboard Quick Links.
  return (
    <Tabs screenOptions={screenOpts}>
      <Tabs.Screen
        name="dashboard"
        options={{
          headerShown: false,
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
        name="payments"
        options={{
          title: 'Payments',
          tabBarLabel: 'Payments',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name="payments" color={color} size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="contracts"
        options={{
          title: 'Contracts',
          tabBarLabel: 'Contracts',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name="contract" color={color} size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="vehicles"
        options={{
          title: 'My Vehicles',
          tabBarLabel: 'Vehicles',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name="vehicle" color={color} size={size} focused={focused} />,
        }}
      />
      {/* Reached via Dashboard Quick Links / bell, not the tab bar */}
      <Tabs.Screen name="maintenance"   options={{ href: null, title: 'Servicing' }} />
      <Tabs.Screen name="tracking"      options={{ href: null, title: 'Tracking' }} />
      <Tabs.Screen name="profile"       options={{ href: null, title: 'My Account' }} />
      <Tabs.Screen name="explore"       options={{ href: null, title: 'Explore' }} />
      <Tabs.Screen name="drivers"       options={{ href: null, title: 'My Drivers' }} />
      <Tabs.Screen name="notifications" options={{ href: null, title: 'Notifications' }} />
      <Tabs.Screen name="disputes"      options={{ href: null, title: 'Disputes' }} />
    </Tabs>
  );
}
