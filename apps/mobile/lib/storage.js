import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// expo-secure-store has no web implementation and throws on web, which
// broke sign-in in the Expo web runtime. Native stays on SecureStore;
// web falls back to localStorage.
const isWeb = Platform.OS === 'web';

export async function getItemAsync(key) {
  if (isWeb) {
    try { return window.localStorage.getItem(key); } catch { return null; }
  }
  return SecureStore.getItemAsync(key);
}

export async function setItemAsync(key, value) {
  if (isWeb) {
    try { window.localStorage.setItem(key, value); } catch {}
    return;
  }
  return SecureStore.setItemAsync(key, value);
}

export async function deleteItemAsync(key) {
  if (isWeb) {
    try { window.localStorage.removeItem(key); } catch {}
    return;
  }
  return SecureStore.deleteItemAsync(key);
}

export default { getItemAsync, setItemAsync, deleteItemAsync };
