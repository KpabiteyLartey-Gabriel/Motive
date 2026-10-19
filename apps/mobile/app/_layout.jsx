import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTheme, initThemePreference } from '../lib/theme';

export default function RootLayout() {
  const { isDark, colors } = useTheme();

  useEffect(() => { initThemePreference(); }, []);
  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.headerBg },
          headerTintColor: colors.brand,
          headerTitleStyle: { fontWeight: '700', fontSize: 17, color: colors.textPrimary },
          headerShadowVisible: false,
          headerBackTitle: 'Back',
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(driver)" options={{ headerShown: false }} />
        <Stack.Screen name="(owner)" options={{ headerShown: false }} />
        <Stack.Screen name="track/[token]" options={{ title: 'Live Location' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
