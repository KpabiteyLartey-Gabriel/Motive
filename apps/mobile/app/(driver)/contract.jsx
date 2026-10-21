import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert, TextInput } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, palette } from '../../lib/theme';
import { useAuth, fmtGHS, fmtDate } from '../../lib/useAuth';
import { contractsApi } from '../../lib/api';

function InfoRow({ label, value, colors }) {
  return (
    <View style={[s.infoRow, { borderBottomColor: colors.border }]}>
      <Text style={[s.infoLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[s.infoValue, { color: colors.textPrimary }]}>{value || '—'}</Text>
    </View>
  );
}

export default function DriverContract() {
  const { colors } = useTheme();
  const { user, loading } = useAuth();

  const [contract, setContract] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [code, setCode] = useState('');
  const [confirming, setConfirming] = useState(false);

  const confirmWithCode = async () => {
    if (!code.trim()) { Alert.alert('Enter your code', 'Paste the access code the owner sent you in chat.'); return; }
    setConfirming(true);
    try {
      await contractsApi.confirmCode(contract.id, code.trim());
      Alert.alert('Contract confirmed', 'You have confirmed and signed your contract.');
      setCode('');
      load();
    } catch (e) {
      Alert.alert('Code not accepted', e.response?.data?.message || 'Check the code and try again.');
    }
    setConfirming(false);
  };

  const load = useCallback(async () => {
    try {
      const res = await contractsApi.list({ limit: 5 });
      const contracts = res.data?.data?.contracts || [];
      const active = contracts.find((c) => c.status === 'ACTIVE') || contracts[0] || null;
      setContract(active);
    } catch {}
    setFetching(false);
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  const handleAccept = async () => {
    Alert.alert('Accept Contract', 'Do you accept the terms of this contract?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept',
        onPress: async () => {
          setAccepting(true);
          try {
            await contractsApi.accept(contract.id);
            load();
          } catch (e) {
            Alert.alert('Failed', e.response?.data?.message || 'Could not accept contract.');
          } finally {
            setAccepting(false);
          }
        },
      },
    ]);
  };

  if (loading || fetching) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.textPrimary} />
      </SafeAreaView>
    );
  }

  if (!contract) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={[s.empty, { borderColor: colors.border }]}>
          <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>No contract found</Text>
          <Text style={[s.emptyText, { color: colors.textMuted }]}>You don't have an active contract yet.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const wap = contract.workAndPayTerms;
  const rental = contract.rentalTerms;
  const drivingOn = contract.drivingOnTerms;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>

        {/* Status */}
        <View style={[s.statusRow, { borderColor: colors.border }]}>
          <View>
            <Text style={[s.contractNum, { color: colors.textMuted }]}>{contract.contractNumber}</Text>
            <Text style={[s.contractType, { color: colors.textPrimary }]}>{contract.type?.replace(/_/g, ' ')}</Text>
          </View>
          <View style={[s.badge, {
            backgroundColor: contract.status === 'ACTIVE' ? colors.success + '22' : colors.elevated,
            borderColor: contract.status === 'ACTIVE' ? colors.success : colors.border,
          }]}>
            <Text style={[s.badgeText, { color: contract.status === 'ACTIVE' ? colors.success : colors.textSecondary }]}>
              {contract.status}
            </Text>
          </View>
        </View>

        {/* Confirm with Explore access code — only for approved drivers issued a code */}
        {contract.requiresCode && (
          <View style={[s.codeBox, { borderColor: colors.border, backgroundColor: colors.brandSoft }]}>
            <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>Confirm with your access code</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 }}>The owner approved you for this vehicle and sent a unique code in your chat. Enter it here to confirm and sign this contract. This box only appears when a code has been generated for you.</Text>
            <TextInput
              style={[s.codeInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              placeholder="••••••"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={(v) => setCode(v.replace(/[^0-9]/g, ''))}
            />
            <TouchableOpacity onPress={confirmWithCode} disabled={confirming} style={[s.acceptBtn, { backgroundColor: palette.brand, marginBottom: 0 }]}>
              {confirming ? <ActivityIndicator color="#fff" /> : <Text style={[s.acceptBtnText, { color: '#fff' }]}>Confirm contract</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Accept pending */}
        {!contract.requiresCode && contract.status === 'PENDING_SIGNATURES' && (
          <TouchableOpacity
            style={[s.acceptBtn, { backgroundColor: palette.solarYellow }]}
            onPress={handleAccept}
            disabled={accepting}
            activeOpacity={0.85}
          >
            {accepting
              ? <ActivityIndicator color={colors.ctaText} />
              : <Text style={[s.acceptBtnText, { color: '#FFFFFF' }]}>Accept Contract</Text>
            }
          </TouchableOpacity>
        )}

        {/* Core details */}
        <Text style={[s.section, { color: colors.textSecondary }]}>Contract Details</Text>
        <View style={[s.infoBlock, { borderColor: colors.border }]}>
          <InfoRow label="Start Date"  value={fmtDate(contract.startDate)} colors={colors} />
          <InfoRow label="End Date"    value={contract.endDate ? fmtDate(contract.endDate) : 'Open-ended'} colors={colors} />
          <InfoRow label="Vehicle"     value={contract.vehicle ? `${contract.vehicle.make} ${contract.vehicle.model} (${contract.vehicle.registrationNumber})` : undefined} colors={colors} />
        </View>

        {/* Work & Pay terms */}
        {wap && (
          <>
            <Text style={[s.section, { color: colors.textSecondary }]}>Work & Pay Terms</Text>
            <View style={[s.infoBlock, { borderColor: colors.border }]}>
              <InfoRow label="Total Payable"    value={fmtGHS(wap.totalPayable)} colors={colors} />
              <InfoRow label="Deposit"          value={fmtGHS(wap.depositAmount)} colors={colors} />
              <InfoRow label="Installment"      value={`${fmtGHS(wap.installmentAmount)} / ${wap.installmentFrequency}`} colors={colors} />
              <InfoRow label="Total Paid"       value={fmtGHS(wap.totalPaid)} colors={colors} />
              <InfoRow label="Remaining"        value={fmtGHS(wap.remainingBalance)} colors={colors} />
              <InfoRow label="Paid / Total"     value={`${wap.paidInstallments} / ${wap.totalInstallments} installments`} colors={colors} />
              <InfoRow label="Ownership Eligible" value={wap.ownershipEligible ? 'Yes' : 'Not yet'} colors={colors} />
            </View>
          </>
        )}

        {/* Rental terms */}
        {rental && (
          <>
            <Text style={[s.section, { color: colors.textSecondary }]}>Rental Terms</Text>
            <View style={[s.infoBlock, { borderColor: colors.border }]}>
              {rental.salaryAmount && <InfoRow label="Salary"      value={`${fmtGHS(rental.salaryAmount)} / ${rental.paymentFrequency}`} colors={colors} />}
              {rental.revenueSharePercent && <InfoRow label="Revenue Share" value={`${(Number(rental.revenueSharePercent) * 100).toFixed(0)}%`} colors={colors} />}
              <InfoRow label="Driver pays fuel"        value={rental.driverPaysFuel ? 'Yes' : 'No'} colors={colors} />
              <InfoRow label="Driver pays maintenance" value={rental.driverPaysMaintenance ? 'Yes' : 'No'} colors={colors} />
              <InfoRow label="Driver pays insurance"   value={rental.driverPaysInsurance ? 'Yes' : 'No'} colors={colors} />
            </View>
          </>
        )}

        {/* Driving On terms */}
        {drivingOn && (
          <>
            <Text style={[s.section, { color: colors.textSecondary }]}>Driving On Terms</Text>
            <View style={[s.infoBlock, { borderColor: colors.border }]}>
              <InfoRow label="Daily Amount"   value={`${fmtGHS(drivingOn.dailySalesAmount)} / ${drivingOn.paymentFrequency}`} colors={colors} />
              <InfoRow label="Driver pays fuel"        value={drivingOn.driverPaysFuel ? 'Yes' : 'No'} colors={colors} />
              <InfoRow label="Driver pays maintenance" value={drivingOn.driverPaysMaintenance ? 'Yes' : 'No'} colors={colors} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  statusRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 16 },
  contractNum: { fontSize: 11, fontFamily: 'monospace', marginBottom: 4 },
  contractType:{ fontSize: 18, fontWeight: '700' },
  badge:       { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText:   { fontSize: 12, fontWeight: '600' },
  acceptBtn:   { borderRadius: 40, paddingVertical: 16, alignItems: 'center', marginBottom: 16 },
  acceptBtnText:{ fontWeight: '700', fontSize: 15 },
  section:     { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10, marginTop: 4 },
  infoBlock:   { borderWidth: 1, borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  infoRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1 },
  infoLabel:   { fontSize: 13 },
  infoValue:   { fontSize: 13, fontWeight: '500', flex: 1, textAlign: 'right' },
  codeBox:     { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 16 },
  codeInput:   { borderWidth: 1, borderRadius: 12, paddingVertical: 12, fontSize: 20, fontWeight: '800', letterSpacing: 8, textAlign: 'center', marginVertical: 12 },
  empty:       { margin: 20, borderWidth: 1, borderRadius: 16, padding: 40, alignItems: 'center' },
  emptyTitle:  { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  emptyText:   { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
