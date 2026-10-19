import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity, Image } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../lib/theme';
import { useAuth, fmtGHS, fmtDate, greeting } from '../../lib/useAuth';
import { contractsApi, paymentsApi, notificationsApi, driversApi } from '../../lib/api';
import { Badge, EmptyState, ProgressBar, statusTone } from '../../components/ui';

const HERO_IMAGE = require('../../assets/hero-vehicles.jpg');

function QuickLink({ icon, label, onPress, colors, badge }) {
  return (
    <TouchableOpacity style={[s.link, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={onPress} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={label}>
      <View style={[s.linkIcon, { backgroundColor: colors.brandSoft }]}>
        <Ionicons name={icon} size={21} color={colors.brandText} />
        {badge ? <View style={s.linkBadge}><Text style={s.linkBadgeText}>{badge}</Text></View> : null}
      </View>
      <Text style={[s.linkLabel, { color: colors.textPrimary, flex: 1 }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function DriverDashboard() {
  const { colors } = useTheme();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [contract, setContract] = useState(null);
  const [payments, setPayments] = useState([]);
  const [unread, setUnread] = useState(0);
  const [kyc, setKyc] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [cRes, pRes, nRes, dRes] = await Promise.allSettled([
        contractsApi.list({ limit: 1, status: 'ACTIVE' }),
        paymentsApi.list({ limit: 5 }),
        notificationsApi.list({ limit: 1, unreadOnly: true }),
        driversApi.getMyProfile(),
      ]);
      if (cRes.status === 'fulfilled') setContract((cRes.value.data?.data?.contracts || [])[0] || null);
      if (pRes.status === 'fulfilled') setPayments(pRes.value.data?.data?.payments || []);
      if (nRes.status === 'fulfilled') setUnread(nRes.value.data?.data?.pagination?.total || 0);
      if (dRes.status === 'fulfilled') setKyc(dRes.value.data?.data?.driver || dRes.value.data?.data || null);
    } catch {}
    setFetching(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  if (loading || fetching) {
    return (
      <SafeAreaView style={[s.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Loading your dashboard…</Text>
      </SafeAreaView>
    );
  }

  const wap = contract?.workAndPayTerms;
  const total = Number(wap?.totalAmount ?? wap?.totalPayable ?? 0);
  const paid = Number(wap?.totalPaid ?? 0);
  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
  const firstName = user?.firstName || 'there';
  const kycStatus = kyc?.status;
  const kycDone = kycStatus === 'VERIFIED' || kycStatus === 'ACTIVE';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 36 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}>

        {/* Green greeting header */}
        <LinearGradient colors={['#17B978', '#067647']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.header}>
          <SafeAreaView edges={['top']}>
            <View style={s.headerBtns}>
              <TouchableOpacity style={s.headerBtn} onPress={() => router.push('/(driver)/notifications')} accessibilityRole="button" accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
                <Ionicons name="notifications-outline" size={21} color="#fff" />
                {unread > 0 && (
                  <View style={s.bellBadge}>
                    <Text style={s.bellBadgeText}>{unread > 9 ? '9+' : unread}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={s.headerBtn} onPress={() => router.push('/(driver)/profile')} accessibilityRole="button" accessibilityLabel="Help and settings">
                <Ionicons name="help-circle-outline" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={s.headerRow}>
              <View style={s.logoMark}>
                <Text style={s.logoText}>+</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.greeting}>{greeting()}</Text>
                <Text style={s.name} numberOfLines={1}>{firstName}</Text>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* Floating summary card */}
        <View style={[s.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.summaryTop}>
            <View style={{ flex: 1 }}>
              <Text style={[s.summaryTitle, { color: colors.textPrimary }]}>Driver account</Text>
              <Text style={[s.summarySub, { color: colors.textMuted }]}>
                {contract ? (contract.contractNumber || 'Your active Work & Pay contract') : 'No active contract yet — your plan appears here when an owner assigns you a vehicle'}
              </Text>
            </View>
            {contract ? <Badge label={(contract.status || 'ACTIVE').replace(/_/g, ' ')} tone={statusTone(contract.status)} /> : null}
          </View>
          <View style={[s.summaryStats, { borderTopColor: colors.separator }]}>
            <View style={s.summaryStat}>
              <Text style={[s.summaryValue, { color: colors.textPrimary }]}>{fmtGHS(paid)}</Text>
              <Text style={[s.summaryLabel, { color: colors.textMuted }]}>Total paid</Text>
            </View>
            <View style={s.summaryStat}>
              <Text style={[s.summaryValue, { color: colors.textPrimary }]}>{fmtGHS(wap?.remainingBalance ?? Math.max(0, total - paid))}</Text>
              <Text style={[s.summaryLabel, { color: colors.textMuted }]}>Remaining</Text>
            </View>
            <View style={s.summaryStat}>
              <Text style={[s.summaryValue, { color: colors.brandText }]}>{fmtGHS(wap?.installmentAmount ?? 0)}</Text>
              <Text style={[s.summaryLabel, { color: colors.textMuted }]}>Next payment</Text>
            </View>
          </View>
          {contract && total > 0 && (
            <View style={{ marginTop: 16 }}>
              <ProgressBar value={pct} />
              <Text style={[s.progressNote, { color: colors.textSecondary }]}>{Math.round(pct)}% of {fmtGHS(total)} paid — you are on track.</Text>
            </View>
          )}
          {contract && (
            <TouchableOpacity style={[s.payBtn, { backgroundColor: colors.ctaBg }]} onPress={() => router.push('/(driver)/payments')} activeOpacity={0.85} accessibilityRole="button">
              <Ionicons name="card-outline" size={19} color="#fff" />
              <Text style={s.payBtnText}>Make a payment</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* KYC reminder */}
        {kyc && !kycDone && (
          <TouchableOpacity style={[s.kyc, { backgroundColor: colors.brandSoft, borderColor: colors.border }]} onPress={() => router.push('/(driver)/profile')} activeOpacity={0.8} accessibilityRole="button">
            <View style={[s.linkIcon, { backgroundColor: colors.card }]}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.brandText} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.linkLabel, { color: colors.textPrimary }]}>{kycStatus === 'PENDING_VERIFICATION' ? 'Identity verification pending' : 'Complete your driver verification'}</Text>
              <Text style={[s.linkSub, { color: colors.textMuted }]}>{kycStatus === 'PENDING_VERIFICATION' ? 'We are checking your licence and Ghana Card' : 'Add your licence and Ghana Card to get verified'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}

        {/* Quick links */}
        <Text style={[s.section, { color: colors.textPrimary }]}>Quick Links</Text>
        <View style={s.grid}>
          <QuickLink icon="card-outline" label="Make Payment" sub="Pay your instalment" colors={colors} onPress={() => router.push('/(driver)/payments')} />
          <QuickLink icon="document-text-outline" label="My Contract" sub="Work & Pay terms" colors={colors} onPress={() => router.push('/(driver)/contract')} />
          <QuickLink icon="car-outline" label="My Vehicle" sub="Assigned vehicle" colors={colors} onPress={() => router.push('/(driver)/vehicle')} />
          <QuickLink icon="warning-outline" label="Incidents" sub="Report an incident" colors={colors} onPress={() => router.push('/(driver)/incidents')} />
          <QuickLink icon="build-outline" label="Maintenance" sub="Report a problem" colors={colors} onPress={() => router.push('/(driver)/maintenance')} />
          <QuickLink icon="notifications-outline" label="Alerts" sub="Payments & updates" colors={colors} badge={unread > 0 ? String(unread > 9 ? '9+' : unread) : null} onPress={() => router.push('/(driver)/notifications')} />
        </View>

        {/* Promo banner */}
        <TouchableOpacity style={s.banner} activeOpacity={0.85} onPress={() => router.push('/(driver)/contract')} accessibilityRole="button">
          <Image source={HERO_IMAGE} style={s.bannerImg} resizeMode="cover" />
          <View style={s.bannerShade} />
          <View style={s.bannerText}>
            <Text style={s.bannerKicker}>+MOTIVE WORK &amp; PAY</Text>
            <Text style={s.bannerTitle}>Drive today. Own it tomorrow.</Text>
            <Text style={s.bannerCta}>View my contract →</Text>
          </View>
        </TouchableOpacity>

        {/* Recent payments */}
        <View style={s.rowBetween}>
          <Text style={[s.section, { color: colors.textPrimary, marginBottom: 0 }]}>Recent payments</Text>
          <TouchableOpacity onPress={() => router.push('/(driver)/payments')} hitSlop={10}>
            <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 14 }}>View all</Text>
          </TouchableOpacity>
        </View>
        {payments.length === 0 ? (
          <View style={{ marginHorizontal: 20 }}>
            <EmptyState icon="card-outline" title="No payments yet" description="Payments you make will show here with their status and receipt date." />
          </View>
        ) : (
          <View style={[s.payCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {payments.map((p, i) => (
              <View key={p.id} style={[s.payRow, i < payments.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.separator }]}>
                <View style={[s.payIcon, { backgroundColor: colors.brandSoft }]}>
                  <Ionicons name={p.status === 'SUCCESSFUL' ? 'arrow-up' : p.status === 'FAILED' ? 'close' : 'time-outline'} size={18} color={colors.brandText} />
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
  header: { paddingHorizontal: 20, paddingBottom: 62 },
  headerBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingTop: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 14 },
  logoMark: { width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontWeight: '800', fontSize: 22 },
  greeting: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  name: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.3, marginTop: 1 },
  headerBtn: { width: 42, height: 42, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center' },
  bellBadge: { position: 'absolute', top: -6, right: -6, minWidth: 19, height: 19, borderRadius: 999, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  bellBadgeText: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
  summary: { marginHorizontal: 20, marginTop: -40, borderRadius: 18, borderWidth: 1, padding: 22, shadowColor: '#0B3D2A', shadowOpacity: 0.10, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  summaryTitle: { fontSize: 27, fontWeight: '800', letterSpacing: -0.4 },
  summarySub: { fontSize: 13.5, marginTop: 5, lineHeight: 19, fontWeight: '600' },
  summaryStats: { flexDirection: 'row', borderTopWidth: 1, marginTop: 16, paddingTop: 14 },
  summaryStat: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 15.5, fontWeight: '800' },
  summaryLabel: { fontSize: 11.5, marginTop: 3 },
  progressNote: { fontSize: 13, marginTop: 8 },
  payBtn: { marginTop: 16, minHeight: 50, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  payBtnText: { color: '#fff', fontSize: 15.5, fontWeight: '700' },
  kyc: { marginHorizontal: 20, marginTop: 20, borderWidth: 1, borderRadius: 16, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  section: { fontSize: 16.5, fontWeight: '800', letterSpacing: -0.2, marginHorizontal: 20, marginTop: 24, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20, justifyContent: 'space-between' },
  link: { width: '48%', flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderRadius: 16, padding: 13, minHeight: 72, shadowColor: '#0B3D2A', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  linkIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  linkBadge: { position: 'absolute', top: -5, right: -5, minWidth: 17, height: 17, borderRadius: 999, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  linkBadgeText: { color: '#fff', fontSize: 9.5, fontWeight: '800' },
  linkLabel: { fontSize: 15, fontWeight: '700', lineHeight: 19 },
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
