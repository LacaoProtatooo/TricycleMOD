import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Alert, Platform } from 'react-native';
import Constants from 'expo-constants';

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

  // GET NATIVE FCM TOKEN (not Expo token)
  let token;
  if (Platform.OS === 'android') {
    // For Android, get the FCM token directly
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || 
                      Constants.easConfig?.projectId;
    
    token = (await Notifications.getDevicePushTokenAsync()).data;
    console.log('Native FCM Token:', token);
  } else {
    // For iOS, get APNs token
    token = (await Notifications.getDevicePushTokenAsync()).data;
    console.log('APNs Token:', token);
  }

  return token;
}

// Set notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true, // Changed to true for better visibility
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});
