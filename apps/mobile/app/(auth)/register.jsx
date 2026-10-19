import { View, Text, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import SecureStore from '../../lib/storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { authApi } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import { Field, PrimaryButton } from '../../components/ui';
import BrandLogo from '../../components/BrandLogo';

const ROLES = [
  { value: 'DRIVER', label: 'Driver', description: 'I drive or want to drive a vehicle', icon: 'car-outline' },
  { value: 'OWNER', label: 'Vehicle Owner', description: 'I own vehicles and want to manage them', icon: 'key-outline' },
  { value: 'COMPANY_ADMIN', label: 'Transport Company', description: 'I manage a transport or fleet company', icon: 'business-outline' },
];

const ERRORS = {
  firstName: 'First name is required.',
  lastName: 'Last name is required.',
  contact: 'Add an email or phone number so we can reach you.',
  password: 'Use at least 8 characters.',
  confirm: 'Passwords do not match — check and try again.',
};

export default function RegisterScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '', role: 'DRIVER' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const set = (key, val) => { setForm((p) => ({ ...p, [key]: val })); setFieldErrors((p) => ({ ...p, [key]: '' })); setError(''); };

  const validate = () => {
    const e = {};
    if (!form.firstName.trim()) e.firstName = ERRORS.firstName;
    if (!form.lastName.trim()) e.lastName = ERRORS.lastName;
    if (!form.email.trim() && !form.phone.trim()) e.email = ERRORS.contact;
    if (form.password.length < 8) e.password = ERRORS.password;
    if (form.password !== form.confirmPassword) e.confirmPassword = ERRORS.confirm;
    setFieldErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const payload = { firstName: form.firstName.trim(), lastName: form.lastName.trim(), password: form.password, role: form.role };
      if (form.email.trim()) payload.email = form.email.trim();
      if (form.phone.trim()) payload.phone = form.phone.trim();
      const response = await authApi.register(payload);
      const { accessToken, refreshToken, user } = response.data.data;
      await SecureStore.setItemAsync('accessToken', accessToken);
      await SecureStore.setItemAsync('refreshToken', refreshToken);
      await SecureStore.setItemAsync('user', JSON.stringify(user));
      const roleRoutes = { DRIVER: '/(driver)/dashboard', OWNER: '/(owner)/dashboard', COMPANY_ADMIN: '/(driver)/dashboard' };
      router.replace(roleRoutes[user.primaryRole] || '/(driver)/dashboard');
    } catch (e) {
      // If the connection dropped after the account was saved, signing in
      // with the same details succeeds — treat that as a completed signup
      // instead of wrongly reporting failure.
      if (!e.response && (form.email.trim() || form.phone.trim())) {
        try {
          const loginRes = await authApi.login({ identifier: form.email.trim() || form.phone.trim(), password: form.password });
          const { accessToken, refreshToken, user } = loginRes.data.data;
          await SecureStore.setItemAsync('accessToken', accessToken);
          await SecureStore.setItemAsync('refreshToken', refreshToken);
          await SecureStore.setItemAsync('user', JSON.stringify(user));
          const roleRoutes = { DRIVER: '/(driver)/dashboard', OWNER: '/(owner)/dashboard', COMPANY_ADMIN: '/(driver)/dashboard' };
          router.replace(roleRoutes[user.primaryRole] || '/(driver)/dashboard');
          return;
        } catch {}
      }
      const message = e.response?.data?.message || 'Registration failed. Please try again.';
      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <BrandLogo size={52} />
          <Text style={[s.title, { color: colors.textPrimary }]}>Create your account</Text>
          <Text style={[s.subtitle, { color: colors.textSecondary }]}>Free to start — it only takes a minute.</Text>

          {error ? <View style={s.alert} accessibilityRole="alert"><Text style={s.alertText}>{error}</Text></View> : null}

          <Text style={[s.label, { color: colors.textPrimary }]}>I am joining as…</Text>
          <View style={{ gap: 10, marginBottom: 20 }}>
            {ROLES.map((r) => {
              const active = form.role === r.value;
              return (
                <TouchableOpacity key={r.value} onPress={() => set('role', r.value)} activeOpacity={0.85}
                  accessibilityRole="radio" accessibilityState={{ selected: active }}
                  style={[s.role, { borderColor: active ? colors.brand : colors.border, backgroundColor: active ? colors.brandSoft : colors.card }]}>
                  <View style={[s.roleIcon, { backgroundColor: active ? colors.brand : colors.elevated }]}>
                    <Ionicons name={r.icon} size={20} color={active ? '#fff' : colors.brandText} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.roleLabel, { color: colors.textPrimary }]}>{r.label}</Text>
                    <Text style={[s.roleDesc, { color: colors.textSecondary }]}>{r.description}</Text>
                  </View>
                  {active && <Ionicons name="checkmark-circle" size={22} color={colors.brand} />}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}><Field label="First name" placeholder="Kofi" autoComplete="given-name" value={form.firstName} onChangeText={(v) => set('firstName', v)} error={fieldErrors.firstName} /></View>
              <View style={{ flex: 1 }}><Field label="Last name" placeholder="Mensah" autoComplete="family-name" value={form.lastName} onChangeText={(v) => set('lastName', v)} error={fieldErrors.lastName} /></View>
            </View>
            <Field label="Email address" placeholder="kofi@example.com" hint="Email or phone is required — both is best for recovery." error={fieldErrors.email} autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={form.email} onChangeText={(v) => set('email', v)} />
            <Field label="Phone number (MoMo helps)" placeholder="+233 20 123 4567" keyboardType="phone-pad" autoComplete="tel" value={form.phone} onChangeText={(v) => set('phone', v)} />
            <View>
              <View style={s.labelRow}>
                <Text style={[s.label, { color: colors.textPrimary, marginBottom: 0 }]}>Password</Text>
                <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={10}><Text style={{ color: colors.brand, fontWeight: '700', fontSize: 13 }}>{showPassword ? 'Hide' : 'Show'}</Text></TouchableOpacity>
              </View>
              <Field placeholder="At least 8 characters" hint="8+ characters — mix letters and numbers." error={fieldErrors.password} secureTextEntry={!showPassword} autoComplete="new-password" value={form.password} onChangeText={(v) => set('password', v)} />
            </View>
            <Field label="Confirm password" placeholder="Repeat your password" error={fieldErrors.confirmPassword} secureTextEntry={!showPassword} autoComplete="new-password" value={form.confirmPassword} onChangeText={(v) => set('confirmPassword', v)} />
            <PrimaryButton title="Create free account" onPress={handleSubmit} loading={loading} />
            <Text style={[s.terms, { color: colors.textMuted }]}>By creating an account you agree to +Motive&apos;s Terms of Service and Privacy Policy.</Text>
          </View>

          <View style={s.footer}>
            <Text style={{ color: colors.textSecondary, fontSize: 14.5 }}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')} hitSlop={8}>
              <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 14.5 }}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 20, paddingTop: 32, paddingBottom: 40 },
  logo: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  logoText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: 15.5, marginTop: 6, marginBottom: 22 },
  alert: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 18 },
  alertText: { color: '#B91C1C', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 10 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  role: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 16, padding: 14, minHeight: 64 },
  roleIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  roleLabel: { fontSize: 15, fontWeight: '700' },
  roleDesc: { fontSize: 13, marginTop: 2, lineHeight: 17 },
  terms: { textAlign: 'center', fontSize: 12.5, lineHeight: 17 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' },
});
