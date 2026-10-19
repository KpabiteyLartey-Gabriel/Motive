/**
 * Animated +Motive splash — plays the owner's logo_animation video as a
 * frame sequence (the video codec does not play reliably on phones, so the
 * app ships its frames: tyres rotating, location pin zooming, QR plus).
 * The native static splash shows frame 1 on the same background, so the
 * animation continues seamlessly when this overlay mounts.
 */
import { View, Text, Image, StyleSheet, Animated, Dimensions, AccessibilityInfo } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { BrandName } from './BrandLogo';

const { width: SCREEN_W } = Dimensions.get('window');
const LOGO_SIZE = Math.min(SCREEN_W * 0.88, 380);
const FRAME_MS = 83; // 30 frames ≈ 2.5s, matching the 5s video at 2x

const FRAMES = [
  require('../assets/splash-frames/frame-01.jpg'),
  require('../assets/splash-frames/frame-02.jpg'),
  require('../assets/splash-frames/frame-03.jpg'),
  require('../assets/splash-frames/frame-04.jpg'),
  require('../assets/splash-frames/frame-05.jpg'),
  require('../assets/splash-frames/frame-06.jpg'),
  require('../assets/splash-frames/frame-07.jpg'),
  require('../assets/splash-frames/frame-08.jpg'),
  require('../assets/splash-frames/frame-09.jpg'),
  require('../assets/splash-frames/frame-10.jpg'),
  require('../assets/splash-frames/frame-11.jpg'),
  require('../assets/splash-frames/frame-12.jpg'),
  require('../assets/splash-frames/frame-13.jpg'),
  require('../assets/splash-frames/frame-14.jpg'),
  require('../assets/splash-frames/frame-15.jpg'),
  require('../assets/splash-frames/frame-16.jpg'),
  require('../assets/splash-frames/frame-17.jpg'),
  require('../assets/splash-frames/frame-18.jpg'),
  require('../assets/splash-frames/frame-19.jpg'),
  require('../assets/splash-frames/frame-20.jpg'),
  require('../assets/splash-frames/frame-21.jpg'),
  require('../assets/splash-frames/frame-22.jpg'),
  require('../assets/splash-frames/frame-23.jpg'),
  require('../assets/splash-frames/frame-24.jpg'),
  require('../assets/splash-frames/frame-25.jpg'),
  require('../assets/splash-frames/frame-26.jpg'),
  require('../assets/splash-frames/frame-27.jpg'),
  require('../assets/splash-frames/frame-28.jpg'),
  require('../assets/splash-frames/frame-29.jpg'),
  require('../assets/splash-frames/frame-30.jpg'),
];

export default function AnimatedSplash() {
  const [gone, setGone] = useState(false);
  const [frame, setFrame] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let interval = null;
    let cancelled = false;

    const dismissTimer = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 380, useNativeDriver: true }).start(() => setGone(true));
    }, FRAME_MS * FRAMES.length + 350);

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (cancelled || reduced) return; // reduced motion: hold first frame
        interval = setInterval(() => {
          setFrame((prev) => {
            if (prev >= FRAMES.length - 1) {
              if (interval) clearInterval(interval);
              return prev;
            }
            return prev + 1;
          });
        }, FRAME_MS);
      })
      .catch(() => {});

    return () => { cancelled = true; if (interval) clearInterval(interval); clearTimeout(dismissTimer); };
  }, [fade]);

  if (gone) return null;

  return (
    <Animated.View style={[s.root, { opacity: fade }]} accessibilityLabel="Motive is loading">
      <Image source={FRAMES[frame]} style={s.logo} resizeMode="contain" />
      <BrandName variant="dark" height={36} style={{ marginTop: 18 }} />
      <Text style={s.tagline}>Positive Motive — drive, earn, own.</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FDFFFC', alignItems: 'center', justifyContent: 'center', zIndex: 50, elevation: 50 },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
  tagline: { color: '#4A5D54', fontSize: 13.5, marginTop: 6 },
});
