import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../lib/theme';
import { useAuth, fmtDate } from '../../lib/useAuth';
import { driversApi } from '../../lib/api';
import { Field, PrimaryButton, Badge } from '../../components/ui';
import { AppearanceToggle } from '../../components/AppearanceToggle';
import ProfilePicture from '../../components/ProfilePicture';

function InfoRow({ label, value, colors }) {
  return (
    <View style={[s.row, { borderBottomColor: colors.border }]}>
      <Text style={[s.label, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[s.value, { color: colors.textPrimary }]}>{value || '-'}</Text>
    </View>
  );
}

function Section({ title, colors, children }) {
  return (
    <View style={{ marginBottom: 22 }}>
      <Text style={[s.section, { color: colors.textMuted }]}>{title}</Text>
      <View style={[s.block, { borderColor: colors.border, backgroundColor: colors.surface }]}>{children}</View>
    </View>
  );
}

const KYC_COMPLETE_STATUSES = ['VERIFIED', 'APPROVED', 'ACTIVE'];

export default function DriverProfile() {
  const { colors } = useTheme();
  const { user, loading, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    licenseNumber: '', licenseClass: '', licenseExpiryDate: '', ghanaCardNumber: '',
    address: '', city: '', region: '', emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelationship: '',
  });

  const load = useCallback(() => {
    if (!user) return;
    driversApi.getMyProfile()
      .then((res) => {
        const p = res.data?.data;
        setProfile(p);
        if (p) {
          setForm({
            licenseNumber: p.licenseNumber || '',
            licenseClass: p.licenseClass || '',
            licenseExpiryDate: p.licenseExpiryDate ? String(p.licenseExpiryDate).slice(0, 10) : '',
            ghanaCardNumber: p.ghanaCardNumber || '',
            address: p.address || '',
            city: p.city || '',
            region: p.region || '',
            emergencyContactName: p.emergencyContact?.name || '',
            emergencyContactPhone: p.emergencyContact?.phone || '',
            emergencyContactRelationship: p.emergencyContact?.relationship || '',
          });
        }
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const fail = (e, fallback) => {
    const m = e.response?.data?.message;
    setError(Array.isArray(m) ? m.join(', ') : m || fallback);
  };

  const saveKyc = async () => {
    setBusy(true); setMsg(''); setError('');
    try {
      const res = await driversApi.updateProfile({
        ...form,
        licenseExpiryDate: form.licenseExpiryDate || undefined,
      });
      setProfile(res.data?.data);
      setMsg('KYC details saved. Our team will review your documents and verify your account.');
    } catch (e) { fail(e, 'Could not save KYC details.'); }
    setBusy(false);
  };

  const uploadDoc = async (type) => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setError('Photo access is needed to upload your document.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setBusy(true); setMsg(''); setError('');
      await driversApi.uploadDocument(result.assets[0].uri, type, type === 'LICENSE' ? form.licenseExpiryDate || undefined : undefined);
      setMsg(`${type === 'LICENSE' ? 'Licence' : 'Ghana Card'} photo uploaded for review.`);
      load();
    } catch (e) { fail(e, 'Could not upload document.'); }
    setBusy(false);
  };

  if (loading || fetching) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.textPrimary} />
      </SafeAreaView>
    );
  }

  const status = profile?.status || 'PENDING_VERIFICATION';
  const isVerified = KYC_COMPLETE_STATUSES.includes(status) || !!profile?.verifiedAt;
  const documents = profile?.documents || [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 50 }} keyboardShouldPersistTaps="handled">

        {/* Avatar */}
        <View style={s.avatarSection}>
          <View style={[s.avatar, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
            <Text style={[s.avatarText, { color: colors.textPrimary }]}>
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </Text>
          </View>
          <Text style={[s.fullName, { color: colors.textPrimary }]}>{user?.firstName} {user?.lastName}</Text>
          <View style={[s.rolePill, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
            <Text style={[s.roleText, { color: colors.textSecondary }]}>Driver</Text>
          </View>
          <View style={{ alignSelf: 'stretch', marginTop: 18 }}>
            <ProfilePicture user={user} accountLabel="Driver" />
          </View>
        </View>

        {msg ? <View style={[s.alert, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}><Text style={{ color: '#065F46', fontWeight: '600', fontSize: 13.5 }}>{msg}</Text></View> : null}
        {error ? <View style={[s.alert, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}><Text style={{ color: '#B91C1C', fontWeight: '600', fontSize: 13.5 }}>{error}</Text></View> : null}

        {/* KYC status */}
        <View style={[s.kycBanner, { backgroundColor: isVerified ? '#ECFDF5' : '#FFFBEB', borderColor: isVerified ? '#A7F3D0' : '#FDE68A' }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '800', fontSize: 15, color: isVerified ? '#065F46' : '#92400E' }}>
              {isVerified ? 'Identity verified' : 'Identity verification pending'}
            </Text>
            <Text style={{ fontSize: 13, lineHeight: 19, marginTop: 3, color: isVerified ? '#065F46' : '#92400E' }}>
              {isVerified
                ? `Verified${profile?.verifiedAt ? ` on ${fmtDate(profile.verifiedAt)}` : ''}. You are fully confirmed as a +Motive driver.`
                : 'Add your driving licence and Ghana Card details below, upload clear photos, and our team will confirm you are who you say you are.'}
            </Text>
          </View>
          <Badge label={status.replace(/_/g, ' ')} tone={isVerified ? 'success' : 'warning'} />
        </View>

        {/* Account */}
        <Section title="Account" colors={colors}>
          <InfoRow label="Email"  value={user?.email} colors={colors} />
          <InfoRow label="Phone"  value={user?.phone} colors={colors} />
          <InfoRow label="Status" value={user?.status} colors={colors} />
          <InfoRow label="Joined" value={fmtDate(user?.createdAt)} colors={colors} />
        </Section>

        {/* KYC form */}
        <Section title="KYC — Licence & identity" colors={colors}>
          <View style={{ padding: 16, gap: 14 }}>
            <Field label="Driving licence number" placeholder="e.g. GH-123456789" value={form.licenseNumber}
              onChangeText={(v) => setForm({ ...form, licenseNumber: v })} />
            <Field label="Licence class" placeholder="e.g. Class B" value={form.licenseClass}
              onChangeText={(v) => setForm({ ...form, licenseClass: v })} />
            <Field label="Licence expiry date" placeholder="YYYY-MM-DD" value={form.licenseExpiryDate}
              onChangeText={(v) => setForm({ ...form, licenseExpiryDate: v })} />
            <Field label="Ghana Card number" placeholder="GHA-123456789-0" value={form.ghanaCardNumber}
              onChangeText={(v) => setForm({ ...form, ghanaCardNumber: v })} />
            <Field label="Residential address" value={form.address}
              onChangeText={(v) => setForm({ ...form, address: v })} />
            <Field label="City" value={form.city}
              onChangeText={(v) => setForm({ ...form, city: v })} />
            <Field label="Region" value={form.region}
              onChangeText={(v) => setForm({ ...form, region: v })} />
            <Field label="Emergency contact name" value={form.emergencyContactName}
              onChangeText={(v) => setForm({ ...form, emergencyContactName: v })} />
            <Field label="Emergency contact phone" keyboardType="phone-pad" value={form.emergencyContactPhone}
              onChangeText={(v) => setForm({ ...form, emergencyContactPhone: v })} />
            <Field label="Emergency contact relationship" placeholder="e.g. Spouse, Brother" value={form.emergencyContactRelationship}
              onChangeText={(v) => setForm({ ...form, emergencyContactRelationship: v })} />
            <PrimaryButton title="Save KYC details" onPress={saveKyc} loading={busy} />
          </View>
        </Section>

        {/* Documents */}
        <Section title="KYC documents" colors={colors}>
          <View style={{ padding: 16, gap: 12 }}>
            <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19 }}>
              Upload clear photos of your documents. Our team checks them against the details above before verifying your account.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity disabled={busy} onPress={() => uploadDoc('LICENSE')} style={[s.docBtn, { borderColor: colors.border }]}>
                <Text style={[s.docBtnText, { color: colors.brand }]}>Upload licence photo</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={busy} onPress={() => uploadDoc('GHANA_CARD')} style={[s.docBtn, { borderColor: colors.border }]}>
                <Text style={[s.docBtnText, { color: colors.brand }]}>Upload Ghana Card</Text>
              </TouchableOpacity>
            </View>
            {documents.length === 0 ? (
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>No documents uploaded yet.</Text>
            ) : (
              documents.map((d) => (
                <View key={d.id} style={[s.docRow, { borderBottomColor: colors.separator }]}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13.5, flex: 1 }}>
                    {(d.type || 'Document').replace(/_/g, ' ')} · {d.fileName || 'file'}
                  </Text>
                  <Badge label={(d.status || 'PENDING').replace(/_/g, ' ')} tone={d.status === 'VERIFIED' || d.status === 'APPROVED' ? 'success' : d.status === 'REJECTED' ? 'danger' : 'warning'} />
                </View>
              ))
            )}
          </View>
        </Section>

        {/* Appearance */}
        <Section title="Appearance" colors={colors}>
          <View style={{ padding: 16 }}>
            <AppearanceToggle />
          </View>
        </Section>

        {/* Sign out */}
        <TouchableOpacity style={[s.signOut, { borderColor: colors.border }]} onPress={logout} activeOpacity={0.7}>
          <Text style={[s.signOutText, { color: colors.danger }]}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  avatarSection: { alignItems: 'center', paddingVertical: 28, gap: 10 },
  avatar:        { width: 72, height: 72, borderRadius: 20, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  avatarText:    { fontSize: 24, fontWeight: '700' },
  fullName:      { fontSize: 20, fontWeight: '700' },
  rolePill:      { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  roleText:      { fontSize: 12, fontWeight: '600' },
  section:       { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  block:         { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  row:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1 },
  label:         { fontSize: 13 },
  value:         { fontSize: 13, fontWeight: '500', textAlign: 'right', flex: 1 },
  alert:         { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 16 },
  kycBanner:     { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 22 },
  docBtn:        { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  docBtnText:    { fontWeight: '700', fontSize: 13 },
  docRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  signOut:       { borderWidth: 1, borderRadius: 40, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  signOutText:   { fontWeight: '600', fontSize: 15 },
});
