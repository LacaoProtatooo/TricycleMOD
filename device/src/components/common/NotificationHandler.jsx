import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useDispatch } from 'react-redux';
import { registerForPushNotificationsAsync } from '../../utils/notification';
import { uploadNotifToken } from '../../redux/actions/userAction';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { getUserCredentials } from '../../utils/userStorage';

export default function NotificationHandler() {
  const [expoPushToken, setExpoPushToken] = useState('');
  const notificationListener = useRef();
  const responseListener = useRef();
  const dispatch = useDispatch();
  const [user, setUser] = useState(null);

  // Fetch user credentials once when the component mounts
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await getUserCredentials();
        console.log('Retrieved user from AsyncStorage:', userData);
        setUser(userData);
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };

    fetchUser();

    // Configure Google Sign-in (if needed)
    GoogleSignin.configure({
      webClientId: '75787064888-l1hip5a66fhr6h7bgoo36okvj8qncm35.apps.googleusercontent.com',
      profileImageSize: 150,
    });
  }, []);

  // Register for push notifications when the user is available
  useEffect(() => {
    if (user) {
      console.log('User available for push notification registration:', user);

      registerForPushNotificationsAsync().then(token => {
        if (token) {
          setExpoPushToken(token);
          console.log('Expo Push Token generated:', token);

          // Dispatch action to save token to backend
          dispatch(uploadNotifToken({ token, id: user._id || user.id }))
            .then(response => {
              console.log('Token upload response:', response);
            })
            .catch(error => {
              console.error('Error uploading token to backend:', error);
            });
        } else {
          console.error('Failed to generate Expo Push Token.');
        }
      });
    } else {
      console.warn('No user found. Skipping push notification registration.');
    }
  }, [user]);

  // Notification listeners
  useEffect(() => {
    // Create and log notification channel on Android
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      }).then(channel => {
        console.log('Notification Channel created:', channel);
      }).catch(error => {
        console.error('Error creating notification channel:', error);
      });
    }

    // Foreground notification listener
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Foreground Notification Received:', JSON.stringify(notification, null, 2));
    });

    // Response listener when user taps notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification Tapped (Response):', JSON.stringify(response, null, 2));
    });

    // Cleanup listeners
    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  return null; // No UI
}
