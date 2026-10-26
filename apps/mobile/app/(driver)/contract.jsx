import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert, TextInput, Image } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useTheme, palette } from '../../lib/theme';
import { useAuth, fmtGHS, fmtDate } from '../../lib/useAuth';
import { contractsApi, resolveVehiclePhoto } from '../../lib/api';

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
  const [seenVehicle, setSeenVehicle] = useState(false);
  const params = useLocalSearchParams();

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
      const res = await contractsApi.list({ limit: 20 });
      const contracts = res.data?.data?.contracts || [];
      // A shared link/chat card opens its exact contract; otherwise surface a
      // contract waiting for confirmation before older active ones.
      const picked = (params.contract && contracts.find((c) => c.id === params.contract))
        || contracts.find((c) => c.requiresCode)
        || contracts.find((c) => c.status === 'ACTIVE')
        || contracts[0] || null;
      setContract(picked);
    } catch {}
    setFetching(false);
  }, [params.contract]);

  useEffect(() => { if (user) load(); }, [user, load]);

  // The seen-vehicle attestation is per contract: never carry a tick (or a
  // typed code) from one contract onto another.
  useEffect(() => { setSeenVehicle(false); setCode(''); }, [contract?.id]);

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

  const plainWap = (() => {
    if (!wap) return null;
    const freqWord = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month' }[wap.installmentFrequency] || 'week';
    const total = Number(wap.totalPayable); const inst = Number(wap.installmentAmount); const count = Number(wap.totalInstallments);
    const last = total - inst * (count - 1);
    const grace = Math.max(0, Math.round(Number(wap.gracePeriodDays) || 0));
    const countingStart = new Date(); countingStart.setDate(countingStart.getDate() + grace);
    const firstDue = new Date(countingStart);
    const finish = new Date(countingStart);
    if (wap.installmentFrequency === 'MONTHLY') { firstDue.setMonth(firstDue.getMonth() + 1); finish.setMonth(finish.getMonth() + count); }
    else if (wap.installmentFrequency === 'DAILY') { firstDue.setDate(firstDue.getDate() + 1); finish.setDate(finish.getDate() + count); }
    else { firstDue.setDate(firstDue.getDate() + 7); finish.setDate(finish.getDate() + count * 7); }
    const started = contract.status === 'ACTIVE' && contract.startDate;
    return `You pay ${fmtGHS(wap.depositAmount)} deposit upfront, then ${fmtGHS(inst)} every ${freqWord} for ${count} payments — ${fmtGHS(total)} in total${last !== inst ? `, with the last payment ${fmtGHS(last)}` : ''}. Grace period: ${grace} day${grace === 1 ? '' : 's'}. ${started ? `Counting started on ${fmtDate(contract.startDate)} (after your grace period), and the last payment is due around ${fmtDate(contract.endDate || finish)}.` : `When you confirm with your access code, your ${grace}-day grace period runs first. Counting starts on ${fmtDate(countingStart)} if you confirm today, your first payment is due ${fmtDate(firstDue)}, and the last around ${fmtDate(finish)}.`}`;
  })();

  const plainDriveOn = (() => {
    if (!drivingOn) return null;
    const t = contract.terms || {};
    const rm = contract.responsibilityMatrix || {};
    return `You bring ${fmtGHS(drivingOn.dailySalesAmount)} sales every day, paid ${String(drivingOn.paymentFrequency || 'DAILY').toLowerCase()}${t.duration?.value ? `, for ${t.duration.value} ${String(t.duration.unit || '').toLowerCase()}` : ''}. You keep everything you make above the sales amount. Grace period: ${t.gracePeriodDays ?? 0} days from the day you confirm.${t.offDays ? ` Off days: ${t.offDays}.` : ''}${rm.maintenance ? ` Maintenance: ${String(rm.maintenance).toLowerCase()} takes care of it.` : ''}${rm.fuel ? ` Fuel: ${String(rm.fuel).toLowerCase()} pays.` : ''}`;
  })();

  const vehicleMeta = [contract.vehicle?.color, contract.vehicle?.region, contract.vehicle?.location].filter(Boolean).join(' · ');

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

        {!!contract.vehicle?.imageUrls?.[0] && (
          <Image source={{ uri: resolveVehiclePhoto(contract.vehicle.imageUrls[0]) }} style={{ width: '100%', height: 180, borderRadius: 16, marginBottom: 12 }} accessibilityLabel="Vehicle photo" />
        )}
        {!!vehicleMeta && <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 12 }}>{vehicleMeta}</Text>}

        {plainWap && (
          <View style={[s.codeBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>Your contract in plain words</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 }}>{plainWap}</Text>
            {(contract.terms?.offDays || contract.responsibilityMatrix?.maintenance) && (
              <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 6 }}>
                {contract.terms?.offDays ? `Off days: ${contract.terms.offDays}. ` : ''}
                {contract.responsibilityMatrix?.maintenance ? `Maintenance: ${String(contract.responsibilityMatrix.maintenance).toLowerCase()} takes care of it.` : ''}
              </Text>
            )}
            <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 6 }}>+Motive records your agreement and processes your payments. It does not verify the vehicle — confirm the vehicle's documents in person before accepting.</Text>
          </View>
        )}

        {plainDriveOn && (
          <View style={[s.codeBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>Your DriveOn contract in plain words</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 }}>{plainDriveOn}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 6 }}>+Motive records your agreement and processes your payments. It does not verify the vehicle — confirm the vehicle's documents in person before accepting.</Text>
          </View>
        )}

        {/* Confirm with Explore access code — only for approved drivers issued a code */}
        {contract.requiresCode && (
          <View style={[s.codeBox, { borderColor: colors.border, backgroundColor: colors.brandSoft }]}>
            <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>Confirm with your access code</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 }}>The owner approved you for this vehicle and sent a unique code in your chat. Enter it here to confirm and sign this contract. This box only appears when a code has been generated for you.</Text>
            <TouchableOpacity onPress={() => setSeenVehicle((v) => !v)} activeOpacity={0.8} style={{ flexDirection: 'row', gap: 10, marginTop: 12 }} accessibilityRole="checkbox" accessibilityState={{ checked: seenVehicle }}>
              <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: palette.brand, backgroundColor: seenVehicle ? palette.brand : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {seenVehicle && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>✓</Text>}
              </View>
              <Text style={{ color: colors.textPrimary, fontSize: 13, lineHeight: 19, flex: 1 }}>I have physically seen this vehicle, and I have confirmed its documents are in the owner's name.</Text>
            </TouchableOpacity>
            <TextInput
              style={[s.codeInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              placeholder="••••••"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={(v) => setCode(v.replace(/[^0-9]/g, ''))}
            />
            <TouchableOpacity onPress={confirmWithCode} disabled={confirming || !seenVehicle} style={[s.acceptBtn, { backgroundColor: palette.brand, marginBottom: 0, opacity: confirming || !seenVehicle ? 0.45 : 1 }]}>
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
              <InfoRow label="Grace Period"     value={`${wap.gracePeriodDays ?? 0} days after you confirm — counting starts when it ends`} colors={colors} />
              <InfoRow label="Total Paid"       value={fmtGHS(wap.totalPaid)} colors={colors} />
              <InfoRow label="Remaining"        value={fmtGHS(wap.remainingBalance)} colors={colors} />
              <InfoRow label="Paid / Total"     value={`${wap.paidInstallments} / ${wap.totalInstallments} installments`} colors={colors} />
              {!!contract.terms?.offDays && <InfoRow label="Off days" value={contract.terms.offDays} colors={colors} />}
              {!!contract.responsibilityMatrix?.maintenance && <InfoRow label="Maintenance" value={`${String(contract.responsibilityMatrix.maintenance).toLowerCase()} takes care of it`} colors={colors} />}
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
              {!!contract.terms?.duration?.value && <InfoRow label="Runs for" value={`${contract.terms.duration.value} ${String(contract.terms.duration.unit || '').toLowerCase()}`} colors={colors} />}
              <InfoRow label="Grace Period" value={`${contract.terms?.gracePeriodDays ?? 0} days after you confirm`} colors={colors} />
              {!!contract.terms?.offDays && <InfoRow label="Off days" value={contract.terms.offDays} colors={colors} />}
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
