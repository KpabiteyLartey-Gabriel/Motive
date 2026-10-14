import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import { useAuth, fmtDate } from '../../lib/useAuth';
import { driversApi } from '../../lib/api';

function InfoRow({ label, value, colors }) {
  return (
    <View style={[s.row, { borderBottomColor: colors.border }]}>
      <Text style={[s.label, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[s.value, { color: colors.textPrimary }]}>{value || '—'}</Text>
    </View>
  );
}

export default function DriverProfile() {
  const { colors } = useTheme();
  const { user, loading, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!user) return;
    driversApi.getMyProfile()
      .then((res) => setProfile(res.data?.data))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user]);

  if (loading || fetching) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.textPrimary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 50 }}>

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
        </View>

        {/* Account */}
        <Text style={[s.section, { color: colors.textSecondary }]}>Account</Text>
        <View style={[s.block, { borderColor: colors.border }]}>
          <InfoRow label="Email"  value={user?.email} colors={colors} />
          <InfoRow label="Phone"  value={user?.phone} colors={colors} />
          <InfoRow label="Status" value={user?.status} colors={colors} />
          <InfoRow label="Joined" value={fmtDate(user?.createdAt)} colors={colors} />
        </View>

        {/* Driver profile */}
        {profile && (
          <>
            <Text style={[s.section, { color: colors.textSecondary }]}>Driver Profile</Text>
            <View style={[s.block, { borderColor: colors.border }]}>
              <InfoRow label="Licence No."    value={profile.licenseNumber} colors={colors} />
              <InfoRow label="Licence Class"  value={profile.licenseClass} colors={colors} />
              <InfoRow label="Licence Expiry" value={fmtDate(profile.licenseExpiryDate)} colors={colors} />
              <InfoRow label="Ghana Card"     value={profile.ghanaCardNumber} colors={colors} />
              <InfoRow label="Region"         value={profile.region} colors={colors} />
              <InfoRow label="City"           value={profile.city} colors={colors} />
              <InfoRow label="Address"        value={profile.address} colors={colors} />
              <InfoRow label="Verified"       value={profile.verifiedAt ? fmtDate(profile.verifiedAt) : 'Pending'} colors={colors} />
            </View>
          </>
        )}

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
  section:       { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  block:         { borderWidth: 1, borderRadius: 16, overflow: 'hidden', marginBottom: 20 },
  row:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1 },
  label:         { fontSize: 13 },
  value:         { fontSize: 13, fontWeight: '500', textAlign: 'right', flex: 1 },
  signOut:       { borderWidth: 1, borderRadius: 40, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  signOutText:   { fontWeight: '600', fontSize: 15 },
});
