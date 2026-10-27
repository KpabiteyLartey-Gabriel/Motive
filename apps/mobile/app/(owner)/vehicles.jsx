import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Image } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, palette } from '../../lib/theme';
import { useAuth, fmtGHS } from '../../lib/useAuth';
import * as ImagePicker from 'expo-image-picker';
import { vehiclesApi, contractsApi, marketplaceApi, resolveVehiclePhoto } from '../../lib/api';
import { Card, Badge, Field, PrimaryButton } from '../../components/ui';

const TYPE_LABEL = { WORK_AND_PAY: 'Work & Pay', DRIVING_ON: 'DriveOn', RENTAL: 'Rental' };
const VEHICLE_KINDS = ['MOTORCYCLE', 'TRICYCLE', 'SEDAN', 'SUV', 'PICKUP', 'VAN', 'MINIBUS', 'BUS', 'TRUCK', 'TRAILER', 'OTHER'];

// My Vehicles: grid of the owner's motor vehicles. Attach one of the
// created contracts, then award it to a driver found by search.
export default function OwnerVehicles() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState('');
  const [form, setForm] = useState({ registrationNumber: '', make: '', model: '', year: String(new Date().getFullYear()), type: 'SEDAN', color: '', mileage: '', region: '', location: '' });
  const [attachFor, setAttachFor] = useState(null);
  const [awardFor, setAwardFor] = useState(null);
  const [driverQuery, setDriverQuery] = useState('');
  const [driverResults, setDriverResults] = useState([]);
  const [pickedDriver, setPickedDriver] = useState(null);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    try {
      const [v, c] = await Promise.all([
        vehiclesApi.list({ limit: 100 }).catch(() => null),
        contractsApi.list({ limit: 100 }).catch(() => null),
      ]);
      setVehicles(v?.data?.data?.vehicles || v?.data?.data || []);
      setContracts(c?.data?.data?.contracts || []);
    } catch {}
    setFetching(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  const contractByVehicle = {};
  contracts.forEach((c) => { if (c.vehicleId) contractByVehicle[c.vehicleId] = c; });
  const attachable = contracts.filter((c) => !c.vehicleId && c.status === 'DRAFT' && !(c.parties || []).some((p) => p.role === 'DRIVER'));

  const createVehicle = async () => {
    if (!form.registrationNumber.trim() || !form.make.trim() || !form.model.trim() || !form.year) {
      Alert.alert('Details needed', 'Registration number, make, model and year are required.');
      return;
    }
    setBusy('create');
    try {
      await vehiclesApi.create({
        registrationNumber: form.registrationNumber.trim(), make: form.make.trim(), model: form.model.trim(),
        year: Number(form.year), type: form.type, color: form.color.trim() || undefined,
        fuelType: 'PETROL', transmission: 'AUTOMATIC',
        mileage: form.mileage ? Number(form.mileage) : undefined,
        region: form.region.trim() || undefined, location: form.location.trim() || undefined, publish: false,
      });
      setShowForm(false);
      Alert.alert('Vehicle added', 'Attach a contract to it, then award it to a driver.');
      load();
    } catch (e) {
      Alert.alert('Could not save', e.response?.data?.message || 'Please try again.');
    }
    setBusy('');
  };

  // Owners can add a vehicle picture at any time from the card; the
  // newest picture becomes the cover photo.
  const pickVehiclePhoto = async (vehicle) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Photo access needed', 'Allow photo access to add a vehicle picture.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setBusy('photo');
    try {
      const oldUrls = vehicle.imageUrls || [];
      const res = await vehiclesApi.uploadPhotos(vehicle.id, result.assets[0].uri);
      const allUrls = (res.data?.data || res.data)?.imageUrls || [];
      const newUrl = allUrls.find((u) => !oldUrls.includes(u)) || allUrls[allUrls.length - 1];
      if (newUrl && oldUrls.length) await vehiclesApi.setPhotos(vehicle.id, [newUrl, ...oldUrls]).catch(() => {});
      load();
    } catch (e) {
      Alert.alert('Could not upload', e.response?.data?.message || 'Please try another image.');
    }
    setBusy('');
  };

  const attach = async (vehicle, contractId) => {
    setBusy('attach');
    try {
      await contractsApi.attach(contractId, vehicle.id);
      setAttachFor(null);
      load();
    } catch (e) {
      Alert.alert('Could not attach', e.response?.data?.message || 'Please try again.');
    }
    setBusy('');
  };

  const searchDrivers = async () => {
    if (!driverQuery.trim()) return;
    setBusy('search');
    try {
      const res = await marketplaceApi.searchChatUsers(driverQuery.trim());
      setDriverResults(res.data?.data || []);
      if (!(res.data?.data || []).length) Alert.alert('No one found', 'Ask the driver for their exact chat username.');
    } catch { Alert.alert('Search failed', 'Please try again.'); }
    setBusy('');
  };

  const award = async (contract) => {
    if (!pickedDriver?.chatUsername) { Alert.alert('Pick a driver', 'Find and select the driver first.'); return; }
    setBusy('award');
    try {
      const res = await contractsApi.award(contract.id, pickedDriver.chatUsername);
      const data = res.data?.data || res.data;
      setAwardFor(null);
      setPickedDriver(null);
      setDriverResults([]);
      Alert.alert('Contract awarded', data?.requiresDriverAccount
        ? `@${data.driver.chatUsername} has no Driver account yet. Their signing code was sent to their phone, email and notifications and stays valid until they create one and sign.`
        : `@${data.driver.chatUsername} has their signing code by phone, email and notifications. This vehicle becomes active when they sign.`);
      load();
    } catch (e) {
      Alert.alert('Could not award', e.response?.data?.message || 'Please try again.');
    }
    setBusy('');
  };

  if (fetching) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }} edges={['bottom']}><ActivityIndicator color={palette.brand} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        <PrimaryButton title={showForm ? 'Close form' : '+ Add vehicle'} onPress={() => setShowForm((v) => !v)} />
        {showForm && (
          <Card style={{ padding: 16, marginTop: 16 }}>
            <Text style={[s.note, { color: colors.textMuted }]}>Any motor vehicle — motorbike, tricycle, car, van, truck or trailer. Basic, public information only.</Text>
            <View style={s.chips}>
              {VEHICLE_KINDS.map((t) => (
                <TouchableOpacity key={t} onPress={() => set('type', t)} style={[s.chip, { borderColor: form.type === t ? palette.brand : colors.border, backgroundColor: form.type === t ? palette.brand : 'transparent' }]} accessibilityRole="button" accessibilityState={{ selected: form.type === t }}>
                  <Text style={{ color: form.type === t ? '#fff' : colors.textSecondary, fontWeight: '700', fontSize: 11.5 }}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Field label="Registration number" placeholder="GR 1234-26" autoCapitalize="characters" value={form.registrationNumber} onChangeText={(v) => set('registrationNumber', v)} />
            <Field label="Make" placeholder="Toyota" value={form.make} onChangeText={(v) => set('make', v)} />
            <Field label="Model" placeholder="Hiace" value={form.model} onChangeText={(v) => set('model', v)} />
            <Field label="Year" placeholder="2021" keyboardType="numeric" value={form.year} onChangeText={(v) => set('year', v)} />
            <Field label="Colour" placeholder="White" value={form.color} onChangeText={(v) => set('color', v)} />
            <Field label="Mileage (km)" placeholder="120000" keyboardType="numeric" value={form.mileage} onChangeText={(v) => set('mileage', v)} />
            <Field label="Region" placeholder="Greater Accra" value={form.region} onChangeText={(v) => set('region', v)} />
            <Field label="Area / address" placeholder="Osu, Accra" value={form.location} onChangeText={(v) => set('location', v)} />
            <PrimaryButton title="Add vehicle" onPress={createVehicle} loading={busy === 'create'} />
          </Card>
        )}

        <Text style={[s.section, { color: colors.textSecondary }]}>Your vehicles</Text>
        {vehicles.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: 13.5, lineHeight: 20 }}>No vehicles yet. Add your first one above.</Text>
        ) : vehicles.map((v) => {
          const contract = contractByVehicle[v.id];
          const isActive = contract?.status === 'ACTIVE';
          const awarded = contract && (contract.parties || []).some((p) => p.role === 'DRIVER');
          return (
            <Card key={v.id} style={{ padding: 0, marginBottom: 14, overflow: 'hidden' }}>
              {v.imageUrls?.[0] ? <Image source={{ uri: resolveVehiclePhoto(v.imageUrls[0]) }} style={s.photo} /> : <View style={[s.photo, { backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: colors.textMuted, fontSize: 12 }}>No photo yet</Text></View>}
              <TouchableOpacity onPress={() => pickVehiclePhoto(v)} disabled={busy === 'photo'} style={s.photoBtn} accessibilityRole="button">
                <Text style={s.photoBtnText}>{busy === 'photo' ? 'Uploading…' : v.imageUrls?.[0] ? 'Change photo' : 'Add photo'}</Text>
              </TouchableOpacity>
              <View style={{ padding: 14 }}>
                <View style={s.rowBetween}>
                  <Text style={[s.title, { color: colors.textPrimary }]}>{v.make} {v.model} · {v.year}</Text>
                  <Badge label={isActive ? 'Active contract' : awarded ? 'Awarded' : contract ? 'Attached' : v.status} tone={isActive ? 'success' : 'warning'} />
                </View>
                <Text style={[s.meta, { color: colors.textMuted }]}>{v.registrationNumber} · {v.type} · {v.color || ''}{v.mileage ? ` · ${Number(v.mileage).toLocaleString()} km` : ''} · {v.location || v.region || ''}</Text>
                {contract ? (
                  <>
                    <Text style={[s.body, { color: colors.textSecondary }]}>{contract.title || 'Contract'} ({contract.contractNumber}) — {TYPE_LABEL[contract.type] || contract.type}</Text>
                    {(() => {
                      const driverParty = (contract.parties || []).find((p) => p.role === 'DRIVER' && p.user);
                      if (!driverParty) return null;
                      const d = driverParty.user;
                      const name = [d.firstName, d.lastName].filter(Boolean).join(' ') || 'Driver';
                      return (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                          {d.profilePhotoUrl
                            ? <Image source={{ uri: resolveVehiclePhoto(d.profilePhotoUrl) }} style={s.avatar} />
                            : <View style={[s.avatar, s.avatarFallback]}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{name.charAt(0)}</Text></View>}
                          <Text style={[s.body, { color: colors.textPrimary, fontWeight: '700', flex: 1, marginTop: 0 }]}>
                            {driverParty.signedAt ? 'Driver: ' : 'Awarded to: '}{name}
                            {d.chatUsername ? <Text style={{ color: colors.textMuted, fontWeight: '400' }}> @{d.chatUsername}</Text> : null}
                            <Text style={{ color: driverParty.signedAt ? '#059669' : '#D97706' }}>{driverParty.signedAt ? ' · Confirmed' : ' · Awaiting signing'}</Text>
                          </Text>
                        </View>
                      );
                    })()}
                  </>
                ) : (
                  <Text style={[s.body, { color: colors.textMuted }]}>No contract attached yet.</Text>
                )}

                {!contract && attachFor !== v.id && <PrimaryButton title="Attach contract" onPress={() => setAttachFor(v.id)} style={{ marginTop: 12 }} />}
                {!contract && attachFor === v.id && (
                  <View style={{ marginTop: 12, gap: 8 }}>
                    {attachable.length === 0 ? (
                      <Text style={[s.note, { color: colors.textMuted }]}>You have no unattached contracts. Create one in Contracts first.</Text>
                    ) : attachable.map((c) => (
                      <TouchableOpacity key={c.id} onPress={() => attach(v, c.id)} style={[s.pickRow, { borderColor: colors.border }]} accessibilityRole="button">
                        <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 13.5 }}>{c.title || 'Untitled'} — {TYPE_LABEL[c.type] || c.type}</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 11.5 }}>{c.contractNumber}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity onPress={() => setAttachFor(null)} style={s.linkBtn}><Text style={{ color: colors.brand, fontWeight: '700' }}>Cancel</Text></TouchableOpacity>
                  </View>
                )}

                {contract && !awarded && awardFor !== contract.id && <PrimaryButton title="Award contract" onPress={() => { setAwardFor(contract.id); setPickedDriver(null); setDriverResults([]); }} style={{ marginTop: 12 }} />}
                {contract && !awarded && awardFor === contract.id && (
                  <View style={{ marginTop: 12 }}>
                    <Field label="Search driver by name or @username" placeholder="kofi" value={driverQuery} onChangeText={setDriverQuery} />
                    <PrimaryButton title={busy === 'search' ? 'Searching…' : 'Search'} onPress={searchDrivers} />
                    {driverResults.map((d) => {
                      const person = d.user || d;
                      const selected = pickedDriver?.id === person.id;
                      return (
                        <TouchableOpacity key={person.id} onPress={() => setPickedDriver(person)} style={[s.pickRow, { borderColor: selected ? palette.brand : colors.border, marginTop: 8 }]} accessibilityRole="button" accessibilityState={{ selected }}>
                          <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 13.5 }}>{person.firstName} {person.lastName} <Text style={{ color: colors.textMuted, fontWeight: '400' }}>@{person.chatUsername}</Text></Text>
                          <Text style={{ color: colors.textMuted, fontSize: 11.5 }}>{(person.accounts || []).map((a) => a.label || a.kind || a).join(' · ') || 'User account only — no Driver account yet'}</Text>
                        </TouchableOpacity>
                      );
                    })}
                    <PrimaryButton title="Award to this driver" onPress={() => award(contract)} loading={busy === 'award'} disabled={!pickedDriver} style={{ marginTop: 10 }} />
                    <TouchableOpacity onPress={() => setAwardFor(null)} style={s.linkBtn}><Text style={{ color: colors.brand, fontWeight: '700' }}>Cancel</Text></TouchableOpacity>
                    <Text style={[s.note, { color: colors.textMuted }]}>The signing code goes straight to their phone, email and notifications.</Text>
                  </View>
                )}
                {contract && awarded && !isActive && <Text style={[s.note, { color: '#D97706', marginTop: 10 }]}>Awarded — becomes an active {TYPE_LABEL[contract.type] || ''} contract when the driver signs.</Text>}
                {isActive && <Text style={[s.note, { color: '#059669', marginTop: 10 }]}>Active {TYPE_LABEL[contract.type] || ''} contract on this vehicle.</Text>}
                {contract?.estimatedValue != null && <Text style={[s.meta, { color: colors.textMuted }]}>Value {fmtGHS(contract.estimatedValue)}</Text>}
              </View>
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  section: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 20, marginBottom: 12 },
  photo: { width: '100%', height: 150 },
  photoBtn: { position: 'absolute', top: 118, right: 10, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  photoBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  title: { fontSize: 15, fontWeight: '700', flex: 1 },
  meta: { fontSize: 12, marginTop: 4 },
  body: { fontSize: 13.5, lineHeight: 20, marginTop: 8 },
  note: { fontSize: 12.5, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  avatar: { width: 24, height: 24, borderRadius: 12 },
  avatarFallback: { backgroundColor: palette.brand, alignItems: 'center', justifyContent: 'center' },
  pickRow: { borderWidth: 1, borderRadius: 12, padding: 12 },
  linkBtn: { alignItems: 'center', paddingVertical: 8 },
});
