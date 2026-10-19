import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemePreferenceValue, setThemePreference } from '../lib/theme';

const OPTIONS = [
  { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { key: 'light', label: 'Light', icon: 'sunny-outline' },
  { key: 'dark', label: 'Dark', icon: 'moon-outline' },
];

export function AppearanceToggle() {
  const { colors } = useTheme();
  const preference = useThemePreferenceValue();

  return (
    <View>
      <View style={[s.row, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
        {OPTIONS.map((option) => {
          const active = preference === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              onPress={() => setThemePreference(option.key)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[s.option, active && { backgroundColor: colors.card, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 }]}
            >
              <Ionicons name={option.icon} size={17} color={active ? colors.brandText : colors.textMuted} />
              <Text style={[s.label, { color: active ? colors.textPrimary : colors.textMuted }]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[s.hint, { color: colors.textMuted }]}>
        {preference === 'system' ? 'Following your phone’s light/dark setting.' : `Always using ${preference} mode in +Motive.`}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 4, gap: 4 },
  option: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  label: { fontSize: 13.5, fontWeight: '700' },
  hint: { fontSize: 12.5, marginTop: 8 },
});
