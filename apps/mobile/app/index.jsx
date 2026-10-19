import { View, Text, Image, TouchableOpacity, StyleSheet, StatusBar, Animated } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme';
import { PrimaryButton } from '../components/ui';
import BrandLogo from '../components/BrandLogo';

const HERO_IMAGE = require('../assets/hero-vehicles.jpg');
const SLIDE_MS = 3200;

const SLIDES = [
  {
    title: 'Run vehicle work without the guesswork.',
    text: 'Cars, contracts and payments — managed from one transparent record.',
  },
  {
    title: 'Work & Pay, Rental and Driving On.',
    text: 'Clear contracts both sides can follow, with MoMo payments and receipts.',
  },
  {
    title: 'Built for Ghana’s transport sector.',
    text: 'For drivers, vehicle owners, transport companies, fleet managers and legal professionals.',
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [slide, setSlide] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  // Captions rotate on their own, but the screen never moves by itself —
  // the user chooses when to continue.
  useEffect(() => {
    const timer = setInterval(() => {
      setSlide((prev) => (prev + 1) % SLIDES.length);
    }, SLIDE_MS);
    return () => clearInterval(timer);
  }, []);

  // Fade each slide caption in
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, [slide, fade]);

  const current = SLIDES[slide];
  const goToLogin = () => router.replace('/(auth)/login');

  return (
    <View style={s.background}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Vehicles image — fitted to its full width so nothing is zoomed in */}
      <View style={s.imageWrap}>
        <Image source={HERO_IMAGE} style={s.image} resizeMode="cover" accessibilityLabel="Cars, truck, motorcycle and tricycle managed on +Motive" />
        <View style={s.imageShade} />
        <SafeAreaView style={s.brandSafe} edges={['top']}>
          <View style={s.brandRow}>
            <BrandLogo size={52} />
            <View>
              <Text style={s.appName}>+Motive</Text>
              <Text style={s.tagline}>Positive Motive · Ghana</Text>
            </View>
            <TouchableOpacity onPress={goToLogin} hitSlop={10} style={s.skip} accessibilityRole="button">
              <Text style={s.skipText}>Skip</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>

      {/* Captions + actions */}
      <SafeAreaView style={s.contentSafe} edges={['bottom']}>
        <View style={s.content}>
          <Animated.View style={{ opacity: fade }}>
            <Text style={s.slideTitle}>{current.title}</Text>
            <Text style={s.slideText}>{current.text}</Text>
          </Animated.View>

          <View style={s.dots}>
            {SLIDES.map((item, i) => (
              <TouchableOpacity key={item.title} onPress={() => setSlide(i)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Show slide ${i + 1}`}>
                <View style={[s.dot, i === slide ? s.dotActive : s.dotIdle]} />
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ gap: 12, marginTop: 24 }}>
            <PrimaryButton title="Create free account" onPress={() => router.push('/(auth)/register')} />
            <TouchableOpacity onPress={goToLogin} style={s.loginButton} accessibilityRole="button">
              <Text style={s.loginButtonText}>I already have an account</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.footer}>Secure · Transparent · Built for Ghana</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#04150F' },
  imageWrap: { width: '100%', aspectRatio: 1181 / 896, backgroundColor: '#04150F' },
  image: { width: '100%', height: '100%' },
  imageShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4, 21, 15, 0.18)' },
  brandSafe: { position: 'absolute', top: 0, left: 0, right: 0 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, marginTop: 10 },
  logo: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontWeight: '800', fontSize: 22 },
  appName: { color: '#fff', fontWeight: '800', fontSize: 22, letterSpacing: -0.4 },
  tagline: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 1 },
  skip: { marginLeft: 'auto', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(4,21,15,0.45)' },
  skipText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  contentSafe: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 26, paddingBottom: 28 },
  slideTitle: { color: '#fff', fontSize: 30, fontWeight: '800', lineHeight: 37, letterSpacing: -0.5 },
  slideText: { color: 'rgba(255,255,255,0.82)', fontSize: 16, lineHeight: 24, marginTop: 10 },
  dots: { flexDirection: 'row', gap: 8, marginTop: 20 },
  dot: { height: 8, borderRadius: 999 },
  dotActive: { width: 28, backgroundColor: '#10B981' },
  dotIdle: { width: 8, backgroundColor: 'rgba(255,255,255,0.4)' },
  loginButton: { alignItems: 'center', justifyContent: 'center', minHeight: 52, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.65)', backgroundColor: 'rgba(255,255,255,0.08)' },
  loginButtonText: { color: '#fff', fontWeight: '700', fontSize: 15.5 },
  footer: { textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 'auto', paddingTop: 18 },
});
