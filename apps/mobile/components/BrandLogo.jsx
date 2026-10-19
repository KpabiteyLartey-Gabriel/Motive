/** +Motive logo — the motive-logo master (PNG, crisp at any size). */
import { Image, StyleSheet } from 'react-native';

export const MOTIVE_LOGO = require('../assets/motive-logo.png');
export const LOGO_GREEN = '#047857';

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
