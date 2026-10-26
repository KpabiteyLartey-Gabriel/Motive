import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { useTheme } from '../../lib/theme';
import { TabIcon } from '../../components/TabIcon';
import { registerPushToken } from '../../lib/push';

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
  };

  // Only four tabs: Home, Explore, Messages, Profile. Everything else is a
  // hidden screen reached from Home Quick Links or the notification bell.
  return (
    <Tabs screenOptions={screenOpts}>
      <Tabs.Screen
        name="dashboard"
        options={{
          headerShown: false,
          title: 'Fleet Overview',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name="home" color={color} size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarLabel: 'Explore',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name="explore" color={color} size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarLabel: 'Messages',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name="messages" color={color} size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name="settings" color={color} size={size} focused={focused} />,
        }}
      />
      {/* Hidden screens — reached via Home Quick Links / bell, not the tab bar */}
      <Tabs.Screen name="vehicles"      options={{ href: null, title: 'My Vehicles' }} />
      <Tabs.Screen name="drivers"       options={{ href: null, title: 'My Drivers' }} />
      <Tabs.Screen name="payments"      options={{ href: null, title: 'Payments' }} />
      <Tabs.Screen name="notifications" options={{ href: null, title: 'Notifications' }} />
      <Tabs.Screen name="contracts"     options={{ href: null, title: 'Contracts & Codes' }} />
      <Tabs.Screen name="maintenance"   options={{ href: null, title: 'Maintenance' }} />
      <Tabs.Screen name="disputes"      options={{ href: null, title: 'Disputes' }} />
      <Tabs.Screen name="tracking"      options={{ href: null, title: 'Tracking' }} />
    </Tabs>
  );
}
