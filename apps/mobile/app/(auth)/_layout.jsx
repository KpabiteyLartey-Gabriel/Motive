import { Stack } from 'expo-router';
import { useTheme } from '../../lib/theme';

export default function AuthLayout() {
  const { colors } = useTheme();
  return (
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
      <Stack.Screen name="login" options={{ title: 'Sign In', headerShown: false }} />
      <Stack.Screen name="register" options={{ title: 'Create Account', headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Forgot Password', headerShown: false }} />
      <Stack.Screen name="reset-password" options={{ title: 'Reset Password', headerShown: false }} />
    </Stack>
  );
}
