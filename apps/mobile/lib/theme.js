/**
 * GH Motive mobile design tokens — clean fintech, light-first, emerald brand.
 * Mirrors the web system: canvas #F6F8F7, ink #0B1F17, brand emerald #059669.
 * Keep the useTheme()/getTheme()/palette API stable so every screen benefits.
 */
import { useColorScheme } from 'react-native';

export const palette = {
  light: {
    bg: '#F6F8F7', surface: '#FFFFFF', card: '#FFFFFF', elevated: '#EEF4F0',
    border: '#DFEAE3', separator: '#E7EFEA',
    textPrimary: '#0B1F17', textSecondary: '#4A5D54', textMuted: '#7A8B83',
    inputBg: '#FFFFFF', inputBorder: '#CBDAD1',
    ctaBg: '#059669', ctaText: '#FFFFFF', brandSoft: '#ECFDF5', brandText: '#065F46',
    tabActive: '#059669', tabInactive: '#7A8B83', headerBg: '#FFFFFF',
  },
  dark: {
    bg: '#07120E', surface: '#0B1F17', card: '#10261D', elevated: '#183629',
    border: '#1E4234', separator: '#265442',
    textPrimary: '#FFFFFF', textSecondary: '#B9CCC2', textMuted: '#7FA192',
    inputBg: '#10261D', inputBorder: '#2A5543',
    ctaBg: '#059669', ctaText: '#FFFFFF', brandSoft: '#0B2E21', brandText: '#6EE7B7',
    tabActive: '#34D399', tabInactive: '#7FA192', headerBg: '#0B1F17',
  },
  brand: '#059669', brandDark: '#047857', brandLight: '#A7F3D0',
  solarYellow: '#059669', canyonOrange: '#E84826', forestGreen: '#059669', skyBlue: '#0E9F8A',
  success: '#059669', danger: '#DC2626', warning: '#D97706',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };
export const radius = { sm: 10, md: 12, lg: 16, xl: 20, pill: 999 };
export const type = {
  screenTitle: { fontSize: 26, fontWeight: '700', letterSpacing: -0.4 },
  section: { fontSize: 13, fontWeight: '700', letterSpacing: 0.4 },
  body: { fontSize: 15, lineHeight: 22 },
  caption: { fontSize: 13, lineHeight: 18 },
};

export function getTheme(scheme) {
  const isDark = scheme === 'dark';
  const colors = isDark ? palette.dark : palette.light;
  return {
    isDark,
    colors: {
      ...colors,
      brand: palette.brand, brandDark: palette.brandDark,
      solarYellow: palette.brand, canyonOrange: palette.canyonOrange,
      forestGreen: palette.success, skyBlue: palette.skyBlue,
      success: palette.success, danger: palette.danger, warning: palette.warning,
    },
    spacing, radius, type,
  };
}

export function useTheme() {
  const scheme = useColorScheme();
  return getTheme(scheme);
}
