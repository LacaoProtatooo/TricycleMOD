// App.js
import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LogBox } from 'react-native';
import Navigator from './src/navigation/navigator';
import store from './src/redux/store';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

import { AsyncSQLiteProvider, useAsyncSQLiteContext } from './src/utils/asyncSQliteProvider';
import { migrateDbIfNeeded } from './src/utils/jwtStorage';
import Toast from 'react-native-toast-message';
import PersistentLogin from './src/utils/persistentLogin';

import NotificationHandler from './src/components/common/NotificationHandler';
import ActivityTracker from './src/components/common/ActivityTracker';
import { fetchUnreadAnnouncements, markAnnouncementsAsRead } from './src/redux/actions/announcementAction';
import AnnouncementModal from './src/components/common/announcementModal';
import ComplaintNotificationModal from './src/components/common/ComplaintNotificationModal';
import complaintNotifEmitter from './src/utils/complaintNotificationEvent';

// Suppress known react-native-maps warning about topUserLocationChange event
// This is a known issue with react-native-maps and newer React Native versions
LogBox.ignoreLogs([
  'Unsupported top level event type "topUserLocationChange" dispatched',
  'Each child in a list should have a unique "key" prop',
]);
LogBox.ignoreLogs(['Unsupported top level event type "topUserLocationChange"']);

GoogleSignin.configure({
  webClientId: '75787064888-l1hip5a66fhr6h7bgoo36okvj8qncm35.apps.googleusercontent.com',
  profileImageSize: 150,
});

// Create a separate component that uses Redux hooks and DB context
const AppContent = () => {
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [complaintModal, setComplaintModal] = useState({
    visible: false,
    type: null,
    title: '',
    body: '',
    data: {},
  });
  const dispatch = useDispatch();
  const db = useAsyncSQLiteContext(); // Get db from context
  const { unreadAnnouncements } = useSelector((state) => state.announcements);

  // Listen for complaint notification events from NotificationHandler
  useEffect(() => {
    const handleComplaintNotif = ({ type, title, body, data }) => {
      setComplaintModal({
        visible: true,
        type,
        title: title || '',
        body: body || '',
        data: data || {},
      });
    };

    complaintNotifEmitter.on('show', handleComplaintNotif);
    return () => {
      complaintNotifEmitter.off('show', handleComplaintNotif);
    };
  }, []);

  useEffect(() => {
    if (!db) return; // Wait for db to be initialized
    
    // Fetch announcements when app opens
    const checkAnnouncements = async () => {
      try {
        const announcements = await dispatch(fetchUnreadAnnouncements(db));
        if (announcements && announcements.length > 0) {
          setShowAnnouncementModal(true);
        }
      } catch (error) {
        console.error('Error fetching announcements:', error);
      }
    };

    checkAnnouncements();
  }, [db, dispatch]);

  const handleCloseAnnouncements = () => {
    setShowAnnouncementModal(false);
    dispatch(markAnnouncementsAsRead());
  };

  const handleCloseComplaintModal = () => {
    setComplaintModal((prev) => ({ ...prev, visible: false }));
  };

  return (
    <>
      <PersistentLogin />
      <ActivityTracker />
      <Navigator/>
      <NotificationHandler />
      <Toast />
      <AnnouncementModal
        visible={showAnnouncementModal}
        announcements={unreadAnnouncements}
        onClose={handleCloseAnnouncements}
      />
      <ComplaintNotificationModal
        visible={complaintModal.visible}
        onClose={handleCloseComplaintModal}
        notificationType={complaintModal.type}
        notificationTitle={complaintModal.title}
        notificationBody={complaintModal.body}
        notificationData={complaintModal.data}
      />
    </>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <AsyncSQLiteProvider databaseName="tmod.db" onInit={migrateDbIfNeeded}>
          <AppContent />
        </AsyncSQLiteProvider>
      </Provider>
    </SafeAreaProvider>
  );
}
