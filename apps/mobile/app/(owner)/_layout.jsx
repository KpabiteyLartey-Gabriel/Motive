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
    tabBarStyle: { backgroundColor: colors.headerBg, borderTopColor: colors.border, borderTopWidth: 1, height: 68, paddingTop: 6, paddingBottom: 8 },
    tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 2 },
    headerStyle:        { backgroundColor: colors.surface },
    headerTintColor: colors.brand,
    headerTitleStyle:   { fontWeight: '700', color: colors.textPrimary },
    headerShadowVisible: false,
  };

  return (
    <Tabs screenOptions={screenOpts}>
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Fleet Overview',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name="home" color={color} size={size} focused={focused} />,
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
      <Tabs.Screen
        name="drivers"
        options={{
          title: 'My Drivers',
          tabBarLabel: 'Drivers',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name="drivers" color={color} size={size} focused={focused} />,
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
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarLabel: 'Alerts',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name="notifications" color={color} size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name="settings" color={color} size={size} focused={focused} />,
        }}
      />
      {/* Hidden screens — reachable from other tabs, not shown in tab bar */}
      <Tabs.Screen name="maintenance"   options={{ href: null, title: 'Maintenance' }} />
      <Tabs.Screen name="disputes"      options={{ href: null, title: 'Disputes' }} />
      <Tabs.Screen name="tracking"      options={{ href: null, title: 'Tracking' }} />
    </Tabs>
  );
}



