import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform, Alert } from 'react-native';
import { useDispatch } from 'react-redux';
import { registerForPushNotificationsAsync } from '../../utils/notification';
import { uploadNotifToken } from '../../redux/actions/userAction';
import { getUserCredentials } from '../../utils/userStorage';
import { navigationRef } from '../../navigation/navigator'; // Import navigationRef
import { 
  updateBookingStatus, 
  receiveDriverOffer 
} from '../../redux/actions/bookingAction';
import { logoutUser } from '../../redux/actions/authAction';
import { useAsyncSQLiteContext } from '../../utils/asyncSQliteProvider';
import complaintNotifEmitter from '../../utils/complaintNotificationEvent';

export default function NotificationHandler() {
  const [expoPushToken, setExpoPushToken] = useState('');
  const notificationListener = useRef();
  const responseListener = useRef();
  const dispatch = useDispatch();
  const [user, setUser] = useState(null);
  const db = useAsyncSQLiteContext();

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
    // Create and log notification channels on Android
    if (Platform.OS === 'android') {
      // Messages channel
      Notifications.setNotificationChannelAsync('default', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        showBadge: true,
      }).then(channel => {
        console.log('Messages Notification Channel created:', channel);
      }).catch(error => {
        console.error('Error creating messages notification channel:', error);
      });

      // Announcements channel
      Notifications.setNotificationChannelAsync('announcements', {
        name: 'Announcements',
        description: 'Important announcements from TricycleMOD',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#3B82F6',
        showBadge: true,
      }).then(channel => {
        console.log('Announcements Notification Channel created:', channel);
      }).catch(error => {
        console.error('Error creating announcements notification channel:', error);
      });
    }

    // Foreground notification listener (when app is open)
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('🔔 Foreground Notification Received:', JSON.stringify(notification, null, 2));
      
      const { type, senderName, text, announcementType, bookingId, offerAmount } = notification.request.content.data || {};
      
      if (type === 'message') {
        console.log(`💬 New message from ${senderName}: ${text}`);
        // Optional: Show custom in-app notification UI
      } else if (type === 'announcement') {
        console.log(`📢 New announcement (${announcementType}): ${notification.request.content.title}`);
        // The notification will show automatically, user can tap to see more
      } else if (type === 'driver_offer') {
        // Driver made a counter offer
        console.log(`💰 Driver offer received: ₱${offerAmount} for booking ${bookingId}`);
        dispatch(receiveDriverOffer({
          bookingId,
          amount: parseFloat(offerAmount),
          offeredAt: new Date().toISOString(),
        }));
      } else if (type === 'booking_accepted') {
        // Driver accepted at user's fare
        console.log(`✅ Booking accepted: ${bookingId}`);
        dispatch(updateBookingStatus({
          _id: bookingId,
          status: 'accepted',
          acceptedAt: new Date().toISOString(),
        }));
      } else if (type === 'offer_accepted') {
        // User accepted driver's counter offer (for driver side)
        console.log(`✅ Offer accepted: ${bookingId}`);
        dispatch(updateBookingStatus({
          _id: bookingId,
          status: 'accepted',
          acceptedAt: new Date().toISOString(),
        }));
      } else if (type === 'booking_cancelled') {
        // Booking was cancelled
        console.log(`❌ Booking cancelled: ${bookingId}`);
        dispatch(updateBookingStatus({
          _id: bookingId,
          status: 'cancelled',
          cancelledAt: new Date().toISOString(),
        }));
      } else if (type === 'trip_completed') {
        // Trip was completed
        console.log(`✅ Trip completed: ${bookingId}`);
        dispatch(updateBookingStatus({
          _id: bookingId,
          status: 'completed',
          completedAt: new Date().toISOString(),
        }));
      } else if (type === 'suspension' || type === 'reinstatement') {
        // Handle suspension/reinstatement - force logout to refresh user status
        const { action } = notification.request.content.data || {};
        if (action === 'force_logout') {
          console.log(`🔒 ${type === 'suspension' ? 'Suspended' : 'Reinstated'} - forcing logout to refresh status`);
          const alertTitle = type === 'suspension' ? '⚠️ Account Suspended' : '✅ Driver Reinstated';
          const alertMessage = type === 'suspension' 
            ? 'Your account has been suspended. You will be logged out. Please log in again to see your suspension details.'
            : 'You have been reinstated! You will be logged out. Please log in again to continue operating.';
          
          Alert.alert(
            alertTitle,
            alertMessage,
            [
              {
                text: 'OK',
                onPress: () => {
                  dispatch(logoutUser(db));
                },
              },
            ],
            { cancelable: false }
          );
        }
      } else if (
        type === 'driver_complaint' ||
        type === 'complaint_received' ||
        type === 'complaint_status_update' ||
        type === 'complaint_resolved' ||
        type === 'complaint_status_update_operator' ||
        type === 'complaint_resolved_operator' ||
        type === 'complaint_status_update_driver' ||
        type === 'complaint_resolved_driver'
      ) {
        // Complaint-related notifications — show the pop-up modal
        console.log(`📋 Complaint notification received: ${type}`);
        complaintNotifEmitter.emit('show', {
          type,
          title: notification.request.content.title,
          body: notification.request.content.body,
          data: notification.request.content.data || {},
        });
      }
    });

    // Response listener when user taps notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('📲 Notification Tapped (Response):', JSON.stringify(response, null, 2));
      
      const data = response.notification.request.content.data;
      const content = response.notification.request.content;
      
      // Navigate based on notification type
      if (navigationRef.isReady()) {
        if (data?.type === 'message' && data?.senderId) {
          console.log('🚀 Navigating to chat with user:', data.senderName);
          navigationRef.navigate('Chat', {
            userId: data.senderId,
            userName: data.senderName,
            userImage: data.senderImage,
          });
        } else if (data?.type === 'announcement' && data?.announcementId) {
          console.log('🚀 Navigating to notification detail:', data.announcementId);
          // Navigate to detail screen with notification data from push
          navigationRef.navigate('NotificationDetail', {
            notification: {
              _id: data.announcementId,
              title: content.title,
              message: content.body,
              type: data.announcementType || 'info',
              targetAudience: data.targetAudience || 'all',
              scheduledDate: new Date().toISOString(),
              isRead: false,
              // Note: image and createdBy won't be available from push notification
              // The detail screen will show what's available
            },
          });
        } else if (data?.type === 'announcement') {
          // Fallback to inbox if no announcementId
          console.log('🚀 Navigating to notifications inbox');
          navigationRef.navigate('NotificationInbox');
        } else if (['driver_offer', 'booking_accepted', 'offer_accepted', 'booking_cancelled', 'trip_completed', 'new_booking'].includes(data?.type)) {
          // Navigate to booking screen for booking-related notifications
          console.log('🚀 Navigating to booking screen for:', data.type);
          navigationRef.navigate('Booking');
        } else if ([
          'driver_complaint',
          'complaint_received',
          'complaint_status_update',
          'complaint_resolved',
          'complaint_status_update_operator',
          'complaint_resolved_operator',
          'complaint_status_update_driver',
          'complaint_resolved_driver',
        ].includes(data?.type)) {
          // Tapped a complaint notification — show the modal
          console.log('📋 Complaint notification tapped:', data.type);
          complaintNotifEmitter.emit('show', {
            type: data.type,
            title: content.title,
            body: content.body,
            data: data || {},
          });
        }
      } else {
        console.warn('Navigation not ready yet');
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
