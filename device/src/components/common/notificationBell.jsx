// Add this component wherever you want the notification bell (header, drawer, etc.)
// device/src/components/common/notificationBell.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { fetchUnreadCount } from '../../redux/actions/announcementAction';
import { useAsyncSQLiteContext } from '../../utils/asyncSQliteProvider';
import axios from 'axios';
import { getToken } from '../../utils/jwtStorage';
import { API_URL } from '../../utils/config';

const BASE_URL = API_URL;

const NotificationBell = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const db = useAsyncSQLiteContext();
  const { unreadCount } = useSelector((state) => state.announcements);
  const { currentUser } = useSelector((state) => state.user);
  const [licenseData, setLicenseData] = useState(null);

  useEffect(() => {
    if (!db) return;
    
    // Fetch unread count on mount
    dispatch(fetchUnreadCount(db));

    // Optionally poll for updates every minute
    const interval = setInterval(() => {
      dispatch(fetchUnreadCount(db));
    }, 60000);

    return () => clearInterval(interval);
  }, [db, dispatch]);

  useEffect(() => {
    if (currentUser?.role === 'driver' && db) {
      fetchLicenseData();
    }
  }, [currentUser, db]);

  const fetchLicenseData = async () => {
    if (!currentUser?._id) return;
    try {
      const token = await getToken(db);
      const response = await axios.get(`${BASE_URL}/api/license/${currentUser._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success && response.data.license) {
        setLicenseData(response.data.license);
      }
    } catch (error) {
      setLicenseData(null);
    }
  };

  // Calculate system notices count
  const systemNoticesCount = useMemo(() => {
    if (!currentUser) return 0;
    
    let count = 0;
    
    // Check common profile fields
    if (!currentUser.phone || !currentUser.image?.url || 
        (!currentUser.address?.street && !currentUser.address?.city)) {
      count++;
    }
    
    // Check license for drivers
    if (currentUser.role === 'driver') {
      if (!licenseData) {
        count++;
      } else if (!licenseData.isVerified) {
        count++;
      } else if (licenseData.expiryDate) {
        const expiryDate = new Date(licenseData.expiryDate);
        const today = new Date();
        const daysUntilExpiry = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiry <= 30) {
          count++;
        }
      }
    }
    
    return count;
  }, [currentUser, licenseData]);

  const totalUnread = unreadCount + systemNoticesCount;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => navigation.navigate('NotificationInbox')}
    >
      <Ionicons name="notifications-outline" size={24} color="#000" />
      {totalUnread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {totalUnread > 99 ? '99+' : totalUnread}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    padding: 8,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default NotificationBell;