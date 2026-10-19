import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { useTheme } from '../../lib/theme';
import { TabIcon } from '../../components/TabIcon';
import { registerPushToken } from '../../lib/push';

export default function DriverLayout() {
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

  return (
    <Tabs screenOptions={screenOpts}>
      <Tabs.Screen
        name="dashboard"
        options={{
          headerShown: false,
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name="home" color={color} size={size} focused={focused} />,
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
        name="contract"
        options={{
          title: 'My Contract',
          tabBarLabel: 'Contract',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name="contract" color={color} size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="vehicle"
        options={{
          title: 'My Vehicle',
          tabBarLabel: 'Vehicle',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name="vehicle" color={color} size={size} focused={focused} />,
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
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name="profile" color={color} size={size} focused={focused} />,
        }}
      />
      {/* Hidden screens â€” accessible via push, not shown in tab bar */}
      <Tabs.Screen name="maintenance" options={{ href: null, title: 'Maintenance' }} />
      <Tabs.Screen name="disputes"    options={{ href: null, title: 'Disputes' }} />
      <Tabs.Screen name="incidents"   options={{ href: null, title: 'Incidents' }} />
      {/* No tracking for drivers — live vehicle tracking is owner-only. */}
    </Tabs>
  );
}




