import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import { useAuth, fmtDate, greeting } from '../../lib/useAuth';
import { Card, Badge } from '../../components/ui';
import BrandLogo from '../../components/BrandLogo';
import ProfilePicture from '../../components/ProfilePicture';

// Settings (last tab): the plain User's account details and sign out.
export default function UserSettings() {
  const { colors } = useTheme();
  const { user, logout } = useAuth();

  const name = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'User';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <BrandLogo size={44} />
          <View style={{ flex: 1 }}>
            <Text style={[s.greeting, { color: colors.textSecondary }]}>{greeting()},</Text>
            <Text style={[s.name, { color: colors.textPrimary }]}>{name}</Text>
          </View>
          <Badge label="User" tone="neutral" />
        </View>

        <Card style={s.card}>
          <ProfilePicture user={user} accountLabel="User" />
        </Card>

        <Card style={s.card}>
          <Text style={[s.cardTitle, { color: colors.textPrimary }]}>Your account</Text>
          <View style={s.row}>
            <Text style={[s.label, { color: colors.textSecondary }]}>Account type</Text>
            <Text style={[s.value, { color: colors.textPrimary }]}>User</Text>
          </View>
          <View style={s.row}>
            <Text style={[s.label, { color: colors.textSecondary }]}>Email</Text>
            <Text style={[s.value, { color: colors.textPrimary }]}>{user?.email || '—'}</Text>
          </View>
          <View style={s.row}>
            <Text style={[s.label, { color: colors.textSecondary }]}>Phone</Text>
            <Text style={[s.value, { color: colors.textPrimary }]}>{user?.phone || '—'}</Text>
          </View>
          <View style={s.row}>
            <Text style={[s.label, { color: colors.textSecondary }]}>Email verified</Text>
            <Badge label={user?.emailVerifiedAt ? 'Verified' : 'Pending'} tone={user?.emailVerifiedAt ? 'success' : 'warning'} />
          </View>
          <View style={s.row}>
            <Text style={[s.label, { color: colors.textSecondary }]}>Member since</Text>
            <Text style={[s.value, { color: colors.textPrimary }]}>{fmtDate(user?.createdAt)}</Text>
          </View>
        </Card>

        <TouchableOpacity style={[s.signOut, { borderColor: colors.border }]} onPress={logout} activeOpacity={0.7} accessibilityRole="button">
          <Text style={s.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 20, paddingTop: 24, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 },
  greeting: { fontSize: 13.5 },
  name: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  card: { padding: 18 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16, paddingVertical: 7 },
  label: { fontSize: 14 },
  value: { fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  signOut: { borderWidth: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 22 },
  signOutText: { color: '#DC2626', fontWeight: '700', fontSize: 15 },
});
