import { View, Text, ImageBackground, TouchableOpacity, StyleSheet, StatusBar, Animated } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme';
import { PrimaryButton } from '../components/ui';

const HERO_IMAGE = require('../assets/hero-vehicles.jpg');
const SLIDE_MS = 2800;

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
  const navigatedRef = useRef(false);
  const fade = useRef(new Animated.Value(1)).current;

  const goToLogin = () => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    router.replace('/(auth)/login');
  };

  // Carousel: advance every few seconds, then continue to sign in
  useEffect(() => {
    const timer = setInterval(() => {
      setSlide((prev) => {
        if (prev >= SLIDES.length - 1) {
          clearInterval(timer);
          setTimeout(goToLogin, SLIDE_MS);
          return prev;
        }
        return prev + 1;
      });
    }, SLIDE_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fade each slide caption in
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, [slide, fade]);

  const current = SLIDES[slide];

  return (
    <ImageBackground source={HERO_IMAGE} style={s.background} resizeMode="cover">
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={s.overlay} />
      <SafeAreaView style={s.safe}>
        <View style={s.brandRow}>
          <View style={[s.logo, { backgroundColor: colors.brand }]}>
            <Text style={s.logoText}>+</Text>
          </View>
          <View>
            <Text style={s.appName}>+Motive</Text>
            <Text style={s.tagline}>Positive Motive · Ghana</Text>
          </View>
          <TouchableOpacity onPress={goToLogin} hitSlop={10} style={s.skip} accessibilityRole="button">
            <Text style={s.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        <View style={s.bottom}>
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

          <View style={{ gap: 12, marginTop: 22 }}>
            <PrimaryButton title="Create free account" onPress={() => router.push('/(auth)/register')} />
            <TouchableOpacity onPress={goToLogin} style={s.loginButton} accessibilityRole="button">
              <Text style={s.loginButtonText}>I already have an account</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.footer}>Secure · Transparent · Built for Ghana</Text>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#04150F' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4, 21, 15, 0.52)' },
  safe: { flex: 1, paddingHorizontal: 20, paddingBottom: 28 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  logo: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontWeight: '800', fontSize: 22 },
  appName: { color: '#fff', fontWeight: '800', fontSize: 22, letterSpacing: -0.4 },
  tagline: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 1 },
  skip: { marginLeft: 'auto', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)' },
  skipText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  bottom: { marginTop: 'auto' },
  slideTitle: { color: '#fff', fontSize: 31, fontWeight: '800', lineHeight: 38, letterSpacing: -0.5 },
  slideText: { color: 'rgba(255,255,255,0.85)', fontSize: 16, lineHeight: 24, marginTop: 10 },
  dots: { flexDirection: 'row', gap: 8, marginTop: 20 },
  dot: { height: 8, borderRadius: 999 },
  dotActive: { width: 28, backgroundColor: '#10B981' },
  dotIdle: { width: 8, backgroundColor: 'rgba(255,255,255,0.45)' },
  loginButton: { alignItems: 'center', justifyContent: 'center', minHeight: 52, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.75)', backgroundColor: 'rgba(255,255,255,0.10)' },
  loginButtonText: { color: '#fff', fontWeight: '700', fontSize: 15.5 },
  footer: { textAlign: 'center', color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 18 },
});
