import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import SecureStore from '../lib/storage';
import { useTheme, palette } from '../lib/theme';
import { usersApi, resolveVehiclePhoto } from '../lib/api';

// Profile picture for every user, wherever their Settings/Profile lives.
// The picture is the person's face across the app — chat, and the driver
// line on an owner's vehicle.
export default function ProfilePicture({ user, accountLabel }) {
  const { colors } = useTheme();
  const [profile, setProfile] = useState(user || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => { if (user) setProfile((p) => ({ ...(p || {}), ...user })); }, [user]);

  useEffect(() => {
    let live = true;
    usersApi.getMe()
      .then((res) => { if (live) setProfile(res.data?.data || res.data); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  const upload = async () => {
    setError(''); setNotice('');
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError('Photo access is needed to choose your profile picture.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setBusy(true);
    try {
      const res = await usersApi.uploadProfilePhoto(result.assets[0].uri);
      const me = res.data?.data || res.data;
      setProfile(me);
      try {
        const stored = JSON.parse((await SecureStore.getItemAsync('user')) || '{}');
        await SecureStore.setItemAsync('user', JSON.stringify({ ...stored, ...me }));
      } catch {}
      setNotice('Profile picture updated. It now shows wherever your name appears.');
    } catch (e) {
      setError(e.response?.data?.message || 'Could not upload that picture. Please try another image.');
    }
    setBusy(false);
  };

  const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || 'Your account';
  const initials = `${(profile?.firstName || '?')[0]}${(profile?.lastName || '')[0]}`.toUpperCase();
  const src = profile?.profilePhotoUrl ? resolveVehiclePhoto(profile.profilePhotoUrl) : '';

  return (
    <View>
      <View style={s.row}>
        {src ? (
          <Image source={{ uri: src }} style={s.photo} accessibilityLabel={`${name} profile picture`} />
        ) : (
          <View style={[s.photo, s.fallback, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
            <Text style={[s.initials, { color: colors.textPrimary }]}>{initials}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[s.name, { color: colors.textPrimary }]}>{name}</Text>
          <Text style={[s.meta, { color: colors.textMuted }]}>
            {profile?.email || ''}{accountLabel ? ` · ${accountLabel}` : ''}
          </Text>
          <TouchableOpacity onPress={upload} disabled={busy} style={[s.btn, { borderColor: colors.border, opacity: busy ? 0.5 : 1 }]} accessibilityRole="button">
            <Text style={[s.btnText, { color: colors.textPrimary }]}>{busy ? 'Uploading…' : profile?.profilePhotoUrl ? 'Change profile picture' : 'Add profile picture'}</Text>
          </TouchableOpacity>
        </View>
      </View>
      {notice ? <Text style={s.notice}>{notice}</Text> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}
      <Text style={[s.help, { color: colors.textMuted }]}>Use a clear picture of your face. It shows in chat and anywhere your account is named.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  photo: { width: 64, height: 64, borderRadius: 32 },
  fallback: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 20, fontWeight: '800' },
  name: { fontSize: 15.5, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 2 },
  btn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start', marginTop: 10 },
  btnText: { fontSize: 12.5, fontWeight: '600' },
  notice: { color: '#059669', fontSize: 13, fontWeight: '600', marginTop: 10, lineHeight: 18 },
  error: { color: '#DC2626', fontSize: 13, fontWeight: '600', marginTop: 10, lineHeight: 18 },
  help: { fontSize: 12, lineHeight: 17, marginTop: 6 },
});
