import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import SecureStore from '../../lib/storage';
import { useTheme, palette } from '../../lib/theme';
import { useAuth } from '../../lib/useAuth';
import { accountsApi, authApi } from '../../lib/api';
import { Card, Badge } from '../../components/ui';

const ACCOUNT_LABELS = { DRIVER: 'Driver', OWNER: 'Owner', SERVICE_PROVIDER: 'Service Provider', COMPANY: 'Company' };
// "Sign in as" targets: where each created account opens on mobile.
// Company has no mobile dashboard yet, so it stays web-only for now.
const SIGN_IN_ROUTES = { DRIVER: '/(driver)/dashboard', OWNER: '/(owner)/dashboard', SERVICE_PROVIDER: '/(user)/home' };

// My Accounts: the base User account plus any Driver/Owner/Service
// Provider/Company accounts this person holds.
export default function UserAccounts() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [meUser, setMeUser] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [signingIn, setSigningIn] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await accountsApi.me().catch(() => null);
      const data = r?.data?.data || r?.data;
      setAccounts(data?.accounts || []);
      if (data?.user) setMeUser(data.user);
    } catch {}
    setFetching(false);
    setRefreshing(false);
  }, []);

  // Sign in as an account: refresh the session so the new role is in the
  // token and on this device, then open that account's dashboard. If the
  // refresh fails we still open it — signing out and back in also works.
  const signInAs = async (a) => {
    const route = SIGN_IN_ROUTES[a.kind];
    if (!route) return;
    setSigningIn(a.kind);
    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      if (refreshToken) {
        const res = await authApi.refresh(refreshToken).catch(() => null);
        const tokens = res?.data?.data || res?.data;
        if (tokens?.accessToken) await SecureStore.setItemAsync('accessToken', tokens.accessToken);
        if (tokens?.refreshToken) await SecureStore.setItemAsync('refreshToken', tokens.refreshToken);
      }
      const fresh = meUser || user;
      if (fresh) {
        const stored = JSON.parse((await SecureStore.getItemAsync('user')) || '{}');
        await SecureStore.setItemAsync('user', JSON.stringify({ ...stored, ...fresh }));
      }
    } catch {}
    setSigningIn('');
    router.replace(route);
  };

  useEffect(() => { if (user) load(); }, [user, load]);

  const name = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'User';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <Card style={s.card}>
          <View style={s.rowBetween}>
            <Text style={[s.cardTitle, { color: colors.textPrimary }]}>User account</Text>
            <Badge label="User" tone="neutral" />
          </View>
          <Text style={[s.name, { color: colors.textPrimary }]}>{name}</Text>
          <Text style={[s.meta, { color: colors.textSecondary }]}>{user?.email || user?.phone || ''}</Text>
        </Card>

        <Text style={[s.section, { color: colors.textSecondary }]}>Your accounts</Text>
        {fetching ? (
          <ActivityIndicator color={palette.brand} style={{ marginTop: 20 }} />
        ) : accounts.length === 0 ? (
          <Card style={s.card}>
            <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>No added accounts yet</Text>
            <Text style={[s.meta, { color: colors.textSecondary, marginTop: 4, lineHeight: 19 }]}>
              Driver, Owner, Service Provider and Company accounts you add will appear here.
            </Text>
          </Card>
        ) : (
          accounts.map((a) => (
            <Card key={a.kind} style={s.card}>
              <View style={s.rowBetween}>
                <Text style={[s.cardTitle, { color: colors.textPrimary }]}>{ACCOUNT_LABELS[a.kind] || a.kind} account</Text>
                <Badge label={a.status === 'NOT_CREATED' ? 'Not created' : a.status || 'PENDING'} tone={a.status === 'VERIFIED' || a.status === 'ACTIVE' ? 'success' : 'warning'} />
              </View>
              {a.companyName ? <Text style={[s.meta, { color: colors.textSecondary }]}>{a.companyName}</Text> : null}
              {a.status === 'NOT_CREATED' && (a.kind === 'DRIVER' || a.kind === 'OWNER') && (
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/(user)/add-account', params: { kind: a.kind } })}
                  style={[s.addBtn, { backgroundColor: palette.brand }]}
                  accessibilityRole="button"
                >
                  <Text style={s.addBtnText}>Add {ACCOUNT_LABELS[a.kind]} account</Text>
                </TouchableOpacity>
              )}
              {a.status !== 'NOT_CREATED' && SIGN_IN_ROUTES[a.kind] && (
                <TouchableOpacity
                  onPress={() => signInAs(a)}
                  disabled={signingIn === a.kind}
                  style={[s.addBtn, { backgroundColor: palette.brand, opacity: signingIn === a.kind ? 0.6 : 1 }]}
                  accessibilityRole="button"
                >
                  <Text style={s.addBtnText}>
                    {signingIn === a.kind
                      ? 'Signing in…'
                      : (meUser?.primaryRole || user?.primaryRole) === a.kind
                        ? `Open ${ACCOUNT_LABELS[a.kind]} dashboard`
                        : `Sign in as ${ACCOUNT_LABELS[a.kind]}`}
                  </Text>
                </TouchableOpacity>
              )}
              {a.status !== 'NOT_CREATED' && a.kind === 'COMPANY' && (
                <Text style={[s.meta, { color: colors.textMuted, marginTop: 10 }]}>Company dashboards open on the web app for now.</Text>
              )}
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  card: { padding: 18, marginBottom: 14 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  cardTitle: { fontSize: 15.5, fontWeight: '700' },
  name: { fontSize: 16, fontWeight: '700', marginTop: 10 },
  meta: { fontSize: 13.5, marginTop: 2 },
  section: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 8, marginBottom: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '700' },
  addBtn: { borderRadius: 24, paddingVertical: 11, alignItems: 'center', marginTop: 14 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
