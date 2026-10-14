import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, palette } from '../../lib/theme';
import { useAuth, fmtGHS, fmtDate } from '../../lib/useAuth';
import { paymentsApi } from '../../lib/api';

const STATUS_COLOR = {
  SUCCESSFUL: 'success',
  FAILED:     'danger',
  PENDING:    'warning',
  PROCESSING: 'warning',
  INITIATED:  'warning',
  REVERSED:   'danger',
  REFUNDED:   'warning',
};

export default function DriverPayments() {
  const { colors } = useTheme();
  const { user, loading } = useAuth();

  const [payments, setPayments]   = useState([]);
  const [fetching, setFetching]   = useState(true);
  const [paying, setPaying]       = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ amount: '', phone: '', contractId: '' });

  const load = useCallback(async () => {
    try {
      const res = await paymentsApi.list({ limit: 30 });
      setPayments(res.data?.data?.payments || []);
    } catch {}
    setFetching(false);
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  const handlePay = async () => {
    if (!form.amount || !form.phone) {
      Alert.alert('Error', 'Enter amount and MoMo phone number.');
      return;
    }
    setPaying(true);
    try {
      await paymentsApi.initiate({
        amount: parseFloat(form.amount),
        payerPhone: form.phone,
        paymentMethod: 'MOMO',
        contractId: form.contractId || undefined,
        idempotencyKey: `pay-${user.id}-${Date.now()}`,
      });
      Alert.alert('Payment Initiated', 'Check your phone for the MoMo prompt and approve the payment.');
      setShowForm(false);
      setForm({ amount: '', phone: '', contractId: '' });
      load();
    } catch (e) {
      Alert.alert('Failed', e.response?.data?.message || 'Payment failed. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  if (loading || fetching) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.textPrimary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>

        {/* Make payment CTA */}
        {!showForm ? (
          <TouchableOpacity style={[s.ctaBtn, { backgroundColor: palette.solarYellow }]} onPress={() => setShowForm(true)} activeOpacity={0.85}>
            <Text style={[s.ctaBtnText, { color: '#FFFFFF' }]}>Make a Payment</Text>
          </TouchableOpacity>
        ) : (
          <View style={[s.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={[s.cardTitle, { color: colors.textPrimary }]}>MTN MoMo Payment</Text>

            <Text style={[s.label, { color: colors.textSecondary }]}>Amount (GHS)</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={form.amount}
              onChangeText={(v) => setForm((p) => ({ ...p, amount: v }))}
            />

            <Text style={[s.label, { color: colors.textSecondary }]}>MoMo Phone Number</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              placeholder="+233XXXXXXXXX"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              value={form.phone}
              onChangeText={(v) => setForm((p) => ({ ...p, phone: v }))}
            />

            <Text style={[s.hint, { color: colors.textMuted }]}>
              You will receive a MoMo prompt on this number. Approve it to complete the payment.
            </Text>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <TouchableOpacity style={[s.ctaBtn, { flex: 1, backgroundColor: palette.solarYellow }]} onPress={handlePay} disabled={paying} activeOpacity={0.85}>
                {paying ? <ActivityIndicator color={colors.ctaText} /> : <Text style={[s.ctaBtnText, { color: '#FFFFFF' }]}>Send MoMo Prompt</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[s.cancelBtn, { flex: 1, borderColor: colors.border }]} onPress={() => setShowForm(false)} activeOpacity={0.7}>
                <Text style={[s.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Transaction history */}
        <Text style={[s.section, { color: colors.textSecondary }]}>Transaction History</Text>

        {payments.length === 0 ? (
          <View style={[s.empty, { borderColor: colors.border }]}>
            <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>No transactions yet</Text>
            <Text style={[s.emptyText, { color: colors.textMuted }]}>Your payment history will appear here.</Text>
          </View>
        ) : (
          <View style={[s.list, { borderColor: colors.border }]}>
            {payments.map((p, i) => {
              const dotColor = colors[STATUS_COLOR[p.status]] || colors.textMuted;
              return (
                <View key={p.id} style={[s.row, { borderBottomColor: colors.border }, i === payments.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.rowAmount, { color: colors.textPrimary }]}>{fmtGHS(p.amount)}</Text>
                    <Text style={[s.rowDate, { color: colors.textMuted }]}>{fmtDate(p.createdAt)}</Text>
                    {p.providerReference && <Text style={[s.rowRef, { color: colors.textMuted }]}>Ref: {p.providerReference}</Text>}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <View style={[s.dot, { backgroundColor: dotColor }]} />
                      <Text style={[s.rowStatus, { color: colors.textSecondary }]}>{p.status}</Text>
                    </View>
                    <Text style={[s.rowMethod, { color: colors.textMuted }]}>{p.paymentMethod || 'MOMO'}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ctaBtn:      { borderRadius: 40, paddingVertical: 16, alignItems: 'center', marginBottom: 20 },
  ctaBtnText:  { fontWeight: '700', fontSize: 15 },
  cancelBtn:   { borderWidth: 1, borderRadius: 40, paddingVertical: 16, alignItems: 'center' },
  cancelBtnText:{ fontWeight: '600', fontSize: 15 },
  card:        { borderWidth: 1, borderRadius: 16, padding: 18, marginBottom: 20, gap: 4 },
  cardTitle:   { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  label:       { fontSize: 13, fontWeight: '500', marginBottom: 6, marginTop: 8 },
  input:       { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, marginBottom: 4 },
  hint:        { fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: 8 },
  section:     { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 },
  empty:       { borderWidth: 1, borderRadius: 16, padding: 32, alignItems: 'center' },
  emptyTitle:  { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  emptyText:   { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  list:        { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  row:         { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 8 },
  rowAmount:   { fontSize: 15, fontWeight: '700' },
  rowDate:     { fontSize: 12, marginTop: 2 },
  rowRef:      { fontSize: 11, marginTop: 2 },
  dot:         { width: 6, height: 6, borderRadius: 3 },
  rowStatus:   { fontSize: 12 },
  rowMethod:   { fontSize: 11 },
});
