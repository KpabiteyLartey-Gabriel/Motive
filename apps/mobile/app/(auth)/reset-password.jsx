import { View, Text, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authApi } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import { Field, PrimaryButton } from '../../components/ui';

// The reset email/SMS link opens the web reset page. In the app, users paste
// the token from that link here (the long code after ?token= in the link).
export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const [token, setToken] = useState(typeof params.token === 'string' ? params.token : '');
  const [form, setForm] = useState({ newPassword: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const extractToken = (value) => {
    const text = (value || '').trim();
    const match = text.match(/[?&]token=([a-f0-9]+)/i);
    return match ? match[1] : text;
  };

  const handleSubmit = async () => {
    const cleanToken = extractToken(token);
    if (!cleanToken) { setError('Paste the reset link or token we sent you.'); return; }
    if (form.newPassword.length < 8) { setError('Your new password must be at least 8 characters.'); return; }
    if (form.newPassword !== form.confirm) { setError('The two passwords do not match.'); return; }
    setError('');
    setLoading(true);
    try {
      await authApi.resetPassword(cleanToken, form.newPassword);
      setDone(true);
    } catch (e) {
      const message = e.response?.data?.message || 'This reset link is invalid or has expired. Request a new one.';
      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally { setLoading(false); }
  };

  if (done) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flex: 1, padding: 20, paddingTop: 60 }}>
          <View style={[s.logo, { backgroundColor: colors.brand }]}><Text style={s.logoText}>+</Text></View>
          <Text style={[s.title, { color: colors.textPrimary }]}>Password changed</Text>
          <Text style={[s.subtitle, { color: colors.textSecondary }]}>Your password has been reset and all other sessions were signed out. We also sent a confirmation by email and SMS.</Text>
          <PrimaryButton title="Sign in with new password" onPress={() => router.replace('/(auth)/login')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[s.logo, { backgroundColor: colors.brand }]}><Text style={s.logoText}>+</Text></View>
          <Text style={[s.title, { color: colors.textPrimary }]}>Set new password</Text>
          <Text style={[s.subtitle, { color: colors.textSecondary }]}>Paste the reset link (or just the token) from your email/SMS, then choose a new password.</Text>

          <View style={{ gap: 18 }}>
            {error ? (
              <View style={[s.alert, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]} accessibilityRole="alert">
                <Text style={{ color: '#B91C1C', fontSize: 14, lineHeight: 20, fontWeight: '600' }}>{error}</Text>
              </View>
            ) : null}
            <Field
              label="Reset link or token"
              hint="Copy the whole link from your email/SMS and paste it here."
              placeholder="Paste reset link here"
              autoCapitalize="none" autoCorrect={false}
              value={token}
              onChangeText={(v) => { setToken(v); setError(''); }}
            />
            <View>
              <View style={s.labelRow}>
                <Text style={[s.label, { color: colors.textPrimary }]}>New password</Text>
                <TouchableOpacity onPress={() => setShow((v) => !v)} hitSlop={10} accessibilityRole="button">
                  <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 13 }}>{show ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
              <Field placeholder="At least 8 characters" secureTextEntry={!show} autoComplete="new-password"
                value={form.newPassword} onChangeText={(v) => { setForm((p) => ({ ...p, newPassword: v })); setError(''); }} />
            </View>
            <Field label="Confirm new password" placeholder="Repeat the new password" secureTextEntry={!show} autoComplete="new-password"
              value={form.confirm} onChangeText={(v) => { setForm((p) => ({ ...p, confirm: v })); setError(''); }} />
            <PrimaryButton title="Reset password" onPress={handleSubmit} loading={loading} />
          </View>

          <View style={s.footer}>
            <Text style={{ color: colors.textSecondary, fontSize: 14.5 }}>Link expired? </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/forgot-password')} hitSlop={8}>
              <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 14.5 }}>Request a new one</Text>
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
  alert: { borderWidth: 1, borderRadius: 12, padding: 14 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  label: { fontSize: 14, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 28, flexWrap: 'wrap' },
});
