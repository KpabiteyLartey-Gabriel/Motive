import { View, Text, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authApi } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import { Field, PrimaryButton } from '../../components/ui';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [touched, setTouched] = useState(false);

  const handleSubmit = async () => {
    setTouched(true);
    if (!identifier.trim()) { setError('Enter your email or phone number.'); return; }
    setError('');
    setLoading(true);
    try {
      await authApi.forgotPassword(identifier.trim());
      setSent(true);
    } catch (e) {
      const message = e.response?.data?.message || 'Something went wrong. Please try again.';
      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[s.logo, { backgroundColor: colors.brand }]}><Text style={s.logoText}>+</Text></View>
          <Text style={[s.title, { color: colors.textPrimary }]}>Forgot password?</Text>
          <Text style={[s.subtitle, { color: colors.textSecondary }]}>Enter the email or phone number on your account. We will send a reset link by email and SMS — it expires in 60 minutes.</Text>

          {sent ? (
            <View style={[s.success, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]} accessibilityRole="alert">
              <Text style={{ color: '#065F46', fontWeight: '800', fontSize: 15, marginBottom: 6 }}>Check your email and phone</Text>
              <Text style={{ color: '#065F46', fontSize: 14, lineHeight: 20 }}>If an account exists for {identifier}, we have sent a password reset link. Open it, then paste the code/token here if asked, or set your new password in the app.</Text>
              <TouchableOpacity onPress={() => router.push({ pathname: '/(auth)/reset-password', params: { identifier } })} style={{ marginTop: 14 }}>
                <Text style={{ color: colors.brand, fontWeight: '800', fontSize: 14.5 }}>I have my reset link/token →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 18 }}>
              {error ? (
                <View style={[s.alert, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]} accessibilityRole="alert">
                  <Text style={{ color: '#B91C1C', fontSize: 14, lineHeight: 20, fontWeight: '600' }}>{error}</Text>
                </View>
              ) : null}
              <Field
                label="Email or phone number"
                hint="Use the email or Ghana number you registered with."
                error={touched && !identifier.trim() ? 'This field is required.' : ''}
                placeholder="you@example.com or +233 20 123 4567"
                autoCapitalize="none" keyboardType="email-address" autoComplete="username"
                value={identifier}
                onChangeText={(v) => { setIdentifier(v); setError(''); }}
              />
              <PrimaryButton title="Send reset link" onPress={handleSubmit} loading={loading} />
            </View>
          )}

          <View style={s.footer}>
            <Text style={{ color: colors.textSecondary, fontSize: 14.5 }}>Remembered it? </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')} hitSlop={8}>
              <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 14.5 }}>Back to sign in</Text>
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
  success: { borderWidth: 1, borderRadius: 12, padding: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 28, flexWrap: 'wrap' },
});
