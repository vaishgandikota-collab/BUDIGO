import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';

// Configure foreground notification presentation
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export class PushNotificationService {
  /**
   * Registers physical device with Expo push notification service
   */
  static async registerForPushNotifications(): Promise<string | null> {
    if (Platform.OS === 'web') {
      return null;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('[PushNotificationService] Push notification permissions not granted.');
        return null;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync();
      const token = tokenData.data;

      // Register with Budigo backend
      if (token) {
        await api.registerPushToken(token).catch((err) => {
          console.warn('[PushNotificationService] Failed to send push token to backend:', err);
        });
      }

      // Android notification channel setup
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('budigo_alerts', {
          name: 'Budigo Travel Alerts',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#D1956A',
        });
      }

      return token;
    } catch (error) {
      console.warn('[PushNotificationService] Error registering for push notifications:', error);
      return null;
    }
  }

  /**
   * Listens for incoming notifications
   */
  static addNotificationReceivedListener(callback: (notification: Notifications.Notification) => void) {
    return Notifications.addNotificationReceivedListener(callback);
  }

  /**
   * Listens for user tapping on a notification
   */
  static addNotificationResponseReceivedListener(
    callback: (response: Notifications.NotificationResponse) => void
  ) {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }
}

