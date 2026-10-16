import { View, Text, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import SecureStore from '../../lib/storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authApi } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import { Field, PrimaryButton } from '../../components/ui';

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);

  const handleSubmit = async () => {
    setTouched(true);
    if (!form.identifier.trim() || !form.password) {
      setError('Enter your email or phone number and your password to continue.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const response = await authApi.login(form);
      const { accessToken, refreshToken, user } = response.data.data;
      await SecureStore.setItemAsync('accessToken', accessToken);
      await SecureStore.setItemAsync('refreshToken', refreshToken);
      await SecureStore.setItemAsync('user', JSON.stringify(user));
      const roleRoutes = {
        DRIVER: '/(driver)/dashboard', OWNER: '/(owner)/dashboard',
        COMPANY_ADMIN: '/(driver)/dashboard', FLEET_MANAGER: '/(driver)/dashboard',
        ADMIN: '/(driver)/dashboard', SUPER_ADMIN: '/(driver)/dashboard',
      };
      router.replace(roleRoutes[user.primaryRole] || '/(driver)/dashboard');
    } catch (e) {
      if (!e.response) {
        // No answer at all — the backend could not be reached from this phone
        setError('Cannot reach the +Motive server. Make sure the backend is running on the computer, and that this phone and the computer are on the same Wi-Fi, then try again.');
      } else {
        const message = e.response?.data?.message || 'Sign-in failed. Check your details and try again.';
        setError(Array.isArray(message) ? message.join(' ') : message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[s.logo, { backgroundColor: colors.brand }]}><Text style={s.logoText}>+</Text></View>
          <Text style={[s.title, { color: colors.textPrimary }]}>Welcome back</Text>
          <Text style={[s.subtitle, { color: colors.textSecondary }]}>Sign in to see your contracts, payments and vehicles.</Text>

          {error ? (
            <View style={[s.alert, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]} accessibilityRole="alert">
              <Text style={{ color: '#B91C1C', fontSize: 14, lineHeight: 20, fontWeight: '600' }}>{error}</Text>
            </View>
          ) : null}

          <View style={{ gap: 18, marginTop: 8 }}>
            <Field
              label="Email or phone number"
              hint="Use the email or Ghana number you registered with."
              error={touched && !form.identifier.trim() ? 'This field is required.' : ''}
              placeholder="you@example.com or +233 20 123 4567"
              autoCapitalize="none" keyboardType="email-address" autoComplete="username"
              value={form.identifier}
              onChangeText={(v) => { setForm((p) => ({ ...p, identifier: v })); setError(''); }}
            />
            <View>
              <View style={s.labelRow}>
                <Text style={[s.label, { color: colors.textPrimary }]}>Password</Text>
                <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={10} accessibilityRole="button">
                  <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 13 }}>{showPassword ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
              <Field
                placeholder="Enter your password"
                secureTextEntry={!showPassword} autoComplete="current-password"
                error={touched && !form.password ? 'This field is required.' : ''}
                value={form.password}
                onChangeText={(v) => { setForm((p) => ({ ...p, password: v })); setError(''); }}
              />
            </View>
            <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} hitSlop={8} style={{ alignSelf: 'flex-end' }} accessibilityRole="button">
              <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 13.5 }}>Forgot password?</Text>
            </TouchableOpacity>
            <PrimaryButton title="Sign in" onPress={handleSubmit} loading={loading} />
            <Text style={[s.secure, { color: colors.textMuted }]}>Protected sign-in — never share your password.</Text>
          </View>

          <View style={s.footer}>
            <Text style={{ color: colors.textSecondary, fontSize: 14.5 }}>New to +Motive? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')} hitSlop={8}>
              <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 14.5 }}>Create free account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 20, paddingTop: 36, paddingBottom: 40 },
  logo: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  logoText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 15.5, lineHeight: 22, marginTop: 6, marginBottom: 22 },
  alert: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 18 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  label: { fontSize: 14, fontWeight: '600' },
  secure: { textAlign: 'center', fontSize: 13 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 28, flexWrap: 'wrap' },
});
