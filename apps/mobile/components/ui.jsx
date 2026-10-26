/** Shared mobile primitives — 48px+ touch targets, clear hierarchy, emerald fintech. */
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, radius } from '../lib/theme';

export function PrimaryButton({ title, onPress, loading, disabled, style }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[s.btn, { backgroundColor: colors.ctaBg, opacity: disabled || loading ? 0.6 : 1 }, style]}
      onPress={onPress} disabled={disabled || loading} activeOpacity={0.85}
      accessibilityRole="button" accessibilityLabel={title}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{title}</Text>}
    </TouchableOpacity>
  );
}

export function Card({ children, style }) {
  const { colors } = useTheme();
  return <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}>{children}</View>;
}

export function Field({ label, hint, error, ...props }) {
  const { colors } = useTheme();
  return (
    <View style={s.field}>
      {label ? <Text style={[s.label, { color: colors.textPrimary }]}>{label}</Text> : null}
      <TextInput
        style={[s.input, { backgroundColor: colors.inputBg, borderColor: error ? colors.danger : colors.inputBorder, color: colors.textPrimary }]}
        placeholderTextColor={colors.textMuted}
        {...props}
      />
      {error ? <Text style={[s.hint, { color: colors.danger }]}>{error}</Text> : hint ? <Text style={[s.hint, { color: colors.textSecondary }]}>{hint}</Text> : null}
    </View>
  );
}

export function Badge({ label, tone = 'neutral' }) {
  const { colors, isDark } = useTheme();
  const tones = {
    success: { bg: isDark ? '#0B2E21' : '#ECFDF5', fg: isDark ? '#6EE7B7' : '#065F46' },
    warning: { bg: isDark ? '#3A2A0B' : '#FFFBEB', fg: isDark ? '#FCD34D' : '#92400E' },
    danger: { bg: isDark ? '#3A1414' : '#FEF2F2', fg: isDark ? '#FCA5A5' : '#B91C1C' },
    info: { bg: isDark ? '#0B2B2B' : '#F0FDFD', fg: isDark ? '#5EEAD4' : '#0F766E' },
    neutral: { bg: colors.elevated, fg: colors.textSecondary },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <View style={[s.badge, { backgroundColor: t.bg }]}>
      <View style={[s.badgeDot, { backgroundColor: t.fg }]} />
      <Text style={[s.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

export function statusTone(status = '') {
  if (['ACTIVE', 'SUCCESSFUL', 'AVAILABLE', 'VERIFIED', 'COMPLETED', 'RESOLVED'].includes(status)) return 'success';
  if (['FAILED', 'SUSPENDED', 'ESCALATED', 'IN_DISPUTE'].includes(status)) return 'danger';
  if (['PROCESSING', 'ASSIGNED', 'MEDIATION'].includes(status)) return 'info';
  return 'warning';
}

export function ProgressBar({ value = 0, height = 10 }) {
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: colors.elevated, overflow: 'hidden' }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}>
      <View style={{ width: `${pct}%`, height: '100%', borderRadius: height / 2, backgroundColor: colors.brand }} />
    </View>
  );
}

export function EmptyState({ icon = 'document-text-outline', title, description, actionLabel, onAction }) {
  const { colors } = useTheme();
  return (
    <View style={[s.empty, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={[s.emptyIcon, { backgroundColor: colors.brandSoft }]}>
        <Ionicons name={icon} size={24} color={colors.brandText} />
      </View>
      <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>{title}</Text>
      {description ? <Text style={[s.emptyText, { color: colors.textSecondary }]}>{description}</Text> : null}
      {actionLabel ? <PrimaryButton title={actionLabel} onPress={onAction} style={{ marginTop: 16, alignSelf: 'stretch' }} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  btn: { minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 18 },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600' },
  input: { minHeight: 52, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, fontSize: 16 },
  hint: { fontSize: 13, lineHeight: 18 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  badgeDot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.lg, padding: 24, alignItems: 'center' },
  emptyIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6 },
});
