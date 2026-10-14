/** Tab icons — focused = filled emerald icon inside a soft pill. */
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ICONS = {
  home: { active: 'home', inactive: 'home-outline' },
  vehicle: { active: 'car', inactive: 'car-outline' },
  vehicles: { active: 'car', inactive: 'car-outline' },
  payments: { active: 'card', inactive: 'card-outline' },
  contract: { active: 'document-text', inactive: 'document-text-outline' },
  contracts: { active: 'document-text', inactive: 'document-text-outline' },
  notifications: { active: 'notifications', inactive: 'notifications-outline' },
  profile: { active: 'person', inactive: 'person-outline' },
  drivers: { active: 'people', inactive: 'people-outline' },
  earnings: { active: 'wallet', inactive: 'wallet-outline' },
  documents: { active: 'folder', inactive: 'folder-outline' },
  disputes: { active: 'scale', inactive: 'scale-outline' },
  maintenance: { active: 'build', inactive: 'build-outline' },
  incidents: { active: 'warning', inactive: 'warning-outline' },
  settings: { active: 'settings', inactive: 'settings-outline' },
  reports: { active: 'bar-chart', inactive: 'bar-chart-outline' },
  fleet: { active: 'car-sport', inactive: 'car-sport-outline' },
  tracking: { active: 'navigate', inactive: 'navigate-outline' },
};

export function TabIcon({ name, color, size = 23, focused = false }) {
  const entry = ICONS[name] || { active: 'square', inactive: 'square-outline' };
  return (
    <View style={[styles.wrap, focused && styles.wrapFocused]}>
      <Ionicons name={focused ? entry.active : entry.inactive} size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 52, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  wrapFocused: { backgroundColor: '#D1FAE5' },
});

export default TabIcon;
