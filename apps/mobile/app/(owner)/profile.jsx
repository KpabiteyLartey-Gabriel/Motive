import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, Alert } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import SecureStore from '../../lib/storage';
import { useTheme } from '../../lib/theme';
import { useAuth, fmtDate } from '../../lib/useAuth';
import { ownersApi, usersApi, resolveVehiclePhoto } from '../../lib/api';
import { Field, PrimaryButton, Badge } from '../../components/ui';

function Section({ title, colors, children }) {
  return (
    <View style={{ marginBottom: 22 }}>
      <Text style={[s.section, { color: colors.textMuted }]}>{title}</Text>
      <View style={[s.block, { borderColor: colors.border, backgroundColor: colors.surface }]}>{children}</View>
    </View>
  );
}

function VerifyRow({ label, value, verifiedAt, colors, onSend, onConfirm, busy }) {
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  if (verifiedAt) {
    return (
      <View style={s.verifyRow}>
        <View style={{ flex: 1 }}>
          <Text style={[s.verifyLabel, { color: colors.textPrimary }]}>{label}</Text>
          <Text style={[s.verifyValue, { color: colors.textMuted }]}>{value || '-'}</Text>
        </View>
        <Badge label="Verified" tone="success" />
      </View>
    );
  }
  return (
    <View style={s.verifyRow}>
      <View style={{ flex: 1 }}>
        <Text style={[s.verifyLabel, { color: colors.textPrimary }]}>{label}</Text>
        <Text style={[s.verifyValue, { color: colors.textMuted }]}>{value || 'Not provided'}</Text>
        {sent ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <View style={{ flex: 1 }}>
              <Field placeholder="6-digit code" keyboardType="number-pad" value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} />
            </View>
            <TouchableOpacity disabled={busy || code.length !== 6} onPress={async () => { if (await onConfirm(code)) setSent(false); }}
              style={[s.smallBtn, { backgroundColor: colors.brand, opacity: busy || code.length !== 6 ? 0.5 : 1 }]}>
              <Text style={s.smallBtnText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
      {!sent ? (
        <TouchableOpacity disabled={busy || !value} onPress={async () => { if (await onSend()) setSent(true); }}
          style={[s.outlineBtn, { borderColor: colors.border, opacity: busy || !value ? 0.5 : 1 }]}>
          <Text style={[s.outlineBtnText, { color: colors.brand }]}>Verify</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function OwnerSettings() {
  const { colors } = useTheme();
  const { user, loading, logout } = useAuth();
  const [me, setMe] = useState(null);
  const [owner, setOwner] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ firstName: '', lastName: '', otherNames: '', phone: '' });
  const [ownerForm, setOwnerForm] = useState({ ghanaCardNumber: '', address: '', city: '', region: '', momoNumber: '', momoProvider: '', bankName: '', bankAccountNumber: '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });

  const load = useCallback(async () => {
    try {
      const [meRes, ownerRes] = await Promise.allSettled([usersApi.getMe(), ownersApi.getMyProfile()]);
      if (meRes.status === 'fulfilled') {
        const m = meRes.value.data?.data || meRes.value.data;
        setMe(m);
        setForm({ firstName: m.firstName || '', lastName: m.lastName || '', otherNames: m.otherNames || '', phone: m.phone || '' });
      }
      if (ownerRes.status === 'fulfilled') {
        const o = ownerRes.value.data?.data || ownerRes.value.data;
        setOwner(o);
        setOwnerForm({
          ghanaCardNumber: o.ghanaCardNumber || '', address: o.address || '', city: o.city || '', region: o.region || '',
          momoNumber: o.momoNumber || '', momoProvider: o.momoProvider || '', bankName: o.bankName || '', bankAccountNumber: o.bankAccountNumber || '',
        });
      }
    } catch {}
    setFetching(false);
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  const fail = (e, fallback) => {
    const m = e.response?.data?.message;
    setError(Array.isArray(m) ? m.join(', ') : m || fallback);
  };
  const note = (t) => { setMsg(t); setError(''); };

  const saveProfile = async () => {
    setBusy(true); setMsg(''); setError('');
    try {
      const res = await usersApi.updateMe(form);
      const m = res.data?.data || res.data;
      setMe(m);
      const stored = JSON.parse((await SecureStore.getItemAsync('user')) || '{}');
      await SecureStore.setItemAsync('user', JSON.stringify({ ...stored, ...m }));
      note('Profile updated.');
    } catch (e) { fail(e, 'Could not update profile.'); }
    setBusy(false);
  };

  const saveOwner = async () => {
    setBusy(true); setMsg(''); setError('');
    try {
      const res = await ownersApi.updateProfile(ownerForm);
      setOwner(res.data?.data || res.data);
      note('Owner details saved.');
    } catch (e) { fail(e, 'Could not save owner details.'); }
    setBusy(false);
  };

  const pickPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setError('Photo access is needed to change your profile picture.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [1, 1] });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setBusy(true); setMsg(''); setError('');
      const res = await usersApi.uploadProfilePhoto(result.assets[0].uri);
      setMe(res.data?.data || res.data);
      note('Profile picture updated.');
    } catch (e) { fail(e, 'Could not upload picture.'); }
    setBusy(false);
  };

  const changePassword = async () => {
    if (pw.newPassword !== pw.confirm) { setError('New passwords do not match.'); return; }
    if (pw.newPassword.length < 8) { setError('New password must be at least 8 characters.'); return; }
    setBusy(true); setMsg(''); setError('');
    try {
      await usersApi.changePassword({ currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
      note('Password changed. Other sessions have been signed out.');
    } catch (e) { fail(e, 'Could not change password.'); }
    setBusy(false);
  };

  const sendCode = (kind) => async () => {
    setBusy(true); setMsg(''); setError('');
    try {
      const res = kind === 'email' ? await usersApi.sendEmailCode() : await usersApi.sendPhoneCode();
      note(res.data?.data?.message || 'Code sent.');
      return true;
    } catch (e) { fail(e, 'Could not send code.'); return false; }
    finally { setBusy(false); }
  };

  const confirmCode = (kind) => async (code) => {
    setBusy(true); setMsg(''); setError('');
    try {
      const res = kind === 'email' ? await usersApi.confirmEmailCode(code) : await usersApi.confirmPhoneCode(code);
      note(res.data?.data?.message || 'Verified.');
      await load();
      return true;
    } catch (e) { fail(e, 'That code did not work.'); return false; }
    finally { setBusy(false); }
  };

  const deactivate = () => {
    Alert.alert('Deactivate account?', 'You will be signed out and cannot sign in until an admin reactivates you.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Deactivate', style: 'destructive', onPress: async () => {
        setBusy(true);
        try { await usersApi.deactivateMe(); logout(); }
        catch (e) { fail(e, 'Could not deactivate account.'); setBusy(false); }
      } },
    ]);
  };

  if (loading || fetching) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.textPrimary} />
      </SafeAreaView>
    );
  }

  const photoUrl = me?.profilePhotoUrl ? resolveVehiclePhoto(me.profilePhotoUrl) : '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 50 }} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={s.avatarSection}>
          <TouchableOpacity onPress={pickPhoto} activeOpacity={0.8}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={s.avatarImg} />
            ) : (
              <View style={[s.avatar, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
                <Text style={[s.avatarText, { color: colors.textPrimary }]}>{me?.firstName?.[0]}{me?.lastName?.[0]}</Text>
              </View>
            )}
            <View style={[s.cameraBadge, { backgroundColor: colors.brand }]}><Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>Edit</Text></View>
          </TouchableOpacity>
          <Text style={[s.fullName, { color: colors.textPrimary }]}>{me?.firstName} {me?.lastName}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>Vehicle Owner · tap photo to change</Text>
        </View>

        {msg ? <View style={[s.alert, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}><Text style={{ color: '#065F46', fontWeight: '600', fontSize: 13.5 }}>{msg}</Text></View> : null}
        {error ? <View style={[s.alert, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}><Text style={{ color: '#B91C1C', fontWeight: '600', fontSize: 13.5 }}>{error}</Text></View> : null}

        <Section title="Profile" colors={colors}>
          <View style={{ padding: 16, gap: 14 }}>
            <Field label="First name" value={form.firstName} onChangeText={(v) => setForm({ ...form, firstName: v })} />
            <Field label="Last name" value={form.lastName} onChangeText={(v) => setForm({ ...form, lastName: v })} />
            <Field label="Other names" value={form.otherNames} onChangeText={(v) => setForm({ ...form, otherNames: v })} />
            <Field label="Phone" value={form.phone} keyboardType="phone-pad" onChangeText={(v) => setForm({ ...form, phone: v })} />
            <PrimaryButton title="Save profile" onPress={saveProfile} loading={busy} />
          </View>
        </Section>

        <Section title="Verifications" colors={colors}>
          <View style={{ paddingHorizontal: 16 }}>
            <VerifyRow label="Email" value={me?.email} verifiedAt={me?.emailVerifiedAt} colors={colors} busy={busy} onSend={sendCode('email')} onConfirm={confirmCode('email')} />
            <VerifyRow label="Phone" value={me?.phone} verifiedAt={me?.phoneVerifiedAt} colors={colors} busy={busy} onSend={sendCode('phone')} onConfirm={confirmCode('phone')} />
            <View style={s.verifyRow}>
              <View style={{ flex: 1 }}>
                <Text style={[s.verifyLabel, { color: colors.textPrimary }]}>Identity (Ghana Card)</Text>
                <Text style={[s.verifyValue, { color: colors.textMuted }]}>{owner?.ghanaCardNumber || 'Add below'} · reviewed by +Motive</Text>
              </View>
              <Badge label={(owner?.status || 'PENDING').replace(/_/g, ' ')} tone={owner?.status === 'VERIFIED' ? 'success' : 'warning'} />
            </View>
          </View>
        </Section>

        <Section title="Owner & payout details" colors={colors}>
          <View style={{ padding: 16, gap: 14 }}>
            <Field label="Ghana Card number" placeholder="GHA-123456789-0" value={ownerForm.ghanaCardNumber} onChangeText={(v) => setOwnerForm({ ...ownerForm, ghanaCardNumber: v })} />
            <Field label="MoMo number" placeholder="+233..." keyboardType="phone-pad" value={ownerForm.momoNumber} onChangeText={(v) => setOwnerForm({ ...ownerForm, momoNumber: v })} />
            <Field label="MoMo provider" placeholder="MTN, Telecel, AirtelTigo" value={ownerForm.momoProvider} onChangeText={(v) => setOwnerForm({ ...ownerForm, momoProvider: v })} />
            <Field label="Address" value={ownerForm.address} onChangeText={(v) => setOwnerForm({ ...ownerForm, address: v })} />
            <Field label="City" value={ownerForm.city} onChangeText={(v) => setOwnerForm({ ...ownerForm, city: v })} />
            <Field label="Region" value={ownerForm.region} onChangeText={(v) => setOwnerForm({ ...ownerForm, region: v })} />
            <Field label="Bank name (optional)" value={ownerForm.bankName} onChangeText={(v) => setOwnerForm({ ...ownerForm, bankName: v })} />
            <Field label="Bank account (optional)" value={ownerForm.bankAccountNumber} onChangeText={(v) => setOwnerForm({ ...ownerForm, bankAccountNumber: v })} />
            <PrimaryButton title="Save owner details" onPress={saveOwner} loading={busy} />
          </View>
        </Section>

        <Section title="Security" colors={colors}>
          <View style={{ padding: 16, gap: 14 }}>
            <Field label="Current password" secureTextEntry value={pw.currentPassword} onChangeText={(v) => setPw({ ...pw, currentPassword: v })} />
            <Field label="New password" hint="At least 8 characters" secureTextEntry value={pw.newPassword} onChangeText={(v) => setPw({ ...pw, newPassword: v })} />
            <Field label="Confirm new password" secureTextEntry value={pw.confirm} onChangeText={(v) => setPw({ ...pw, confirm: v })} />
            <PrimaryButton title="Change password" onPress={changePassword} loading={busy} />
          </View>
        </Section>

        <Section title="Account" colors={colors}>
          <View style={{ padding: 16, gap: 8 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13.5 }}>Status: {me?.status || '-'} · Joined {fmtDate(me?.createdAt)}</Text>
            <TouchableOpacity onPress={deactivate} disabled={busy} style={{ paddingVertical: 8 }}>
              <Text style={{ color: colors.danger || '#DC2626', fontWeight: '700', fontSize: 14 }}>Deactivate my account</Text>
            </TouchableOpacity>
          </View>
        </Section>

        <TouchableOpacity style={[s.signOut, { borderColor: colors.border }]} onPress={logout} activeOpacity={0.7}>
          <Text style={[s.signOutText, { color: colors.danger || '#DC2626' }]}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  avatarSection: { alignItems: 'center', paddingVertical: 22, gap: 8 },
  avatar: { width: 76, height: 76, borderRadius: 22, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  avatarImg: { width: 76, height: 76, borderRadius: 22 },
  avatarText: { fontSize: 24, fontWeight: '700' },
  cameraBadge: { position: 'absolute', bottom: -6, right: -10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  fullName: { fontSize: 20, fontWeight: '700', marginTop: 8 },
  section: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  block: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  alert: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 16 },
  verifyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  verifyLabel: { fontSize: 14.5, fontWeight: '700' },
  verifyValue: { fontSize: 13, marginTop: 2 },
  smallBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  smallBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  outlineBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1 },
  outlineBtnText: { fontWeight: '700', fontSize: 13 },
  signOut: { borderWidth: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  signOutText: { fontWeight: '700', fontSize: 15 },
});
