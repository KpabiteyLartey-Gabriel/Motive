import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import SecureStore from './storage';
import { notificationsApi } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

let registeredToken = null;

/**
 * Ask for notification permission and register this device's Expo push
 * token with the backend. Safe to call repeatedly; silently skips on
 * web/simulators or when permission is declined.
 */
export async function registerPushToken() {
  try {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
    const accessToken = await SecureStore.getItemAsync('accessToken');
    if (!accessToken) return null;

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const tokenResult = await Notifications.getExpoPushTokenAsync();
    const token = tokenResult?.data;
    if (!token || token === registeredToken) return token || null;

    await notificationsApi.registerPushToken({ token, platform: Platform.OS });
    registeredToken = token;
    return token;
  } catch {
    // Push is best-effort (Expo Go / simulator / no project id) — in-app
    // notifications still work without it.
    return null;
  }
}

export async function unregisterPushToken() {
  try {
    if (registeredToken) {
      await notificationsApi.removePushToken(registeredToken);
      registeredToken = null;
    }
  } catch {}
}
