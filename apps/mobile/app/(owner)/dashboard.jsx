import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity, Image } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../lib/theme';
import { useAuth, fmtGHS, fmtDate, greeting } from '../../lib/useAuth';
import { vehiclesApi, contractsApi, paymentsApi, notificationsApi } from '../../lib/api';
import { Badge, EmptyState, statusTone } from '../../components/ui';

const HERO_IMAGE = require('../../assets/hero-vehicles.jpg');

function QuickLink({ icon, label, sub, onPress, colors }) {
  return (
    <TouchableOpacity style={[s.link, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={onPress} activeOpacity={0.75} accessibilityRole="button">
      <View style={[s.linkIcon, { backgroundColor: colors.brandSoft }]}>
        <Ionicons name={icon} size={21} color={colors.brandText} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.linkLabel, { color: colors.textPrimary }]}>{label}</Text>
        <Text style={[s.linkSub, { color: colors.textMuted }]}>{sub}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function OwnerDashboard() {
  const { colors } = useTheme();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({ vehicles: 0, activeContracts: 0, recentPayments: 0 });
  const [recentPayments, setRecent] = useState([]);
  const [unread, setUnread] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [vRes, cRes, pRes, nRes] = await Promise.allSettled([
        vehiclesApi.list({ limit: 100 }),
        contractsApi.list({ limit: 100, status: 'ACTIVE' }),
        paymentsApi.list({ limit: 5 }),
        notificationsApi.list({ limit: 1, unreadOnly: true }),
      ]);
      setStats({
        vehicles: vRes.status === 'fulfilled' ? (vRes.value.data?.data?.vehicles || []).length : 0,
        activeContracts: cRes.status === 'fulfilled' ? (cRes.value.data?.data?.contracts || []).length : 0,
        recentPayments: pRes.status === 'fulfilled' ? (pRes.value.data?.data?.payments || []).length : 0,
      });
      setRecent(pRes.status === 'fulfilled' ? (pRes.value.data?.data?.payments || []) : []);
      setUnread(nRes.status === 'fulfilled' ? (nRes.value.data?.data?.pagination?.total || 0) : 0);
    } catch {}
    setFetching(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  if (loading || fetching) {
    return (
      <SafeAreaView style={[s.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Loading your fleet…</Text>
      </SafeAreaView>
    );
  }

  const totalReceived = recentPayments.filter((p) => p.status === 'SUCCESSFUL').reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const firstName = user?.firstName || 'there';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 36 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}>

        {/* Green greeting header */}
        <LinearGradient colors={['#0E9F6E', '#047857']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.header}>
          <SafeAreaView edges={['top']}>
            <View style={s.headerRow}>
              <View style={s.logoMark}>
                <Text style={s.logoText}>+</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.greeting}>{greeting()}</Text>
                <Text style={s.name} numberOfLines={1}>{firstName}</Text>
              </View>
              <TouchableOpacity style={s.headerBtn} onPress={() => router.push('/(owner)/notifications')} accessibilityRole="button" accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
                <Ionicons name="notifications-outline" size={21} color="#fff" />
                {unread > 0 && (
                  <View style={s.bellBadge}>
                    <Text style={s.bellBadgeText}>{unread > 9 ? '9+' : unread}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={s.headerBtn} onPress={() => router.push('/(owner)/profile')} accessibilityRole="button" accessibilityLabel="Help and settings">
                <Ionicons name="help-circle-outline" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* Floating summary card */}
        <View style={[s.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.summaryTop}>
            <View style={{ flex: 1 }}>
              <Text style={[s.summaryTitle, { color: colors.textPrimary }]}>Fleet account</Text>
              <Text style={[s.summarySub, { color: colors.textMuted }]}>
                {stats.vehicles === 0 ? 'Add your first vehicle to get started' : 'Your vehicles, contracts and earnings'}
              </Text>
            </View>
            <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.brandSoft }]} onPress={() => router.push('/(owner)/vehicles')} accessibilityRole="button" accessibilityLabel="Add a vehicle">
              <Ionicons name="add" size={22} color={colors.brandText} />
            </TouchableOpacity>
          </View>
          <View style={[s.summaryStats, { borderTopColor: colors.separator }]}>
            <View style={s.summaryStat}>
              <Text style={[s.summaryValue, { color: colors.textPrimary }]}>{stats.vehicles}</Text>
              <Text style={[s.summaryLabel, { color: colors.textMuted }]}>Vehicles</Text>
            </View>
            <View style={s.summaryStat}>
              <Text style={[s.summaryValue, { color: colors.textPrimary }]}>{stats.activeContracts}</Text>
              <Text style={[s.summaryLabel, { color: colors.textMuted }]}>Active contracts</Text>
            </View>
            <View style={s.summaryStat}>
              <Text style={[s.summaryValue, { color: colors.brandText }]}>{fmtGHS(totalReceived)}</Text>
              <Text style={[s.summaryLabel, { color: colors.textMuted }]}>Received</Text>
            </View>
          </View>
        </View>

        {/* Quick links */}
        <Text style={[s.section, { color: colors.textPrimary }]}>Quick Links</Text>
        <View style={s.grid}>
          <QuickLink icon="car-outline" label="My Vehicles" sub="Manage your fleet" colors={colors} onPress={() => router.push('/(owner)/vehicles')} />
          <QuickLink icon="card-outline" label="Payments" sub="Money you received" colors={colors} onPress={() => router.push('/(owner)/payments')} />
          <QuickLink icon="document-text-outline" label="Contracts" sub="Work & Pay, rentals" colors={colors} onPress={() => router.push('/(owner)/contracts')} />
          <QuickLink icon="navigate-outline" label="Track Vehicle" sub="Live locations" colors={colors} onPress={() => router.push('/(owner)/tracking')} />
        </View>

        {/* Promo banner */}
        <TouchableOpacity style={s.banner} activeOpacity={0.85} onPress={() => router.push('/(owner)/contracts')} accessibilityRole="button">
          <Image source={HERO_IMAGE} style={s.bannerImg} resizeMode="cover" />
          <View style={s.bannerShade} />
          <View style={s.bannerText}>
            <Text style={s.bannerKicker}>+MOTIVE CONTRACTS</Text>
            <Text style={s.bannerTitle}>Every agreement, witnessed and on record.</Text>
            <Text style={s.bannerCta}>View contracts →</Text>
          </View>
        </TouchableOpacity>

        {/* Recent payments */}
        <View style={s.rowBetween}>
          <Text style={[s.section, { color: colors.textPrimary, marginBottom: 0 }]}>Recent payments</Text>
          <TouchableOpacity onPress={() => router.push('/(owner)/payments')} hitSlop={10}>
            <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 14 }}>View all</Text>
          </TouchableOpacity>
        </View>
        {recentPayments.length === 0 ? (
          <View style={{ marginHorizontal: 20 }}>
            <EmptyState icon="card-outline" title="No payments yet" description="Payments from your drivers will appear here as soon as they are made." />
          </View>
        ) : (
          <View style={[s.payCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {recentPayments.map((p, i) => (
              <View key={p.id} style={[s.payRow, i < recentPayments.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.separator }]}>
                <View style={[s.payIcon, { backgroundColor: colors.brandSoft }]}>
                  <Ionicons name={p.status === 'SUCCESSFUL' ? 'arrow-down' : p.status === 'FAILED' ? 'close' : 'time-outline'} size={18} color={colors.brandText} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.payAmount, { color: colors.textPrimary }]}>{fmtGHS(p.amount)}</Text>
                  <Text style={[s.payDate, { color: colors.textMuted }]}>{fmtDate(p.createdAt)}</Text>
                </View>
                <Badge label={(p.status || '').replace(/_/g, ' ')} tone={statusTone(p.status)} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  header: { paddingHorizontal: 20, paddingBottom: 58, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 14 },
  logoMark: { width: 44, height: 44, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontWeight: '800', fontSize: 20 },
  greeting: { color: 'rgba(255,255,255,0.82)', fontSize: 13.5 },
  name: { color: '#fff', fontSize: 23, fontWeight: '800', letterSpacing: -0.3, marginTop: 1 },
  headerBtn: { width: 42, height: 42, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center' },
  bellBadge: { position: 'absolute', top: -6, right: -6, minWidth: 19, height: 19, borderRadius: 999, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  bellBadgeText: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
  summary: { marginHorizontal: 20, marginTop: -38, borderRadius: 20, borderWidth: 1, padding: 18, shadowColor: '#0B3D2A', shadowOpacity: 0.10, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  summaryTitle: { fontSize: 21, fontWeight: '800', letterSpacing: -0.3 },
  summarySub: { fontSize: 13.5, marginTop: 4, lineHeight: 19 },
  addBtn: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  summaryStats: { flexDirection: 'row', borderTopWidth: 1, marginTop: 16, paddingTop: 14 },
  summaryStat: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 17, fontWeight: '800' },
  summaryLabel: { fontSize: 11.5, marginTop: 3 },
  section: { fontSize: 16.5, fontWeight: '800', letterSpacing: -0.2, marginHorizontal: 20, marginTop: 24, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20, justifyContent: 'space-between' },
  link: { width: '48%', flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, padding: 13 },
  linkIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  linkLabel: { fontSize: 14, fontWeight: '700' },
  linkSub: { fontSize: 11.5, marginTop: 1 },
  banner: { marginHorizontal: 20, marginTop: 22, height: 158, borderRadius: 18, overflow: 'hidden' },
  bannerImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  bannerShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4, 26, 18, 0.55)' },
  bannerText: { position: 'absolute', left: 16, right: 16, bottom: 14 },
  bannerKicker: { color: '#A7F3D0', fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  bannerTitle: { color: '#fff', fontSize: 18.5, fontWeight: '800', lineHeight: 24, marginTop: 5 },
  bannerCta: { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 6, textDecorationLine: 'underline' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, marginTop: 24, marginBottom: 12 },
  payCard: { marginHorizontal: 20, borderWidth: 1, borderRadius: 16, paddingHorizontal: 8 },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 8 },
  payIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  payAmount: { fontSize: 15, fontWeight: '700' },
  payDate: { fontSize: 12.5, marginTop: 2 },
});
