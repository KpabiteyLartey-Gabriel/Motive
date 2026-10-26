import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Share, Image } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTheme, palette } from '../../lib/theme';
import { useAuth, fmtGHS, fmtDate } from '../../lib/useAuth';
import { contractsApi, marketplaceApi, vehiclesApi, resolveVehiclePhoto } from '../../lib/api';

const GHANA_REGIONS = ['Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern', 'Greater Accra', 'North East', 'Northern', 'Oti', 'Savannah', 'Upper East', 'Upper West', 'Volta', 'Western', 'Western North'];
const VEHICLE_TYPES = ['SEDAN', 'SUV', 'PICKUP', 'MINIBUS', 'BUS', 'TRUCK', 'MOTORCYCLE', 'TRICYCLE', 'OTHER'];
const FUEL_TYPES = ['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'LPG'];

export default function OwnerContracts() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [contracts, setContracts] = useState([]);
  const [approved, setApproved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startFor, setStartFor] = useState(null);
  const [terms, setTerms] = useState({ vehicleValue: '', depositAmount: '', totalPayable: '', installmentAmount: '', spread: 'duration', durationValue: '3', durationUnit: 'YEARS', frequency: 'WEEKLY', dailySalesAmount: '', gracePeriodDays: '3' });
  const [busy, setBusy] = useState('');
  const [codes, setCodes] = useState({});
  // Direct (agreed in person) contract: model -> private vehicle -> terms -> share.
  const [showDirect, setShowDirect] = useState(false);
  const [dStep, setDStep] = useState(1);
  const [dModel, setDModel] = useState('WORK_AND_PAY');
  const [dVehicle, setDVehicle] = useState(null);
  const [pv, setPv] = useState({ registrationNumber: '', make: '', model: '', year: String(new Date().getFullYear()), color: '', type: 'SEDAN', fuelType: 'PETROL', transmission: 'AUTOMATIC', mileage: '', region: '', address: '' });
  const [pvPhoto, setPvPhoto] = useState('');
  const [regionOpen, setRegionOpen] = useState(false);
  const [pt, setPt] = useState({ totalPayable: '', depositAmount: '', installmentAmount: '', frequency: 'WEEKLY', gracePeriodDays: '3', offDays: '', maintenance: 'DRIVER' });
  const [dt, setDt] = useState({ dailySalesAmount: '', paymentFrequency: 'DAILY', durationValue: '3', durationUnit: 'MONTHS', gracePeriodDays: '0', offDays: '', maintenance: 'DRIVER', fuel: 'DRIVER' });
  const [dBusy, setDBusy] = useState(false);
  const [shareInputs, setShareInputs] = useState({});
  const [shares, setShares] = useState({});
  const [shareBusy, setShareBusy] = useState('');

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

  const doStart = async () => {
    const type = startFor.vehicle?.operatingModel || 'DRIVING_ON';
    const payload = { type, vehicleId: startFor.vehicleId, parties: [{ userId: startFor.otherParty?.id, role: 'DRIVER' }] };
    if (type === 'WORK_AND_PAY') {
      if (![terms.vehicleValue, terms.depositAmount, terms.totalPayable].every((v) => num(v))) { Alert.alert('Missing terms', 'Fill in vehicle value, deposit and total payable.'); return; }
      if (!est) { Alert.alert('How should it be spread?', terms.spread === 'amount' ? 'Enter the installment amount — the system works out the payments and duration.' : 'Enter how long it should take — the system works out the installment.'); return; }
      const graceRaw = Number(terms.gracePeriodDays);
      if (!Number.isFinite(graceRaw) || graceRaw < 0) { Alert.alert('Grace period', 'Enter the grace period in days (0 or more).'); return; }
      payload.workAndPayTerms = { vehicleValue: num(terms.vehicleValue), depositAmount: num(terms.depositAmount), totalPayable: num(terms.totalPayable), installmentAmount: est.installment, installmentFrequency: terms.frequency || 'WEEKLY', totalInstallments: est.usedCount, gracePeriodDays: Math.round(graceRaw) };
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

  // ── Contract estimator (Work & Pay) ────────────────────────────────────
  // Two simple ways to spread the total payable; the system does the math.
  // The owner also chooses how often: daily, weekly or monthly.
  // The vehicle value is owner-only and never goes to the driver.
  const est = (() => {
    const totalPayable = num(terms.totalPayable);
    if (!totalPayable) return null;
    const freq = terms.frequency || 'WEEKLY';
    const freqLabel = freq === 'DAILY' ? 'day' : freq === 'MONTHLY' ? 'month' : 'week';
    const periodsPerYear = freq === 'DAILY' ? 365 : freq === 'MONTHLY' ? 12 : 52;
    const daysPerPeriod = freq === 'DAILY' ? 1 : freq === 'MONTHLY' ? 30.44 : 7;
    const addPeriods = (from, n) => { const d = new Date(from); if (freq === 'MONTHLY') d.setMonth(d.getMonth() + n); else d.setDate(d.getDate() + n * daysPerPeriod); return d; };
    const mode = terms.spread === 'amount' ? 'amount' : 'duration';
    let installment = null;
    let usedCount = null;
    if (mode === 'duration') {
      const dv = num(terms.durationValue);
      if (!dv) return null;
      const years = terms.durationUnit === 'MONTHS' ? dv / 12 : terms.durationUnit === 'WEEKS' ? dv / 52 : dv;
      usedCount = Math.max(1, Math.round(years * periodsPerYear));
      installment = Math.ceil(totalPayable / usedCount);
    } else {
      installment = num(terms.installmentAmount);
      if (!installment) return null;
      usedCount = Math.ceil(totalPayable / installment);
    }
    const graceRaw = Number(terms.gracePeriodDays);
    const graceDays = Number.isFinite(graceRaw) && graceRaw >= 0 ? Math.round(graceRaw) : 0;
    const countingStart = new Date(); countingStart.setDate(countingStart.getDate() + graceDays);
    const firstDue = addPeriods(countingStart, 1);
    const finish = addPeriods(countingStart, usedCount);
    const fmtDur = (n) => String(Math.round(n * 10) / 10);
    const totalDays = usedCount * daysPerPeriod;
    const unit = (n, name) => `${fmtDur(n)} ${name}${Math.round(n * 10) / 10 === 1 ? '' : 's'}`;
    const parts = [unit(usedCount, freqLabel)];
    if (freq !== 'WEEKLY') parts.push(unit(totalDays / 7, 'week'));
    if (freq !== 'MONTHLY') parts.push(unit(totalDays / 30.44, 'month'));
    parts.push(unit(totalDays / 365.25, 'year'));
    const deposit = num(terms.depositAmount) || 0;
    const vehicleValue = num(terms.vehicleValue);
    const totalReceived = deposit + totalPayable;
    return {
      installment, usedCount, finish, mode, freq, freqLabel,
      graceDays, countingStart, firstDue,
      lastPayment: totalPayable - installment * (usedCount - 1),
      profit: vehicleValue ? totalReceived - vehicleValue : null,
      durationText: parts.join(' ≈ '),
    };
  })();

  const startContract = () => doStart();

  const setPvField = (k, v) => setPv((p) => ({ ...p, [k]: v }));
  const setPtField = (k, v) => setPt((p) => ({ ...p, [k]: v }));
  const setDtField = (k, v) => setDt((p) => ({ ...p, [k]: v }));

  const pickVehiclePhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo access to add a vehicle photo.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!result.canceled && result.assets?.length) setPvPhoto(result.assets[0].uri);
  };

  const createDirectVehicle = async () => {
    if (!pv.registrationNumber.trim() || !pv.make.trim() || !pv.model.trim() || !pv.year || !pv.color.trim()) {
      Alert.alert('Vehicle details', 'Add the registration number, make, model, year and colour.');
      return;
    }
    setDBusy(true);
    try {
      const res = await vehiclesApi.create({
        registrationNumber: pv.registrationNumber.trim(), make: pv.make.trim(), model: pv.model.trim(),
        year: Number(pv.year), color: pv.color.trim(), type: pv.type, fuelType: pv.fuelType,
        transmission: pv.transmission, operatingModel: dModel,
        mileage: pv.mileage ? Number(pv.mileage) : undefined,
        region: pv.region || undefined, location: pv.address.trim() || undefined, publish: false,
      });
      let vehicle = res.data?.data;
      if (vehicle?.id && pvPhoto) {
        try {
          const up = await vehiclesApi.uploadPhotos(vehicle.id, pvPhoto);
          if (up.data?.data?.id) vehicle = up.data.data;
        } catch {
          Alert.alert('Photo not saved', 'The vehicle was saved, but the photo could not be uploaded. You can add it later from Vehicles.');
        }
      }
      setDVehicle(vehicle);
      setDStep(3);
    } catch (e) {
      const m = e.response?.data?.message;
      Alert.alert('Could not save vehicle', Array.isArray(m) ? m.join(' ') : m || 'Please try again.');
    }
    setDBusy(false);
  };

  const directInstallments = (() => {
    const total = num(pt.totalPayable); const inst = num(pt.installmentAmount);
    return total && inst ? Math.ceil(total / inst) : null;
  })();

  const createDirectContract = async () => {
    if (!dVehicle?.id) { setDStep(2); return; }
    const isDriveOn = dModel === 'DRIVING_ON';
    const grace = Math.round(Number(isDriveOn ? dt.gracePeriodDays : pt.gracePeriodDays));
    if (!Number.isFinite(grace) || grace < 0) { Alert.alert('Grace period', 'Enter the grace period in days (0 or more).'); return; }
    if (!isDriveOn && (!num(pt.totalPayable) || !num(pt.installmentAmount) || !directInstallments)) { Alert.alert('Terms', 'Enter the total to be paid and the amount per payment.'); return; }
    if (isDriveOn && !num(dt.dailySalesAmount)) { Alert.alert('Terms', 'Enter the daily sales amount the driver must bring.'); return; }
    if (isDriveOn && !num(dt.durationValue)) { Alert.alert('Terms', 'Enter how long this DriveOn contract should run.'); return; }
    setDBusy(true);
    try {
      await contractsApi.create(isDriveOn ? {
        type: 'DRIVING_ON', vehicleId: dVehicle.id, title: `DriveOn — ${dVehicle.registrationNumber}`,
        terms: { source: 'DIRECT', offDays: dt.offDays.trim() || null, gracePeriodDays: grace, duration: { value: Number(dt.durationValue), unit: dt.durationUnit } },
        responsibilityMatrix: { maintenance: dt.maintenance, fuel: dt.fuel },
        drivingOnTerms: {
          dailySalesAmount: num(dt.dailySalesAmount), paymentFrequency: dt.paymentFrequency,
          driverPaysMaintenance: dt.maintenance === 'DRIVER', driverPaysFuel: dt.fuel === 'DRIVER', driverPaysInsurance: false,
        },
      } : {
        type: 'WORK_AND_PAY', vehicleId: dVehicle.id, title: `Work & Pay — ${dVehicle.registrationNumber}`,
        terms: { source: 'DIRECT', offDays: pt.offDays.trim() || null },
        responsibilityMatrix: { maintenance: pt.maintenance },
        workAndPayTerms: {
          depositAmount: Number(pt.depositAmount) || 0, totalPayable: num(pt.totalPayable),
          installmentAmount: num(pt.installmentAmount), installmentFrequency: pt.frequency,
          totalInstallments: directInstallments, gracePeriodDays: grace,
        },
      });
      setShowDirect(false);
      setDStep(1);
      setDVehicle(null);
      Alert.alert('Contract created', 'It is saved below as a draft. Open it and share it with the driver by their chat username.');
      load();
    } catch (e) {
      const m = e.response?.data?.message;
      Alert.alert('Could not create contract', Array.isArray(m) ? m.join(' ') : m || 'Please try again.');
    }
    setDBusy(false);
  };

  const shareDirect = async (contract, override) => {
    const username = (override ?? shareInputs[contract.id] ?? '').trim();
    if (!username) { Alert.alert('Driver username', "Enter the driver's chat username first — ask the driver for it."); return; }
    setShareBusy(contract.id);
    try {
      const r = await contractsApi.share(contract.id, username);
      const d = r.data?.data || {};
      setShares((p) => ({ ...p, [contract.id]: d }));
      Alert.alert('Contract shared', `Sent to @${d.driver?.chatUsername || username} in your chat with them, with a notification${d.emailSent ? ' and an email' : ''}. Now send their confirmation code from the contract.`);
      load();
    } catch (e) {
      const m = e.response?.data?.message;
      Alert.alert('Could not share', Array.isArray(m) ? m.join(' ') : m || 'Please try again.');
    }
    setShareBusy('');
  };

  const sendSharedCode = async (contract) => {
    const share = shares[contract.id];
    if (!share?.code || !share?.threadId) return;
    try {
      await marketplaceApi.sendMessage(share.threadId, {
        body: `Here is your contract confirmation code: ${share.code}\nOpen your Contract on +Motive and enter the code to accept. Please only accept after you have seen the vehicle and confirmed its documents in person.`,
      });
      Alert.alert('Sent', 'Confirmation code sent to the driver in chat.');
      router.push({ pathname: '/(owner)/messages', params: { thread: share.threadId } });
    } catch (e) {
      Alert.alert('Could not send', e.response?.data?.message || 'Copy the code and paste it into the chat yourself.');
    }
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
      const w = contract.workAndPayTerms;
      const freqWord = w ? ({ DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month' }[w.installmentFrequency] || 'week') : null;
      const summary = w
        ? `\n\nYour contract in plain words: you get the ${contract.vehicle?.make || ''} ${contract.vehicle?.model || ''} (${contract.vehicle?.registrationNumber || ''}). You pay ${fmtGHS(w.depositAmount)} deposit upfront, then ${fmtGHS(w.installmentAmount)} every ${freqWord} for ${w.totalInstallments} payments — ${fmtGHS(w.totalPayable)} in total. Grace period: ${w.gracePeriodDays ?? 0} days after you confirm — counting starts when the grace period ends, and your first payment is due one ${freqWord} after counting starts.`
        : '';
      await marketplaceApi.sendMessage(found.threadId, { body: `Here is your contract access code: ${code}\nOpen your Contract on +Motive and enter this code to confirm your contract for ${contract.vehicle?.registrationNumber || 'your vehicle'}.${summary}` });
      Alert.alert('Sent', 'The code was sent to the driver in chat.');
      router.push({ pathname: '/(owner)/messages', params: { thread: found.threadId } });
    } catch (e) {
      Alert.alert('Could not send', e.response?.data?.message || 'Copy the code and paste it into the chat yourself.');
    }
  };

  const ChipRow = ({ options, value, onPick }) => (
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
      {options.map(([v, label, disabled]) => (
        <TouchableOpacity key={v} disabled={disabled} onPress={() => onPick(v)} style={{ borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: value === v ? palette.brand : colors.inputBg, borderWidth: 1, borderColor: colors.border, opacity: disabled ? 0.45 : 1 }}>
          <Text style={{ color: value === v ? '#fff' : colors.textPrimary, fontWeight: '700', fontSize: 12 }}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (loading) return <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color={palette.brand} /></View>;

  const input = [s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <TouchableOpacity onPress={() => { setShowDirect((v) => !v); setDStep(dVehicle ? 3 : 1); }} style={[s.btn, { backgroundColor: palette.brand, marginBottom: 14 }]}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{showDirect ? 'Close' : 'New contract (agreed in person)'}</Text>
      </TouchableOpacity>

      {showDirect && (
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 14 }}>Step {dStep} of 3 — {dStep === 1 ? 'Choose the model' : dStep === 2 ? 'Add the vehicle' : `${dModel === 'DRIVING_ON' ? 'DriveOn' : 'Work & Pay'} terms`}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 3, lineHeight: 17 }}>For a driver you have already agreed with in person. The vehicle stays private — it is not posted on Explore.</Text>

          {dStep === 1 && (
            <View style={{ marginTop: 12 }}>
              <ChipRow options={[['WORK_AND_PAY', 'Work & Pay'], ['DRIVING_ON', 'DriveOn'], ['RENTAL', 'Rent — on hold', true]]} value={dModel} onPick={setDModel} />
              <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 10 }}>{dModel === 'DRIVING_ON' ? 'The driver brings your set sales amount and keeps the rest.' : 'The driver pays towards owning the vehicle.'}</Text>
              <TouchableOpacity onPress={() => setDStep(2)} style={[s.btn, { backgroundColor: palette.brand }]}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Continue to vehicle details</Text></TouchableOpacity>
            </View>
          )}

          {dStep === 2 && (
            <View style={{ marginTop: 12 }}>
              <TextInput style={input} placeholder="Registration number *" placeholderTextColor={colors.textMuted} autoCapitalize="characters" value={pv.registrationNumber} onChangeText={(v) => setPvField('registrationNumber', v)} />
              <TextInput style={input} placeholder="Make *" placeholderTextColor={colors.textMuted} value={pv.make} onChangeText={(v) => setPvField('make', v)} />
              <TextInput style={input} placeholder="Model *" placeholderTextColor={colors.textMuted} value={pv.model} onChangeText={(v) => setPvField('model', v)} />
              <TextInput style={input} placeholder="Year *" placeholderTextColor={colors.textMuted} keyboardType="number-pad" value={pv.year} onChangeText={(v) => setPvField('year', v)} />
              <TextInput style={input} placeholder="Colour *" placeholderTextColor={colors.textMuted} value={pv.color} onChangeText={(v) => setPvField('color', v)} />
              <Text style={[s.label, { color: colors.textSecondary }]}>Type</Text>
              <ChipRow options={VEHICLE_TYPES.map((t) => [t, t])} value={pv.type} onPick={(v) => setPvField('type', v)} />
              <Text style={[s.label, { color: colors.textSecondary }]}>Fuel</Text>
              <ChipRow options={FUEL_TYPES.map((t) => [t, t])} value={pv.fuelType} onPick={(v) => setPvField('fuelType', v)} />
              <Text style={[s.label, { color: colors.textSecondary }]}>Gearbox</Text>
              <ChipRow options={[['AUTOMATIC', 'Automatic'], ['MANUAL', 'Manual']]} value={pv.transmission} onPick={(v) => setPvField('transmission', v)} />
              <TextInput style={input} placeholder="Mileage (optional)" placeholderTextColor={colors.textMuted} keyboardType="number-pad" value={pv.mileage} onChangeText={(v) => setPvField('mileage', v)} />
              <Text style={[s.label, { color: colors.textSecondary }]}>Region</Text>
              <TouchableOpacity onPress={() => setRegionOpen((v) => !v)} style={[input, { justifyContent: 'center' }]}>
                <Text style={{ color: pv.region ? colors.textPrimary : colors.textMuted, fontSize: 14 }}>{pv.region || 'Select region…'}</Text>
              </TouchableOpacity>
              {regionOpen && <ChipRow options={GHANA_REGIONS.map((r) => [r, r])} value={pv.region} onPick={(v) => { setPvField('region', v); setRegionOpen(false); }} />}
              <TextInput style={input} placeholder="Address / area — e.g. Osu, Oxford Street" placeholderTextColor={colors.textMuted} value={pv.address} onChangeText={(v) => setPvField('address', v)} />
              <Text style={[s.label, { color: colors.textSecondary }]}>Vehicle photo</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                {pvPhoto
                  ? <Image source={{ uri: pvPhoto }} style={{ width: 96, height: 64, borderRadius: 10 }} />
                  : <View style={{ width: 96, height: 64, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.textMuted, fontSize: 11 }}>No photo yet</Text></View>}
                <TouchableOpacity onPress={pickVehiclePhoto} style={[s.btn, { borderWidth: 1, borderColor: colors.border }]}><Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 12 }}>{pvPhoto ? 'Change photo' : 'Upload a photo'}</Text></TouchableOpacity>
                {!!pvPhoto && <TouchableOpacity onPress={() => setPvPhoto('')}><Text style={{ color: colors.textMuted, fontSize: 12, textDecorationLine: 'underline' }}>Remove</Text></TouchableOpacity>}
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 11, lineHeight: 16, marginBottom: 10 }}>Add a photo so the driver can recognise the car in the app when your contract arrives.</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => setDStep(1)} style={[s.btn, { flex: 1, borderWidth: 1, borderColor: colors.border }]}><Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 13 }}>Back</Text></TouchableOpacity>
                <TouchableOpacity onPress={createDirectVehicle} disabled={dBusy} style={[s.btn, { flex: 1, backgroundColor: palette.brand, opacity: dBusy ? 0.5 : 1 }]}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{dBusy ? 'Saving…' : 'Save & continue'}</Text></TouchableOpacity>
              </View>
            </View>
          )}

          {dStep === 3 && (
            <View style={{ marginTop: 12 }}>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                {!!dVehicle?.imageUrls?.[0] && <Image source={{ uri: resolveVehiclePhoto(dVehicle.imageUrls[0]) }} style={{ width: 80, height: 54, borderRadius: 10 }} />}
                <Text style={{ color: colors.textMuted, fontSize: 12, flex: 1 }}>{dVehicle?.make} {dVehicle?.model} · {dVehicle?.registrationNumber} · {dVehicle?.color}{dVehicle?.region ? ` · ${dVehicle.region}` : ''}{dVehicle?.location ? ` · ${dVehicle.location}` : ''}</Text>
              </View>
              {dModel === 'DRIVING_ON' ? (
                <>
                  <TextInput style={input} placeholder="Daily sales the driver must bring (GHS) *" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" value={dt.dailySalesAmount} onChangeText={(v) => setDtField('dailySalesAmount', v)} />
                  <Text style={[s.label, { color: colors.textSecondary }]}>How the sales are paid to you</Text>
                  <ChipRow options={[['DAILY', 'Daily'], ['WEEKLY', 'Weekly']]} value={dt.paymentFrequency} onPick={(v) => setDtField('paymentFrequency', v)} />
                  <TextInput style={input} placeholder="Grace period (days)" placeholderTextColor={colors.textMuted} keyboardType="number-pad" value={dt.gracePeriodDays} onChangeText={(v) => setDtField('gracePeriodDays', v)} />
                  <TextInput style={input} placeholder="Contract runs for — number, e.g. 3" placeholderTextColor={colors.textMuted} keyboardType="number-pad" value={dt.durationValue} onChangeText={(v) => setDtField('durationValue', v)} />
                  <ChipRow options={[['DAYS', 'Days'], ['WEEKS', 'Weeks'], ['MONTHS', 'Months']]} value={dt.durationUnit} onPick={(v) => setDtField('durationUnit', v)} />
                  <Text style={[s.label, { color: colors.textSecondary }]}>Who takes care of maintenance</Text>
                  <ChipRow options={[['DRIVER', 'Driver'], ['OWNER', 'Owner'], ['SHARED', 'Shared']]} value={dt.maintenance} onPick={(v) => setDtField('maintenance', v)} />
                  <Text style={[s.label, { color: colors.textSecondary }]}>Who pays for fuel</Text>
                  <ChipRow options={[['DRIVER', 'Driver'], ['OWNER', 'Owner'], ['SHARED', 'Shared']]} value={dt.fuel} onPick={(v) => setDtField('fuel', v)} />
                  <TextInput style={input} placeholder="Off days (optional) — e.g. Sundays" placeholderTextColor={colors.textMuted} value={dt.offDays} onChangeText={(v) => setDtField('offDays', v)} />
                  {!!num(dt.dailySalesAmount) && <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 8 }}>The driver brings {fmtGHS(num(dt.dailySalesAmount))} sales every day{dt.paymentFrequency === 'WEEKLY' ? `, paid to you weekly (about ${fmtGHS(num(dt.dailySalesAmount) * 7)} a week)` : ', paid to you daily'}{num(dt.durationValue) ? `, for ${dt.durationValue} ${dt.durationUnit.toLowerCase()}` : ''}, and keeps everything above that. Counting starts after the {dt.gracePeriodDays || 0}-day grace period, from the day the driver confirms.</Text>}
                </>
              ) : (
                <>
                  <TextInput style={input} placeholder="Total to be paid (GHS) *" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" value={pt.totalPayable} onChangeText={(v) => setPtField('totalPayable', v)} />
                  <TextInput style={input} placeholder="Deposit paid upfront (GHS)" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" value={pt.depositAmount} onChangeText={(v) => setPtField('depositAmount', v)} />
                  <TextInput style={input} placeholder="Amount per payment (GHS) *" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" value={pt.installmentAmount} onChangeText={(v) => setPtField('installmentAmount', v)} />
                  <Text style={[s.label, { color: colors.textSecondary }]}>How often they pay</Text>
                  <ChipRow options={[['DAILY', 'Daily'], ['WEEKLY', 'Weekly'], ['MONTHLY', 'Monthly']]} value={pt.frequency} onPick={(v) => setPtField('frequency', v)} />
                  <TextInput style={input} placeholder="Grace period (days)" placeholderTextColor={colors.textMuted} keyboardType="number-pad" value={pt.gracePeriodDays} onChangeText={(v) => setPtField('gracePeriodDays', v)} />
                  <Text style={[s.label, { color: colors.textSecondary }]}>Who takes care of maintenance</Text>
                  <ChipRow options={[['DRIVER', 'Driver'], ['OWNER', 'Owner'], ['SHARED', 'Shared']]} value={pt.maintenance} onPick={(v) => setPtField('maintenance', v)} />
                  <TextInput style={input} placeholder="Off days (optional) — e.g. Sundays" placeholderTextColor={colors.textMuted} value={pt.offDays} onChangeText={(v) => setPtField('offDays', v)} />
                  {!!directInstallments && <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 8 }}>That is {directInstallments} payments of {fmtGHS(num(pt.installmentAmount))}. Counting starts after the {pt.gracePeriodDays || 0}-day grace period, from the day the driver confirms.</Text>}
                </>
              )}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => setDStep(2)} style={[s.btn, { flex: 1, borderWidth: 1, borderColor: colors.border }]}><Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 13 }}>Back</Text></TouchableOpacity>
                <TouchableOpacity onPress={createDirectContract} disabled={dBusy} style={[s.btn, { flex: 1, backgroundColor: palette.brand, opacity: dBusy ? 0.5 : 1 }]}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{dBusy ? 'Creating…' : 'Create contract'}</Text></TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

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
                      <TextInput style={input} placeholder="Vehicle value (only you see this)" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" value={terms.vehicleValue} onChangeText={(v) => set('vehicleValue', v)} />
                      <TextInput style={input} placeholder="Deposit the driver pays upfront" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" value={terms.depositAmount} onChangeText={(v) => set('depositAmount', v)} />
                      <TextInput style={input} placeholder="Total payable (what you want from this vehicle)" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" value={terms.totalPayable} onChangeText={(v) => set('totalPayable', v)} />
                      <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 8, lineHeight: 16 }}>The driver never sees the vehicle value — they only contract on the total payable.</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>How often should the driver pay?</Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                        {[['DAILY', 'Daily'], ['WEEKLY', 'Weekly'], ['MONTHLY', 'Monthly']].map(([v, label]) => (
                          <TouchableOpacity key={v} onPress={() => set('frequency', v)} style={{ flex: 1, borderRadius: 10, paddingVertical: 9, alignItems: 'center', backgroundColor: (terms.frequency || 'WEEKLY') === v ? palette.brand : colors.inputBg, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: (terms.frequency || 'WEEKLY') === v ? '#fff' : colors.textPrimary, fontWeight: '700', fontSize: 12 }}>{label}</Text></TouchableOpacity>
                        ))}
                      </View>
                      <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>How should the total payable be spread?</Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                        <TouchableOpacity onPress={() => set('spread', 'duration')} style={{ flex: 1, borderRadius: 10, paddingVertical: 9, alignItems: 'center', backgroundColor: terms.spread !== 'amount' ? palette.brand : colors.inputBg, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: terms.spread !== 'amount' ? '#fff' : colors.textPrimary, fontWeight: '700', fontSize: 12 }}>By how long</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => set('spread', 'amount')} style={{ flex: 1, borderRadius: 10, paddingVertical: 9, alignItems: 'center', backgroundColor: terms.spread === 'amount' ? palette.brand : colors.inputBg, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: terms.spread === 'amount' ? '#fff' : colors.textPrimary, fontWeight: '700', fontSize: 12 }}>By amount</Text></TouchableOpacity>
                      </View>
                      {terms.spread === 'amount' ? (
                        <>
                          <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>Amount the driver pays every {(terms.frequency || 'WEEKLY') === 'DAILY' ? 'day' : (terms.frequency || 'WEEKLY') === 'MONTHLY' ? 'month' : 'week'}</Text>
                          <TextInput style={input} placeholder={`e.g. 400 per ${(terms.frequency || 'WEEKLY') === 'DAILY' ? 'day' : (terms.frequency || 'WEEKLY') === 'MONTHLY' ? 'month' : 'week'}`} placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" value={terms.installmentAmount} onChangeText={(v) => set('installmentAmount', v)} />
                        </>
                      ) : (
                        <>
                          <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>Finish paying within — type a number, then choose years, months or weeks below</Text>
                          <TextInput style={input} placeholder="e.g. 3" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" value={terms.durationValue} onChangeText={(v) => set('durationValue', v)} />
                          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                            {['YEARS', 'MONTHS', 'WEEKS'].map((u) => (
                              <TouchableOpacity key={u} onPress={() => set('durationUnit', u)} style={{ flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center', backgroundColor: terms.durationUnit === u ? palette.brand : colors.inputBg, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: terms.durationUnit === u ? '#fff' : colors.textPrimary, fontWeight: '700', fontSize: 11 }}>{u.charAt(0) + u.slice(1).toLowerCase()}</Text></TouchableOpacity>
                            ))}
                          </View>
                        </>
                      )}
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>Grace period — days after the driver confirms before counting starts (0 = none)</Text>
                      <TextInput style={input} placeholder="Grace period in days" placeholderTextColor={colors.textMuted} keyboardType="number-pad" value={terms.gracePeriodDays} onChangeText={(v) => set('gracePeriodDays', v)} />
                      {est ? (
                        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, marginBottom: 8 }}>
                          <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 12 }}>How this contract will work</Text>
                          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 18 }}>
                            The driver will pay {fmtGHS(est.installment)} every {est.freqLabel}, {est.usedCount} payments{est.lastPayment !== est.installment ? ` (last one ${fmtGHS(est.lastPayment)})` : ''}{'\n'}
                            Grace period: {est.graceDays} day{est.graceDays === 1 ? '' : 's'} after the driver confirms{'\n'}
                            Counting starts: {fmtDate(est.countingStart)} (if the driver confirms today){'\n'}
                            First payment due: {fmtDate(est.firstDue)}{'\n'}
                            That takes: {est.durationText}{'\n'}
                            Finishes around: {fmtDate(est.finish)}
                            {est.profit !== null ? `${'\n'}Your profit (only you see this): ${fmtGHS(est.profit)} over the vehicle value` : ''}
                          </Text>
                          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 18 }}>
                            After the driver confirms, the {est.graceDays}-day grace period runs, then counting starts. The dates above assume the driver confirms today; if they confirm later, the grace period and every payment date move to start from that later day.
                          </Text>
                        </View>
                      ) : (
                        <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 8, lineHeight: 16 }}>Enter the total payable, then choose how to spread it — by how long, or by amount — and the system will work out the rest.</Text>
                      )}
                    </>
                  )}
                  {t.vehicle?.operatingModel === 'DRIVING_ON' && <TextInput style={input} placeholder="Daily sales amount" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" value={terms.dailySalesAmount} onChangeText={(v) => set('dailySalesAmount', v)} />}
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
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 3 }}>{c.vehicle?.registrationNumber || ''} · {fmtGHS(c.workAndPayTerms?.totalPayable ?? c.totalAmount)}</Text>
            {!!c.vehicle?.imageUrls?.[0] && <Image source={{ uri: resolveVehiclePhoto(c.vehicle.imageUrls[0]) }} style={{ width: '100%', height: 140, borderRadius: 12, marginTop: 10 }} />}
            {!!(c.vehicle?.color || c.vehicle?.region || c.vehicle?.location) && <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6 }}>{[c.vehicle?.color, c.vehicle?.region, c.vehicle?.location].filter(Boolean).join(' · ')}</Text>}
            {c.workAndPayTerms && <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 6, lineHeight: 18 }}>Deposit {fmtGHS(c.workAndPayTerms.depositAmount)} · {fmtGHS(c.workAndPayTerms.installmentAmount)} {String(c.workAndPayTerms.installmentFrequency || '').toLowerCase()} × {c.workAndPayTerms.totalInstallments} · Grace {c.workAndPayTerms.gracePeriodDays ?? 0} days · Paid {fmtGHS(c.workAndPayTerms.totalPaid)} · Remaining {fmtGHS(c.workAndPayTerms.remainingBalance)}</Text>}
            {c.drivingOnTerms && <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 6, lineHeight: 18 }}>DriveOn: {fmtGHS(c.drivingOnTerms.dailySalesAmount)} sales daily, paid {String(c.drivingOnTerms.paymentFrequency || 'DAILY').toLowerCase()}{c.terms?.duration?.value ? ` · ${c.terms.duration.value} ${String(c.terms.duration.unit || '').toLowerCase()}` : ''}</Text>}
            {!!(c.terms?.offDays || c.responsibilityMatrix?.maintenance) && <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>{c.terms?.offDays ? `Off days: ${c.terms.offDays}. ` : ''}{c.responsibilityMatrix?.maintenance ? `Maintenance: ${String(c.responsibilityMatrix.maintenance).toLowerCase()}.` : ''}</Text>}

            {['DRAFT', 'PENDING_SIGNATURES'].includes(c.status) && !!c.vehicleId && (
              <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
                <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 13 }}>Share with the driver</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 3 }}>Ask the driver for their chat username. The contract goes into your existing chat with them, with a notification and an email. You then send their confirmation code in that chat.</Text>
                {(() => {
                  const dp = (c.parties || []).find((p) => p.role === 'DRIVER' && p.userId);
                  if (!dp) return null;
                  const name = dp.user ? `${dp.user.firstName || ''} ${dp.user.lastName || ''}`.trim() : '';
                  return <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 6 }}>Already shared with {name || 'the driver'}{dp.user?.chatUsername ? ` (@${dp.user.chatUsername})` : ''}. Sharing again gives a new code — the old one stops working.</Text>;
                })()}
                {shares[c.id] ? (
                  <>
                    <Text style={{ color: colors.textPrimary, fontSize: 26, fontWeight: '800', letterSpacing: 6, marginVertical: 10 }}>{shares[c.id].code}</Text>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      <TouchableOpacity onPress={() => sendSharedCode(c)} style={[s.btn, { backgroundColor: palette.brand }]}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Send code in chat</Text></TouchableOpacity>
                      <TouchableOpacity onPress={() => router.push({ pathname: '/(owner)/messages', params: { thread: shares[c.id].threadId } })} style={[s.btn, { borderWidth: 1, borderColor: colors.border }]}><Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 13 }}>Open chat</Text></TouchableOpacity>
                      <TouchableOpacity onPress={() => shareDirect(c, (shareInputs[c.id] || '').trim() || (c.parties || []).find((p) => p.role === 'DRIVER')?.user?.chatUsername)} disabled={shareBusy === c.id} style={[s.btn, { borderWidth: 1, borderColor: colors.border }]}><Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 13 }}>Resend & new code</Text></TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <TextInput
                      style={[input, { marginTop: 10 }]}
                      placeholder="driver's chat username, e.g. kwame.drives"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={shareInputs[c.id] || ''}
                      onChangeText={(v) => setShareInputs((p) => ({ ...p, [c.id]: v }))}
                    />
                    <TouchableOpacity onPress={() => shareDirect(c, (shareInputs[c.id] || '').trim() || (c.parties || []).find((p) => p.role === 'DRIVER')?.user?.chatUsername)} disabled={shareBusy === c.id} style={[s.btn, { backgroundColor: palette.brand, opacity: shareBusy === c.id ? 0.5 : 1 }]}>
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{shareBusy === c.id ? 'Sharing…' : (c.parties || []).some((p) => p.role === 'DRIVER' && p.userId) ? 'Resend & get new code' : 'Share contract in chat'}</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            {c.terms?.source !== 'DIRECT' && hasDriver && ['DRAFT', 'PENDING_SIGNATURES', 'PENDING_APPROVAL'].includes(c.status) && (
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
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 2 },
  btn: { borderRadius: 24, paddingHorizontal: 16, paddingVertical: 11, alignItems: 'center' },
});
