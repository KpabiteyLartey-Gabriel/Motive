/** +Motive logo — the motive-logo master (PNG, crisp at any size). */
import { Image, StyleSheet } from 'react-native';
import { useTheme } from '../lib/theme';

export const MOTIVE_LOGO = require('../assets/motive-logo.png');
export const LOGO_GREEN = '#047857';
const NAME_WHITE = require('../assets/motive-name-white.png');
const NAME_DARK = require('../assets/motive-name-dark.png');
const NAME_RATIO = 1200 / 241; // width / height of the wordmark master

/** The ⊕MOTIVE name wordmark. variant: 'white' | 'dark' | 'auto' (theme). */
export function BrandName({ height = 24, variant = 'auto', style }) {
  const { isDark } = useTheme();
  const useWhite = variant === 'white' || (variant === 'auto' && isDark);
  return (
    <Image
      source={useWhite ? NAME_WHITE : NAME_DARK}
      style={[{ height, width: height * NAME_RATIO }, style]}
      resizeMode="contain"
      accessibilityLabel="Motive"
    />
  );
}

export default function BrandLogo({ size = 52, style }) {
  return (
    <Image
      source={MOTIVE_LOGO}
      style={[{ width: size, height: size, borderRadius: size * 0.24 }, style]}
      resizeMode="cover"
      accessibilityLabel="+Motive logo"
    />
  );
}

const _s = StyleSheet.create({});
