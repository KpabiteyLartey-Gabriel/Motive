import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import SecureStore from '../../lib/storage';
import { useTheme, palette } from '../../lib/theme';
import { useAuth } from '../../lib/useAuth';
import { accountsApi } from '../../lib/api';
import { Field, PrimaryButton } from '../../components/ui';

const LABEL = { DRIVER: 'Driver', OWNER: 'Owner' };
const DASHBOARD = { DRIVER: '/(driver)/dashboard', OWNER: '/(owner)/dashboard' };

// Paid Driver/Owner account creation:
// 1) confirm interest — one code to phone, email and in-app
// 2) pay the admin-set creation charge
// 3) account created on confirmed payment; email + in-app message
//    explain how to open the new dashboard.
export default function AddAccountScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, logout } = useAuth();
  const params = useLocalSearchParams();
  const kind = String(params.kind || 'DRIVER').toUpperCase() === 'OWNER' ? 'OWNER' : 'DRIVER';
  const label = LABEL[kind];

  const [step, setStep] = useState('send');
  const [order, setOrder] = useState(null);
  const [code, setCode] = useState('');
  const [payerPhone, setPayerPhone] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => { if (user?.phone) setPayerPhone(user.phone); }, [user]);

  useEffect(() => {
    let live = true;
    accountsApi.creationStatus(kind)
      .then((res) => {
        if (!live) return;
        const data = res.data?.data || res.data;
        if (data?.status === 'AWAITING_PAYMENT') { setOrder(data); setStep('pay'); }
        else if (data?.status === 'COMPLETED') { setOrder(data); setStep('done'); }
        else if (data?.amount) setOrder(data);
      })
      .catch(() => {});
    accountsApi.creationCharges()
      .then((res) => {
        if (!live) return;
        const charges = (res.data?.data || res.data)?.charges || [];
        const mine = charges.find((c) => c.kind === kind);
        if (mine) setOrder((o) => o || { amount: mine.amountGhs, currency: 'GHS' });
      })
      .catch(() => {});
    return () => { live = false; };
  }, [kind]);

  // Poll while on the pay step so a processing payment lands by itself.
  useEffect(() => {
    if (step !== 'pay') return undefined;
    let tries = 0;
    const t = setInterval(async () => {
      tries += 1;
      if (tries > 20) { clearInterval(t); return; }
      try {
        const res = await accountsApi.creationStatus(kind);
        const data = res.data?.data || res.data;
        if (data?.status === 'COMPLETED') { clearInterval(t); setOrder(data); setStep('done'); }
      } catch {}
    }, 4000);
    return () => clearInterval(t);
  }, [step, kind]);

  const fail = (e, fallback) => {
    const msg = e.response?.data?.message || fallback;
    setError(Array.isArray(msg) ? msg.join(' ') : msg);
  };

  const start = async () => {
    setBusy('start'); setError(''); setNotice('');
    try {
      const res = await accountsApi.startCreation(kind);
      const data = res.data?.data || res.data;
      setOrder(data);
      setStep('confirm');
      setNotice(`Your code is on its way to ${(data.sentTo || []).join(', ') || 'your phone, email and notifications'}. It expires in 10 minutes.`);
    } catch (e) { fail(e, 'Could not send your code. Please try again.'); }
    setBusy('');
  };

  const confirm = async () => {
    setBusy('confirm'); setError(''); setNotice('');
    try {
      const res = await accountsApi.confirmCreation(kind, code.trim());
      setOrder(res.data?.data || res.data);
      setStep('pay');
    } catch (e) { fail(e, 'That code did not work. Please try again.'); }
    setBusy('');
  };

  const pay = async () => {
    setBusy('pay'); setError(''); setNotice('');
    try {
      const res = await accountsApi.payCreation(kind, { payerPhone: payerPhone.trim(), paymentMethod: 'MOMO' });
      const data = res.data?.data || res.data;
      setOrder(data);
      if (data?.status === 'COMPLETED') setStep('done');
      else if (data?.paymentStatus === 'FAILED') setError('The payment failed. Check the number and try again.');
      else setNotice('Payment is processing. Approve the prompt on your phone if you get one — this screen updates by itself when it lands.');
    } catch (e) { fail(e, 'Could not start the payment. Please try again.'); }
    setBusy('');
  };

  const openDashboard = async () => {
    // Refresh the stored user so the new role is on this device too.
    try {
      const res = await accountsApi.me();
      const fresh = (res.data?.data || res.data)?.user;
      if (fresh) {
        const stored = JSON.parse((await SecureStore.getItemAsync('user')) || '{}');
        await SecureStore.setItemAsync('user', JSON.stringify({ ...stored, ...fresh }));
      }
    } catch {}
    router.replace(DASHBOARD[kind]);
  };

  const amount = order?.amount != null ? `GHS ${Number(order.amount).toLocaleString('en-GH')}` : 'the account creation charge';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={[s.title, { color: colors.textPrimary }]}>Add a {label} account</Text>
        <View style={s.steps}>
          {[['send', '1. Confirm'], ['pay', '2. Pay'], ['done', '3. Ready']].map(([key, text]) => {
            const doneState = (key === 'send' && step !== 'send') || (key === 'pay' && step === 'done');
            const current = key === step || (key === 'send' && step === 'confirm');
            return (
              <View key={key} style={[s.stepPill, { backgroundColor: doneState ? '#059669' : current ? palette.brand : colors.elevated }]}>
                <Text style={[s.stepText, { color: doneState || current ? '#fff' : colors.textSecondary }]}>{text}</Text>
              </View>
            );
          })}
        </View>

        {error ? <View style={s.alert} accessibilityRole="alert"><Text style={s.alertText}>{error}</Text></View> : null}
        {notice ? <View style={s.notice} accessibilityRole="status"><Text style={s.noticeText}>{notice}</Text></View> : null}

        {step === 'send' && (
          <View style={{ gap: 16 }}>
            <Text style={[s.body, { color: colors.textSecondary }]}>
              Creating a {label} account costs a one-time <Text style={{ fontWeight: '800', color: colors.textPrimary }}>{amount}</Text>.
              First we confirm it is really you asking: we send one code to your phone, your email and your in-app notifications.
            </Text>
            <PrimaryButton title="Send my code" onPress={start} loading={busy === 'start'} />
            <TouchableOpacity onPress={() => router.back()} style={s.linkBtn} accessibilityRole="button">
              <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 14.5 }}>Not now</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'confirm' && (
          <View style={{ gap: 16 }}>
            <Field label="6-digit code" placeholder="123456" keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, ''))} />
            <PrimaryButton title="Confirm" onPress={confirm} loading={busy === 'confirm'} disabled={code.length !== 6} />
            <TouchableOpacity onPress={start} disabled={busy === 'start'} style={s.linkBtn} accessibilityRole="button">
              <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 14.5 }}>{busy === 'start' ? 'Sending…' : 'Send a new code'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'pay' && (
          <View style={{ gap: 16 }}>
            <Text style={[s.body, { color: colors.textSecondary }]}>
              Interest confirmed. Pay the one-time <Text style={{ fontWeight: '800', color: colors.textPrimary }}>{amount}</Text> {label} account creation charge.
              Your {label} account is created the moment the payment is confirmed — not before.
            </Text>
            <Field label="Mobile money number" placeholder="024 400 0000" keyboardType="phone-pad" autoComplete="tel" value={payerPhone} onChangeText={setPayerPhone} />
            <PrimaryButton title={`Pay ${amount}`} onPress={pay} loading={busy === 'pay'} disabled={payerPhone.trim().length < 7} />
          </View>
        )}

        {step === 'done' && (
          <View style={{ gap: 16 }}>
            <Text style={[s.body, { color: colors.textSecondary }]}>
              Payment confirmed — your <Text style={{ fontWeight: '800', color: colors.textPrimary }}>{label} account has been created</Text>.
              We emailed you and sent an in-app notification with these same directions.
            </Text>
            <PrimaryButton title={`Open my ${label} dashboard`} onPress={openDashboard} />
            <Text style={[s.help, { color: colors.textMuted }]}>If the dashboard does not open, sign out and sign back in — your new account loads on a fresh sign-in.</Text>
            <TouchableOpacity onPress={logout} style={s.linkBtn} accessibilityRole="button">
              <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 14.5 }}>Sign out now</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 20, paddingTop: 24, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3, marginBottom: 14 },
  steps: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  stepPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  stepText: { fontSize: 12, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22 },
  help: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  alert: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 18 },
  alertText: { color: '#B91C1C', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  notice: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 18 },
  noticeText: { color: '#065F46', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  linkBtn: { alignItems: 'center', paddingVertical: 6 },
});
