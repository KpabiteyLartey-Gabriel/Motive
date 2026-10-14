import { Tabs } from 'expo-router';
import { useTheme } from '../../lib/theme';
import { TabIcon } from '../../components/TabIcon';

export default function OwnerLayout() {
  const { colors } = useTheme();

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
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name="profile" color={color} size={size} focused={focused} />,
        }}
      />
      {/* Hidden screens â€” accessible via push, not shown in tab bar */}
      <Tabs.Screen name="notifications" options={{ href: null, title: 'Notifications' }} />
      <Tabs.Screen name="maintenance"   options={{ href: null, title: 'Maintenance' }} />
      <Tabs.Screen name="disputes"      options={{ href: null, title: 'Disputes' }} />
      <Tabs.Screen
        name="tracking"
        options={{
          title: 'Tracking',
          tabBarLabel: 'Tracking',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name="tracking" color={color} size={size} focused={focused} />,
        }}
      />
    </Tabs>
  );
}



