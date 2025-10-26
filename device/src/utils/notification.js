import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Alert } from 'react-native';

export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    Alert.alert('Must use physical device for Push Notifications');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    Alert.alert('Failed to get push token for push notification!');
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  console.log('Expo Push Token:', tokenData.data);
  return tokenData.data;
}

// Optional: Set how notifications are displayed when app is foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
