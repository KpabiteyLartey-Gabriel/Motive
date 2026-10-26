/**
 * useAuth — shared hook for both driver and owner mobile screens.
 * Reads the stored user from SecureStore and redirects to login if missing.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import SecureStore from './storage';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    SecureStore.getItemAsync('user').then((data) => {
      if (data) {
        setUser(JSON.parse(data));
      } else {
        router.replace('/(auth)/login');
      }
      setLoading(false);
    });
  }, []);

  const logout = async () => {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('user');
    router.replace('/(auth)/login');
  };

  return { user, loading, logout };
}

/** Format an amount as a plain number (no currency label on mobile) */
export function fmtGHS(amount) {
  if (amount == null) return '—';
  return Number(amount).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Format a date string */
export function fmtDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Greeting based on hour */
export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
