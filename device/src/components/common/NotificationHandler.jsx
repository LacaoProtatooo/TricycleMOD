import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useDispatch } from 'react-redux';
import { registerForPushNotificationsAsync } from '../../utils/notification';
import { uploadNotifToken } from '../../redux/actions/userAction';
import { getUserCredentials } from '../../utils/userStorage';
import { navigationRef } from '../../navigation/navigator'; // Import navigationRef

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
        name: 'Messages',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        showBadge: true,
      }).then(channel => {
        console.log('Notification Channel created:', channel);
      }).catch(error => {
        console.error('Error creating notification channel:', error);
      });
    }

    // Foreground notification listener (when app is open)
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('🔔 Foreground Notification Received:', JSON.stringify(notification, null, 2));
      
      // You can show an in-app banner here if you want
      const { type, senderName, text } = notification.request.content.data || {};
      
      if (type === 'message') {
        console.log(`💬 New message from ${senderName}: ${text}`);
        // Optional: Show custom in-app notification UI
      }
    });

    // Response listener when user taps notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('📲 Notification Tapped (Response):', JSON.stringify(response, null, 2));
      
      const data = response.notification.request.content.data;
      
      // Navigate to chat screen when notification is tapped
      if (data?.type === 'message' && data?.senderId) {
        console.log('🚀 Navigating to chat with user:', data.senderName);
        
        // Use navigationRef instead of navigation hook
        if (navigationRef.isReady()) {
          navigationRef.navigate('Chat', {
            userId: data.senderId,
            userName: data.senderName,
            userImage: data.senderImage,
          });
        } else {
          console.warn('Navigation not ready yet');
        }
      }
    });

    // Cleanup listeners
    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []); // Remove navigation from dependencies

  return null; // No UI
}
