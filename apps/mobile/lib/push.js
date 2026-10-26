import { Platform } from 'react-native';
import Constants from 'expo-constants';
import SecureStore from './storage';
import { notificationsApi } from './api';

// Remote push is not available in Expo Go (SDK 53+) and importing
// expo-notifications there throws "Cannot find native module
// 'ExpoTopicSubscriptionModule'". Load it lazily, only in real builds.
const isExpoGo = Constants.appOwnership === 'expo';

let Notifications = null;
function loadNotifications() {
  if (Notifications) return Notifications;
  if (isExpoGo || Platform.OS === 'web') return null;
  try {
    Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: true,
      }),
    });
  } catch {
    return null;
  }
  return Notifications;
}

let registeredToken = null;

/**
 * Ask for notification permission and register this device's Expo push
 * token with the backend. Safe to call repeatedly; silently skips in
 * Expo Go, on web/simulators, or when permission is declined. In-app
 * notifications keep working in all of those cases.
 */
export async function registerPushToken() {
  try {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
    const N = loadNotifications();
    if (!N) return null;

    const accessToken = await SecureStore.getItemAsync('accessToken');
    if (!accessToken) return null;

    const existing = await N.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const requested = await N.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') return null;

    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('default', {
        name: 'default',
        importance: N.AndroidImportance.DEFAULT,
      });
    }

    const tokenResult = await N.getExpoPushTokenAsync();
    const token = tokenResult?.data;
    if (!token || token === registeredToken) return token || null;

    await notificationsApi.registerPushToken({ token, platform: Platform.OS });
    registeredToken = token;
    return token;
  } catch {
    return null;
  }
}

