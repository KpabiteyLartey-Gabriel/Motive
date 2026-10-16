import { View, Text, ScrollView, StatusBar, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';
import { PrimaryButton, SecondaryButton, Card, Badge } from '../components/ui';

const FEATURES = [
  { icon: 'document-text-outline', text: 'Work & Pay, Rental & Driving On contracts' },
  { icon: 'card-outline', text: 'MTN MoMo secure payments with receipts' },
  { icon: 'car-outline', text: 'Full fleet and vehicle management' },
  { icon: 'stats-chart-outline', text: 'Real-time earnings and reports' },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { isDark, colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.brandRow}>
          <View style={[s.logo, { backgroundColor: colors.brand }]}>
            <Text style={s.logoText}>+</Text>
          </View>
          <View>
            <Text style={[s.appName, { color: colors.textPrimary }]}>+Motive</Text>
            <Text style={[s.tagline, { color: colors.textSecondary }]}>Vehicle Operations & Fleet Management</Text>
          </View>
        </View>

        <Badge label="Built for Ghana" tone="success" />
        <Text style={[s.title, { color: colors.textPrimary }]}>Vehicle work, payments and contracts — clear at a glance.</Text>
        <Text style={[s.subtitle, { color: colors.textSecondary }]}>
          Transparent contracts, secure MoMo payments and a complete audit trail for drivers, owners and companies.
        </Text>

        <Card style={{ marginTop: 24, gap: 4 }}>
          {FEATURES.map((f) => (
            <View key={f.text} style={s.feature}>
              <View style={[s.featureIcon, { backgroundColor: colors.brandSoft }]}>
                <Ionicons name={f.icon} size={20} color={colors.brandText} />
              </View>
              <Text style={[s.featureText, { color: colors.textPrimary }]}>{f.text}</Text>
            </View>
          ))}
        </Card>

        <View style={{ gap: 12, marginTop: 28 }}>
          <PrimaryButton title="Create free account" onPress={() => router.push('/(auth)/register')} />
          <SecondaryButton title="I already have an account" onPress={() => router.push('/(auth)/login')} />
        </View>
        <Text style={[s.footer, { color: colors.textMuted }]}>Secure · Transparent · No card required to start</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 20, paddingTop: 28, paddingBottom: 32 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 28 },
  logo: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  appName: { fontWeight: '800', fontSize: 22, letterSpacing: -0.4 },
  tagline: { fontSize: 13, marginTop: 1 },
  title: { fontSize: 30, fontWeight: '800', lineHeight: 38, letterSpacing: -0.5, marginTop: 14 },
  subtitle: { fontSize: 16, lineHeight: 24, marginTop: 10 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  featureIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  featureText: { fontSize: 15, flex: 1, lineHeight: 20 },
  footer: { textAlign: 'center', fontSize: 13, marginTop: 20 },
});
