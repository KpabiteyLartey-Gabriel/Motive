import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Share } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useTheme, palette } from '../../lib/theme';
import { useAuth, fmtGHS } from '../../lib/useAuth';
import { contractsApi, marketplaceApi } from '../../lib/api';

export default function OwnerContracts() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [contracts, setContracts] = useState([]);
  const [approved, setApproved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startFor, setStartFor] = useState(null);
  const [terms, setTerms] = useState({ vehicleValue: '', depositAmount: '', totalPayable: '', installmentAmount: '', totalInstallments: '52', dailySalesAmount: '' });
  const [busy, setBusy] = useState('');
  const [codes, setCodes] = useState({});

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([contractsApi.list({ limit: 50 }).catch(() => null), marketplaceApi.threads().catch(() => null)]);
      setContracts(a?.data?.data?.contracts || []);
      setApproved((b?.data?.data || []).filter((t) => t.interest?.status === 'APPROVED'));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  const set = (k, v) => setTerms((p) => ({ ...p, [k]: v }));
  const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };

  const startContract = async () => {
    const type = startFor.vehicle?.operatingModel || 'DRIVING_ON';
    const payload = { type, vehicleId: startFor.vehicleId, parties: [{ userId: startFor.otherParty?.id, role: 'DRIVER' }] };
    if (type === 'WORK_AND_PAY') {
      if (![terms.vehicleValue, terms.depositAmount, terms.totalPayable, terms.installmentAmount, terms.totalInstallments].every((v) => num(v))) { Alert.alert('Missing terms', 'Fill in vehicle value, deposit, total payable, installment and number of installments.'); return; }
      payload.workAndPayTerms = { vehicleValue: num(terms.vehicleValue), depositAmount: num(terms.depositAmount), totalPayable: num(terms.totalPayable), installmentAmount: num(terms.installmentAmount), installmentFrequency: 'WEEKLY', totalInstallments: Math.round(num(terms.totalInstallments)) };
    } else if (type === 'RENTAL') {
      payload.rentalTerms = { paymentFrequency: 'WEEKLY' };
    } else {
      if (!num(terms.dailySalesAmount)) { Alert.alert('Missing terms', 'Enter the daily sales amount.'); return; }
      payload.drivingOnTerms = { dailySalesAmount: num(terms.dailySalesAmount), paymentFrequency: 'DAILY' };
    }
    setBusy('start');
    try {
      await contractsApi.create(payload);
      setStartFor(null);
      Alert.alert('Contract created', 'Now generate the driver access code on the contract below and share it in your chat.');
      load();
    } catch (e) {
      Alert.alert('Could not create contract', e.response?.data?.message || 'Please try again.');
    }
    setBusy('');
  };

  const generateCode = async (contract) => {
    setBusy(contract.id);
    try {
      const r = await marketplaceApi.generateAccessCode(contract.id);
      const code = r.data?.data?.code;
      if (code) setCodes((p) => ({ ...p, [contract.id]: code }));
    } catch (e) {
      Alert.alert('Could not generate code', e.response?.data?.message || 'The driver must be the approved driver for this vehicle.');
    }
    setBusy('');
  };

  const sendCodeInChat = async (contract) => {
    const code = codes[contract.id];
    if (!code) return;
    try {
      const r = await marketplaceApi.vehicleInterests(contract.vehicleId);
      const found = (r.data?.data || []).find((i) => i.status === 'APPROVED' && i.threadId);
      if (!found) { Alert.alert('No chat found', 'Open Messages to find your chat with the driver.'); return; }
      await marketplaceApi.sendMessage(found.threadId, { body: `Here is your contract access code: ${code}\nOpen your Contract on +Motive and enter this code to confirm your contract for ${contract.vehicle?.registrationNumber || 'your vehicle'}.` });
      Alert.alert('Sent', 'The code was sent to the driver in chat.');
      router.push({ pathname: '/(owner)/messages', params: { thread: found.threadId } });
    } catch (e) {
      Alert.alert('Could not send', e.response?.data?.message || 'Copy the code and paste it into the chat yourself.');
    }
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color={palette.brand} /></View>;

  const input = [s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      {approved.length > 0 && (
        <>
          <Text style={[s.section, { color: colors.textSecondary }]}>Approved drivers waiting for a contract</Text>
          {approved.map((t) => (
            <View key={t.id} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>{t.otherParty ? `${t.otherParty.firstName || ''} ${t.otherParty.lastName || ''}`.trim() : 'Driver'} — {t.vehicle?.make} {t.vehicle?.model}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{t.vehicle?.registrationNumber} · {(t.vehicle?.operatingModel || '').replace(/_/g, ' ')}</Text>
              {startFor?.id === t.id ? (
                <View style={{ marginTop: 12 }}>
                  {t.vehicle?.operatingModel === 'WORK_AND_PAY' && (
                    <>
                      <TextInput style={input} placeholder="Vehicle value (GHS)" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" value={terms.vehicleValue} onChangeText={(v) => set('vehicleValue', v)} />
                      <TextInput style={input} placeholder="Deposit (GHS)" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" value={terms.depositAmount} onChangeText={(v) => set('depositAmount', v)} />
                      <TextInput style={input} placeholder="Total payable (GHS)" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" value={terms.totalPayable} onChangeText={(v) => set('totalPayable', v)} />
                      <TextInput style={input} placeholder="Weekly installment (GHS)" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" value={terms.installmentAmount} onChangeText={(v) => set('installmentAmount', v)} />
                      <TextInput style={input} placeholder="Number of installments" placeholderTextColor={colors.textMuted} keyboardType="number-pad" value={terms.totalInstallments} onChangeText={(v) => set('totalInstallments', v)} />
                    </>
                  )}
                  {t.vehicle?.operatingModel === 'DRIVING_ON' && <TextInput style={input} placeholder="Daily sales amount (GHS)" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" value={terms.dailySalesAmount} onChangeText={(v) => set('dailySalesAmount', v)} />}
                  {t.vehicle?.operatingModel === 'RENTAL' && <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>Rental contract — weekly payments through the managing company.</Text>}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={() => setStartFor(null)} style={[s.btn, { flex: 1, borderWidth: 1, borderColor: colors.border }]}><Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 13 }}>Cancel</Text></TouchableOpacity>
                    <TouchableOpacity onPress={startContract} disabled={busy === 'start'} style={[s.btn, { flex: 1, backgroundColor: palette.brand }]}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{busy === 'start' ? 'Creating…' : 'Create contract'}</Text></TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setStartFor(t)} style={[s.btn, { backgroundColor: palette.brand, marginTop: 12 }]}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Start contract</Text></TouchableOpacity>
              )}
            </View>
          ))}
        </>
      )}

      <Text style={[s.section, { color: colors.textSecondary }]}>My contracts</Text>
      {contracts.length === 0 && <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 20 }}>No contracts yet. Approve a driver from Explore interest, then start their contract here.</Text>}
      {contracts.map((c) => {
        const hasDriver = (c.parties || []).some((p) => p.role === 'DRIVER');
        const code = codes[c.id];
        return (
          <View key={c.id} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>{(c.type || '').replace(/_/g, ' ')}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700' }}>{c.status}</Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 3 }}>{c.vehicle?.registrationNumber || ''} · {fmtGHS(c.totalAmount)}</Text>
            {hasDriver && ['DRAFT', 'PENDING_SIGNATURES', 'PENDING_APPROVAL'].includes(c.status) && (
              <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18 }}>Generate the unique code for this vehicle's approved driver and share it in your chat. The driver enters it to confirm and sign.</Text>
                {code ? (
                  <>
                    <Text style={{ color: colors.textPrimary, fontSize: 26, fontWeight: '800', letterSpacing: 6, marginVertical: 10 }}>{code}</Text>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      <TouchableOpacity onPress={() => sendCodeInChat(c)} style={[s.btn, { backgroundColor: palette.brand }]}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Send code in chat</Text></TouchableOpacity>
                      <TouchableOpacity onPress={() => Share.share({ message: `Your +Motive contract access code is ${code}` })} style={[s.btn, { borderWidth: 1, borderColor: colors.border }]}><Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 13 }}>Share</Text></TouchableOpacity>
                      <TouchableOpacity onPress={() => generateCode(c)} disabled={busy === c.id} style={[s.btn, { borderWidth: 1, borderColor: colors.border }]}><Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 13 }}>Regenerate</Text></TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <TouchableOpacity onPress={() => generateCode(c)} disabled={busy === c.id} style={[s.btn, { backgroundColor: palette.brand, marginTop: 10 }]}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{busy === c.id ? 'Generating…' : 'Generate access code'}</Text></TouchableOpacity>
                )}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  section: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10, marginTop: 8 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 8 },
  btn: { borderRadius: 24, paddingHorizontal: 16, paddingVertical: 11, alignItems: 'center' },
});
