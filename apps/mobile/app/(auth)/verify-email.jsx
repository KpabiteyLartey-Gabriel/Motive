import { View, Text, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import SecureStore from '../../lib/storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usersApi } from '../../lib/api';
import { postAuthRoute } from '../../lib/postAuth';
import { useTheme } from '../../lib/theme';
import { Field, PrimaryButton } from '../../components/ui';
import BrandLogo from '../../components/BrandLogo';

// Main Onboarding step 2: confirm the email with the 6-digit code sent at
// signup. Success lands the plain User in the User portal.
export default function VerifyEmailScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [user, setUser] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    SecureStore.getItemAsync('user').then((raw) => {
      if (!raw) { router.replace('/(auth)/login'); return; }
      try {
        const stored = JSON.parse(raw);
        if (!stored.email || stored.emailVerifiedAt) { router.replace(postAuthRoute(stored)); return; }
        setUser(stored);
      } catch { router.replace('/(auth)/login'); }
    });
  }, [router]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const resend = async () => {
    setBusy('send'); setError('');
    try {
      const res = await usersApi.sendEmailCode();
      const data = res.data?.data || res.data;
      if (data?.alreadyVerified) { router.replace(postAuthRoute(user)); return; }
      setNotice('A new code has been sent to your email.');
      setCooldown(60);
    } catch (e) {
      const msg = e.response?.data?.message || 'Could not send the code. Please try again.';
      setError(Array.isArray(msg) ? msg.join(' ') : msg);
    } finally { setBusy(''); }
  };

  const verify = async () => {
    setBusy('verify'); setError(''); setNotice('');
    try {
      await usersApi.confirmEmailCode(code.trim());
      const stored = JSON.parse((await SecureStore.getItemAsync('user')) || '{}');
      const updated = { ...stored, emailVerifiedAt: new Date().toISOString() };
      await SecureStore.setItemAsync('user', JSON.stringify(updated));
      router.replace(postAuthRoute(updated));
    } catch (e) {
      const msg = e.response?.data?.message || 'That code did not work. Please try again.';
      setError(Array.isArray(msg) ? msg.join(' ') : msg);
    } finally { setBusy(''); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <BrandLogo size={52} />
          <Text style={[s.title, { color: colors.textPrimary }]}>Verify your email</Text>
          <Text style={[s.subtitle, { color: colors.textSecondary }]}>
            We sent a 6-digit code to {user?.email || 'your email'}. It expires in 5 minutes.
          </Text>

          {error ? <View style={s.alert} accessibilityRole="alert"><Text style={s.alertText}>{error}</Text></View> : null}
          {notice ? <View style={s.notice} accessibilityRole="status"><Text style={s.noticeText}>{notice}</Text></View> : null}

          <View style={{ gap: 16 }}>
            <Field
              label="One-time code"
              placeholder="123456"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
            />
            <PrimaryButton title="Verify" onPress={verify} loading={busy === 'verify'} disabled={code.length !== 6} />
            <Text style={[s.help, { color: colors.textMuted }]}>
              Didn&apos;t get it?{' '}
              <Text
                onPress={busy === 'send' || cooldown > 0 ? undefined : resend}
                style={{ color: colors.brand, fontWeight: '700' }}
              >
                {cooldown > 0 ? `Resend code (${cooldown}s)` : busy === 'send' ? 'Sending…' : 'Resend code'}
              </Text>
            </Text>
            <Text style={[s.help, { color: colors.textMuted }]}>Check your spam folder if it is not in your inbox.</Text>
          </View>

          <TouchableOpacity onPress={() => router.replace('/(auth)/login')} hitSlop={8} style={s.footer} accessibilityRole="button">
            <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 14.5 }}>Back to sign in</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 20, paddingTop: 32, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: 15.5, lineHeight: 22, marginTop: 6, marginBottom: 22 },
  alert: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 18 },
  alertText: { color: '#B91C1C', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  notice: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 18 },
  noticeText: { color: '#065F46', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  help: { textAlign: 'center', fontSize: 13.5 },
  footer: { alignItems: 'center', marginTop: 24 },
});
