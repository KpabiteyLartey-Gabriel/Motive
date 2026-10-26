import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import { useAuth, fmtGHS, fmtDate } from '../../lib/useAuth';
import { vehiclesApi, complianceApi, companiesApi, resolveVehiclePhoto } from '../../lib/api';
import VehiclePhotos from '../../components/VehiclePhotos';
import { Field, PrimaryButton } from '../../components/ui';
import { Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const EVIDENCE_SLOTS = [
  { kind: 'frontPlate', label: 'Front of vehicle — number plate clearly visible' },
  { kind: 'rearPlate', label: 'Rear of vehicle — number plate clearly visible' },
  { kind: 'vinPlate', label: 'Chassis / VIN plate — close-up, numbers readable' },
  { kind: 'registrationCert', label: 'Vehicle Registration Certificate (DVLA)' },
];

const TYPES = ['SEDAN', 'SUV', 'PICKUP', 'MINIBUS', 'BUS', 'TRUCK', 'MOTORCYCLE', 'TRICYCLE', 'OTHER'];
const FUELS = ['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'LPG'];
const TRANSMISSIONS = ['MANUAL', 'AUTOMATIC'];
const GHANA_REGIONS = ['Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern', 'Greater Accra', 'North East', 'Northern', 'Oti', 'Savannah', 'Upper East', 'Upper West', 'Volta', 'Western', 'Western North'];
const MODELS = [
  { value: 'WORK_AND_PAY', label: 'Work & Pay' },
  { value: 'DRIVING_ON', label: 'DriveOn' },
  { value: 'RENTAL', label: 'Rental' },
];
const EMPTY_FORM = { registrationNumber: '', make: '', model: '', year: String(new Date().getFullYear()), color: '', chassisNumber: '', region: '', type: 'SEDAN', fuelType: 'PETROL', transmission: 'AUTOMATIC', operatingModel: 'WORK_AND_PAY', managingCompanyId: '', mileage: '', estimatedValue: '' };

function ChipRow({ label, options, value, onChange, colors }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 }}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => {
          const v = typeof o === 'string' ? o : o.value;
          const l = typeof o === 'string' ? o.replace(/_/g, ' ') : o.label;
          const active = value === v;
          return (
            <TouchableOpacity key={v} onPress={() => onChange(v)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: active ? colors.brand : colors.border, backgroundColor: active ? colors.brandSoft : colors.card }}>
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: active ? colors.brandText : colors.textSecondary }}>{l}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function OwnerVehicles() {
  const { colors } = useTheme();
  const { user, loading } = useAuth();
  const [vehicles, setVehicles]   = useState([]);
  const [fetching, setFetching]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected]   = useState(null);
  const [compliance, setCompliance] = useState([]);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    if (!user) return;
    companiesApi.list({ limit: 50 })
      .then((r) => setCompanies((r.data?.data?.companies || []).filter((c) => c.status === 'ACTIVE')))
      .catch(() => setCompanies([]));
  }, [user]);

  const submitVehicle = async (publish) => {
    setFormError('');
    if (!form.registrationNumber.trim() || !form.make.trim() || !form.model.trim() || !form.year) {
      setFormError('Registration number, make, model and year are required.');
      return;
    }
    if (publish && form.operatingModel === 'RENTAL' && !form.managingCompanyId) {
      setFormError('Only companies can publish vehicles for rent. Choose the company that will rent this vehicle out, or save it as a draft and choose later.');
      return;
    }
    setSaving(true);
    try {
      const res = await vehiclesApi.create({
        registrationNumber: form.registrationNumber.trim(),
        make: form.make.trim(),
        model: form.model.trim(),
        year: Number(form.year),
        color: form.color.trim() || undefined,
        region: form.region.trim() || undefined,
        type: form.type,
        fuelType: form.fuelType,
        transmission: form.transmission,
        operatingModel: form.operatingModel,
        chassisNumber: form.chassisNumber.trim() || undefined,
        managingCompanyId: form.operatingModel === 'RENTAL' && form.managingCompanyId ? form.managingCompanyId : undefined,
        mileage: form.mileage ? Number(form.mileage) : undefined,
        estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : undefined,
        publish,
      });
      const created = res.data?.data;
      if (created?.id) setVehicles((prev) => [created, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
      if (created?.id) openVehicle(created);
    } catch (e) {
      const m = e.response?.data?.message || 'Could not save the vehicle. Please try again.';
      setFormError(Array.isArray(m) ? m.join(' ') : m);
    } finally {
      setSaving(false);
    }
  };

  const [pendingReq, setPendingReq] = useState(null);
  const [modelBusy, setModelBusy]   = useState(false);
  const [modelMsg, setModelMsg]     = useState('');
  const [rentalCompanyId, setRentalCompanyId] = useState('');
  const [showRentalPicker, setShowRentalPicker] = useState(false);
  const [vChassis, setVChassis]       = useState('');
  const [verifyBusy, setVerifyBusy]   = useState('');
  const [verifyMsg, setVerifyMsg]     = useState('');

  const loadPending = async (vehicleId) => {
    try {
      const r = await vehiclesApi.getPendingModelChange(vehicleId);
      setPendingReq(r.data?.data || null);
    } catch { setPendingReq(null); }
  };

  const changeModel = async (vehicle, target) => {
    if (target === 'RENTAL' && !rentalCompanyId && !vehicle.managingCompanyId) {
      setShowRentalPicker(true);
      setModelMsg('Only companies can publish vehicles for rent. Choose the company that will rent this vehicle out, then confirm.');
      return;
    }
    setModelBusy(true);
    setModelMsg('');
    try {
      const res = await vehiclesApi.changeOperatingModel(vehicle.id, target, target === 'RENTAL' ? (rentalCompanyId || undefined) : undefined);
      const d = res.data?.data || {};
      if (d.approvalRequired) {
        setPendingReq(d.request);
        if (d.vehicle) {
          setVehicles((prev) => prev.map((x) => (x.id === d.vehicle.id ? { ...x, ...d.vehicle } : x)));
          setSelected((s) => (s?.id === d.vehicle.id ? { ...s, ...d.vehicle } : s));
        }
        setShowRentalPicker(false);
        setModelMsg('Change requested — the assigned driver must approve it first, because this Work & Pay vehicle is becoming theirs.');
      } else if (d.vehicle) {
        setVehicles((prev) => prev.map((x) => (x.id === d.vehicle.id ? { ...x, ...d.vehicle } : x)));
        setSelected((s) => (s?.id === d.vehicle.id ? { ...s, ...d.vehicle } : s));
        setShowRentalPicker(false);
        setModelMsg(d.companyUpdated ? 'Rental company saved. You can publish this vehicle now.' : 'Contract type updated.');
      }
    } catch (e) {
      setModelMsg(e.response?.data?.message || 'Could not change the contract type.');
    } finally {
      setModelBusy(false);
    }
  };

  const changeStatus = async (vehicle, status) => {
    setStatusBusy(true);
    try {
      const res = await vehiclesApi.updateStatus(vehicle.id, status);
      const updated = res.data?.data || { ...vehicle, status };
      setVehicles((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
      setSelected((s) => (s?.id === updated.id ? { ...s, ...updated } : s));
    } catch (e) {
      setFormError(e.response?.data?.message || 'Could not update the vehicle status.');
    } finally {
      setStatusBusy(false);
    }
  };

  const load = useCallback(async () => {
    try {
      const res = await vehiclesApi.list({ limit: 50 });
      setVehicles(res.data?.data?.vehicles || []);
    } catch {}
    setFetching(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const applyVehicleUpdate = (updated) => {
    if (!updated?.id) return;
    setVehicles((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
    setSelected((s) => (s?.id === updated.id ? { ...s, ...updated } : s));
  };

  const saveIdentity = async () => {
    if (!selected) return;
    setVerifyBusy('identity');
    setVerifyMsg('');
    try {
      const res = await vehiclesApi.updateDetails(selected.id, { chassisNumber: vChassis.trim() });
      applyVehicleUpdate(res.data?.data);
      setVerifyMsg('Chassis number saved.');
    } catch (e) {
      setVerifyMsg(e.response?.data?.message || 'Could not save those details.');
    } finally {
      setVerifyBusy('');
    }
  };

  const pickEvidence = async (kind) => {
    if (!selected) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setVerifyMsg('Photo access is needed to upload evidence images.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const name = (asset.uri.split('/').pop() || 'evidence.jpg').split('?')[0];
      const form = new FormData();
      form.append('kind', kind);
      form.append('file', { uri: asset.uri, name, type: name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg' });
      setVerifyBusy(kind);
      setVerifyMsg('');
      const res = await vehiclesApi.uploadEvidence(selected.id, kind, form);
      applyVehicleUpdate(res.data?.data);
    } catch (e) {
      setVerifyMsg(e.response?.data?.message || 'Evidence upload failed.');
    } finally {
      setVerifyBusy('');
    }
  };

  const submitVerification = async () => {
    if (!selected) return;
    setVerifyBusy('submit');
    setVerifyMsg('');
    try {
      const res = await vehiclesApi.submitVerification(selected.id);
      applyVehicleUpdate(res.data?.data);
      setVerifyMsg('Submitted. A Super Admin will check the details against your images; you will be notified of the outcome.');
    } catch (e) {
      const m = e.response?.data?.message || 'Could not submit for verification.';
      setVerifyMsg(Array.isArray(m) ? m.join(' ') : m);
    } finally {
      setVerifyBusy('');
    }
  };

  const openVehicle = async (v) => {
    setSelected(v);
    setModelMsg('');
    setVerifyMsg('');
    setVChassis(v.chassisNumber || '');
    setRentalCompanyId(v.managingCompanyId || '');
    setShowRentalPicker(false);
    loadPending(v.id);
    try {
      const res = await complianceApi.listForVehicle(v.id);
      setCompliance(res.data?.data || []);
    } catch { setCompliance([]); }
  };

  if (loading || fetching) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.textPrimary} />
      </SafeAreaView>
    );
  }

  if (selected) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <TouchableOpacity onPress={() => setSelected(null)} style={[s.back, { borderColor: colors.border }]}>
            <Text style={[s.backText, { color: colors.textSecondary }]}>← Back to fleet</Text>
          </TouchableOpacity>

          <Text style={[s.vTitle, { color: colors.textPrimary }]}>{selected.make} {selected.model}</Text>
          <Text style={[s.vPlate, { color: colors.textSecondary }]}>{selected.registrationNumber} · {selected.year}</Text>

          {selected.status === 'DRAFT' && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 10 }}>This vehicle is a draft — only you can see it.</Text>
              <PrimaryButton title="Publish vehicle" loading={statusBusy} onPress={() => changeStatus(selected, 'AVAILABLE')} />
            </View>
          )}
          {selected.status === 'AVAILABLE' && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 10 }}>Published — available for contracts.</Text>
              <PrimaryButton title="Unpublish" loading={statusBusy} onPress={() => changeStatus(selected, 'DRAFT')} />
            </View>
          )}
          {formError ? <Text style={{ color: colors.danger, fontSize: 13, marginBottom: 12 }}>{formError}</Text> : null}

          <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, marginBottom: 16, backgroundColor: colors.card }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 }}>
              Contract type: {(selected.operatingModel || 'Not set').replace(/_/g, ' ')}
            </Text>
            {pendingReq ? (
              <Text style={{ fontSize: 13, color: colors.warning, lineHeight: 19 }}>
                Waiting for the assigned driver to approve changing {(pendingReq.fromModel || '').replace(/_/g, ' ')} → {(pendingReq.toModel || '').replace(/_/g, ' ')}. Work & Pay vehicles become the driver&apos;s own, so they must agree first.
              </Text>
            ) : (
              <>
                <Text style={{ fontSize: 12.5, color: colors.textMuted, marginBottom: 10, lineHeight: 18 }}>
                  Choose the type this vehicle is published for. Work & Pay changes with a driver assigned need the driver&apos;s approval. DriveOn can be changed any time. Rental is published through a company you choose.
                </Text>
                <ChipRow label="" options={MODELS} value={selected.operatingModel || 'WORK_AND_PAY'} onChange={(v) => changeModel(selected, v)} colors={colors} />
                {(showRentalPicker || selected.operatingModel === 'RENTAL') && (
                  <>
                    <ChipRow label="Company that will rent it out" options={companies.map((c) => ({ value: c.id, label: c.name }))} value={rentalCompanyId || selected.managingCompanyId || ''} onChange={setRentalCompanyId} colors={colors} />
                    {selected.operatingModel === 'RENTAL' && !selected.managingCompanyId ? (
                      <PrimaryButton title="Save rental company" loading={modelBusy} onPress={() => changeModel(selected, 'RENTAL')} />
                    ) : selected.operatingModel !== 'RENTAL' ? (
                      <PrimaryButton title="Confirm — rent through this company" loading={modelBusy} onPress={() => changeModel(selected, 'RENTAL')} />
                    ) : null}
                  </>
                )}
                {modelBusy ? <Text style={{ fontSize: 12.5, color: colors.textMuted }}>Saving…</Text> : null}
              </>
            )}
            {modelMsg ? <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 8, lineHeight: 19 }}>{modelMsg}</Text> : null}
          </View>

          <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, marginBottom: 16, backgroundColor: colors.card }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 }}>
              Verification: {(selected.verificationStatus || 'NOT_SUBMITTED').replace(/_/g, ' ')}
            </Text>
            <Text style={{ fontSize: 12.5, color: colors.textMuted, lineHeight: 18, marginBottom: 8 }}>
              Every vehicle is verified by a Super Admin before it can be published. They confirm the registration number, chassis number, colour, type and year against your evidence images, as on the DVLA registration certificate.
            </Text>
            {selected.verificationStatus === 'REJECTED' && selected.verificationNote ? (
              <Text style={{ fontSize: 13, color: colors.danger, lineHeight: 19, marginBottom: 8 }}>Reason: {selected.verificationNote}</Text>
            ) : null}
            {selected.verificationStatus === 'APPROVED' ? (
              <Text style={{ fontSize: 13, color: colors.success, fontWeight: '600' }}>Verified — this vehicle can be published.</Text>
            ) : selected.verificationStatus === 'PENDING_REVIEW' ? (
              <Text style={{ fontSize: 13, color: colors.warning, lineHeight: 19 }}>Submitted — waiting for a Super Admin to verify this vehicle. You will be notified of the outcome.</Text>
            ) : (
              <>
                <Field label="Chassis number *" placeholder="JTDBR32E862000111" value={vChassis} onChangeText={setVChassis} autoCapitalize="characters" />
                <View style={{ height: 10 }} />
                <PrimaryButton title="Save chassis number" loading={verifyBusy === 'identity'} onPress={saveIdentity} />
                <View style={{ height: 14 }} />
                {EVIDENCE_SLOTS.map((slot) => {
                  const url = selected.verificationEvidence?.[slot.kind];
                  return (
                    <View key={slot.kind} style={{ marginBottom: 12 }}>
                      <Text style={{ fontSize: 12.5, color: colors.textSecondary, marginBottom: 6 }}>{slot.label}</Text>
                      {url ? <Image source={{ uri: resolveVehiclePhoto(url) }} style={{ width: '100%', height: 120, borderRadius: 10, marginBottom: 6 }} /> : null}
                      <TouchableOpacity onPress={() => pickEvidence(slot.kind)} disabled={verifyBusy === slot.kind} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}>
                        <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 13 }}>{verifyBusy === slot.kind ? 'Uploading…' : url ? 'Replace image' : 'Upload image'}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
                <PrimaryButton title={selected.verificationStatus === 'REJECTED' ? 'Resubmit for verification' : 'Submit for verification'} loading={verifyBusy === 'submit'} onPress={submitVerification} />
              </>
            )}
            {verifyMsg ? <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 8, lineHeight: 19 }}>{verifyMsg}</Text> : null}
          </View>

          <VehiclePhotos vehicle={selected} colors={colors} />

          {[
            { label: 'Status',       value: selected.status },
            { label: 'Type',         value: selected.type },
            { label: 'Fuel',         value: selected.fuelType },
            { label: 'Transmission', value: selected.transmission },
            { label: 'Color',        value: selected.color },
            { label: 'Mileage',      value: selected.mileage ? `${selected.mileage.toLocaleString()} km` : '—' },
            { label: 'Value',        value: selected.estimatedValue ? fmtGHS(selected.estimatedValue) : '—' },
            { label: 'Operating',    value: selected.operatingModel?.replace(/_/g, ' ') },
          ].map(({ label, value }) => (
            <View key={label} style={[s.infoRow, { borderBottomColor: colors.border }]}>
              <Text style={[s.infoLabel, { color: colors.textMuted }]}>{label}</Text>
              <Text style={[s.infoValue, { color: colors.textPrimary }]}>{value || '—'}</Text>
            </View>
          ))}

          {compliance.length > 0 && (
            <>
              <Text style={[s.section, { color: colors.textSecondary, marginTop: 20 }]}>Compliance</Text>
              {compliance.map((c) => {
                const expColor = c.status === 'EXPIRED' ? colors.danger : c.status === 'EXPIRING_SOON' ? colors.warning : colors.success;
                return (
                  <View key={c.id} style={[s.infoRow, { borderBottomColor: colors.border }]}>
                    <Text style={[s.infoLabel, { color: colors.textMuted }]}>{c.documentType?.replace(/_/g, ' ')}</Text>
                    <Text style={[s.infoValue, { color: expColor }]}>{c.status?.replace(/_/g, ' ')}{c.expiryDate ? ` · ${fmtDate(c.expiryDate)}` : ''}</Text>
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} />}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={[s.pageTitle, { color: colors.textPrimary, marginBottom: 0 }]}>
            {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''}
          </Text>
          <TouchableOpacity onPress={() => setShowForm((v) => !v)} style={{ backgroundColor: colors.ctaBg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{showForm ? 'Close' : '+ Add vehicle'}</Text>
          </TouchableOpacity>
        </View>

        {showForm && (
          <View style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 18 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 }}>Add a vehicle</Text>
            <Text style={{ fontSize: 12.5, color: colors.textMuted, marginBottom: 14 }}>Publish now to make it Available for contracts, or save as a draft and publish later.</Text>
            {formError ? <Text style={{ color: colors.danger, fontSize: 13, marginBottom: 12 }}>{formError}</Text> : null}
            <Field label="Registration number *" placeholder="GR-1234-26" value={form.registrationNumber} onChangeText={(v) => set('registrationNumber', v)} autoCapitalize="characters" />
            <View style={{ height: 12 }} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}><Field label="Make *" placeholder="Toyota" value={form.make} onChangeText={(v) => set('make', v)} /></View>
              <View style={{ flex: 1 }}><Field label="Model *" placeholder="Corolla" value={form.model} onChangeText={(v) => set('model', v)} /></View>
            </View>
            <View style={{ height: 12 }} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}><Field label="Year *" placeholder="2021" keyboardType="number-pad" value={form.year} onChangeText={(v) => set('year', v)} /></View>
              <View style={{ flex: 1 }}><Field label="Colour" placeholder="White" value={form.color} onChangeText={(v) => set('color', v)} /></View>
            </View>
            <View style={{ height: 12 }} />
            <Field label="Chassis number" placeholder="From the VIN plate / registration certificate" value={form.chassisNumber} onChangeText={(v) => set('chassisNumber', v)} autoCapitalize="characters" />
            <View style={{ height: 12 }} />
            <View style={{ height: 14 }} />
            <ChipRow label="Region" options={GHANA_REGIONS} value={form.region} onChange={(v) => set('region', v)} colors={colors} />
            <ChipRow label="Vehicle type" options={TYPES} value={form.type} onChange={(v) => set('type', v)} colors={colors} />
            <ChipRow label="Fuel" options={FUELS} value={form.fuelType} onChange={(v) => set('fuelType', v)} colors={colors} />
            <ChipRow label="Transmission" options={TRANSMISSIONS} value={form.transmission} onChange={(v) => set('transmission', v)} colors={colors} />
            <ChipRow label="How it will earn" options={MODELS} value={form.operatingModel} onChange={(v) => set('operatingModel', v)} colors={colors} />
            {form.operatingModel === 'RENTAL' && (
              <>
                <Text style={{ fontSize: 12.5, color: colors.textMuted, marginBottom: 10, lineHeight: 18 }}>Only companies publish rentals. Choose the company that will rent this vehicle out.</Text>
                <ChipRow label="Company that will rent it out *" options={companies.map((c) => ({ value: c.id, label: c.name }))} value={form.managingCompanyId} onChange={(v) => set('managingCompanyId', v)} colors={colors} />
                {companies.length === 0 ? <Text style={{ fontSize: 12.5, color: colors.warning, marginBottom: 10 }}>No active companies found yet — you can save as a draft and choose later.</Text> : null}
              </>
            )}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}><Field label="Mileage (km)" placeholder="85000" keyboardType="number-pad" value={form.mileage} onChangeText={(v) => set('mileage', v)} /></View>
              <View style={{ flex: 1 }}><Field label="Value" placeholder="95000" keyboardType="number-pad" value={form.estimatedValue} onChangeText={(v) => set('estimatedValue', v)} /></View>
            </View>
            <View style={{ height: 16 }} />
            <PrimaryButton title="Publish vehicle" loading={saving} onPress={() => submitVehicle(true)} />
            <TouchableOpacity onPress={() => submitVehicle(false)} disabled={saving} style={{ alignItems: 'center', paddingVertical: 13 }}>
              <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 14.5 }}>Save as draft</Text>
            </TouchableOpacity>
          </View>
        )}

        {vehicles.length === 0 ? (
          <View style={[s.empty, { borderColor: colors.border }]}>
            <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>No vehicles yet</Text>
            <Text style={[s.emptyText, { color: colors.textMuted }]}>Tap Add vehicle to register and publish your first vehicle.</Text>
          </View>
        ) : (
          vehicles.map((v) => {
            const statusColor = v.status === 'ACTIVE' || v.status === 'ASSIGNED' ? colors.success
              : v.status === 'UNDER_MAINTENANCE' ? colors.warning
              : colors.textMuted;
            return (
              <TouchableOpacity
                key={v.id}
                style={[s.vCard, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => openVehicle(v)}
                activeOpacity={0.75}
              >
                {v.imageUrls?.[0] ? <Image source={{ uri: resolveVehiclePhoto(v.imageUrls[0]) }} style={s.thumb} /> : null}
                <View style={{ flex: 1 }}>
                  <Text style={[s.vCardTitle, { color: colors.textPrimary }]}>{v.make} {v.model} ({v.year})</Text>
                  <Text style={[s.vCardPlate, { color: colors.textSecondary }]}>{v.registrationNumber}</Text>
                  <Text style={[s.vCardModel, { color: colors.textMuted }]}>{v.operatingModel?.replace(/_/g, ' ') || v.type}</Text>
                  <Text style={[s.vCardModel, { color: v.status === 'AVAILABLE' ? colors.success : colors.textMuted, fontWeight: '700' }]}>{v.status === 'AVAILABLE' ? '● Published' : v.status === 'DRAFT' ? '● Draft' : `● ${(v.status || '').replace(/_/g, ' ')}`}</Text>
                </View>
                <View>
                  <View style={[s.statusDot, { backgroundColor: statusColor }]} />
                  <Text style={[s.vCardArrow, { color: colors.textMuted }]}>→</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pageTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  vCard:     { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  vCardTitle:{ fontSize: 15, fontWeight: '700' },
  vCardPlate:{ fontSize: 13, marginTop: 2 },
  vCardModel:{ fontSize: 12, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 4, alignSelf: 'flex-end' },
  vCardArrow:{ fontSize: 16, alignSelf: 'flex-end' },
  back:      { borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'flex-start', marginBottom: 16 },
  backText:  { fontSize: 13 },
  vTitle:    { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  vPlate:    { fontSize: 14, marginBottom: 20 },
  section:   { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1 },
  infoLabel: { fontSize: 13 },
  infoValue: { fontSize: 13, fontWeight: '500', textAlign: 'right', flex: 1 },
  empty:     { borderWidth: 1, borderRadius: 16, padding: 40, alignItems: 'center' },
  emptyTitle:{ fontSize: 15, fontWeight: '600', marginBottom: 8 },
  emptyText: { fontSize: 13 },
  thumb:     { width: 56, height: 56, borderRadius: 10, marginRight: 12, backgroundColor: '#222' },
});
