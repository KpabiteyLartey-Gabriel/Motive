/**
 * Animated +Motive splash.
 * The master logo is a flat image (the supplied SVG wraps a JPEG), so the
 * moving parts are live layers over the real logo: both tyres rotate, the
 * location pin slowly zooms in and out, and the QR-code plus pops out and
 * settles back. Shows briefly on launch, then fades away.
 */
import { View, Text, Image, StyleSheet, Animated, Easing, Dimensions, AccessibilityInfo } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { MOTIVE_LOGO, LOGO_GREEN } from './BrandLogo';

const { width: SCREEN_W } = Dimensions.get('window');
const LOGO_SIZE = Math.min(SCREEN_W * 0.88, 380);

// Parts of the master logo, as fractions of its square size (measured on
// the 2000x2000 motive-logo master).
const WHEELS = [
  { cx: 0.38, cy: 0.702 },
  { cx: 0.81, cy: 0.702 },
];
const PIN = { cx: 0.73, cy: 0.495, size: 0.15 };
const QR_PLUS = { cx: 0.208, cy: 0.281, size: 0.17 };

function LogoCrop({ cx, cy, sizeFrac, transform, rounded = false }) {
  const box = LOGO_SIZE * sizeFrac;
  const left = (cx - sizeFrac / 2) * LOGO_SIZE;
  const top = (cy - sizeFrac / 2) * LOGO_SIZE;
  return (
    <Animated.View style={{ position: 'absolute', left, top, width: box, height: box, transform }}>
      <View style={{ flex: 1, overflow: 'hidden', borderRadius: rounded ? box / 2 : 0, backgroundColor: LOGO_GREEN }}>
        <Image
          source={MOTIVE_LOGO}
          style={{ position: 'absolute', left: -left, top: -top, width: LOGO_SIZE, height: LOGO_SIZE }}
          resizeMode="cover"
        />
      </View>
    </Animated.View>
  );
}

export default function AnimatedSplash() {
  const [gone, setGone] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const wheelSpin = useRef(new Animated.Value(0)).current;
  const pinZoom = useRef(new Animated.Value(0)).current;
  const plusPop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loops = [];
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled || reduced) return;
      const wheel = Animated.loop(
        Animated.timing(wheelSpin, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true })
      );
      const pin = Animated.loop(
        Animated.sequence([
          Animated.timing(pinZoom, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pinZoom, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      const plus = Animated.loop(
        Animated.sequence([
          Animated.timing(plusPop, { toValue: 1, duration: 650, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(plusPop, { toValue: 0, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.delay(700),
        ])
      );
      loops = [wheel, pin, plus];
      loops.forEach((l) => l.start());
    }).catch(() => {});

    const dismiss = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 380, useNativeDriver: true }).start(() => setGone(true));
    }, 2500);

    return () => { cancelled = true; loops.forEach((l) => l.stop()); clearTimeout(dismiss); };
  }, [fade, wheelSpin, pinZoom, plusPop]);

  if (gone) return null;

  const wheelRotate = wheelSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const pinScale = pinZoom.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });
  const plusScale = plusPop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.17] });
  const wheelBox = LOGO_SIZE * 0.112;

  return (
    <Animated.View style={[s.root, { opacity: fade }]} accessibilityLabel="+Motive is loading">
      <View style={s.logoWrap}>
        <Image source={MOTIVE_LOGO} style={s.logo} resizeMode="cover" />

        {/* Tyres — rotating dashed rings over both wheels */}
        {WHEELS.map((w, i) => (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: w.cx * LOGO_SIZE - wheelBox / 2,
              top: w.cy * LOGO_SIZE - wheelBox / 2,
              width: wheelBox,
              height: wheelBox,
              borderRadius: wheelBox / 2,
              borderWidth: Math.max(3, LOGO_SIZE * 0.007),
              borderStyle: 'dashed',
              borderColor: 'rgba(255,255,255,0.95)',
              transform: [{ rotate: wheelRotate }],
            }}
          />
        ))}

        {/* Location pin — slow zoom in and out */}
        <LogoCrop cx={PIN.cx} cy={PIN.cy} sizeFrac={PIN.size} transform={[{ scale: pinScale }]} />

        {/* QR-code plus — pops out clear, then settles back */}
        <LogoCrop cx={QR_PLUS.cx} cy={QR_PLUS.cy} sizeFrac={QR_PLUS.size} transform={[{ scale: plusScale }]} />
      </View>

      <Text style={s.wordmark}>+Motive</Text>
      <Text style={s.tagline}>Positive Motive — drive, earn, own.</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: LOGO_GREEN, alignItems: 'center', justifyContent: 'center', zIndex: 50, elevation: 50 },
  logoWrap: { width: LOGO_SIZE, height: LOGO_SIZE, borderRadius: LOGO_SIZE * 0.2, overflow: 'hidden' },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
  wordmark: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', letterSpacing: -0.5, marginTop: 22 },
  tagline: { color: 'rgba(255,255,255,0.78)', fontSize: 13.5, marginTop: 5 },
});
