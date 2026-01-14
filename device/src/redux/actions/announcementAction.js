// device/src/redux/actions/announcementAction.js
import axios from 'axios';
import { getToken } from '../../utils/jwtStorage';
import { API_URL } from '../../utils/config';

const apiURL = API_URL;

export const FETCH_UNREAD_ANNOUNCEMENTS_REQUEST = 'FETCH_UNREAD_ANNOUNCEMENTS_REQUEST';
export const FETCH_UNREAD_ANNOUNCEMENTS_SUCCESS = 'FETCH_UNREAD_ANNOUNCEMENTS_SUCCESS';
export const FETCH_UNREAD_ANNOUNCEMENTS_FAILURE = 'FETCH_UNREAD_ANNOUNCEMENTS_FAILURE';
export const MARK_ANNOUNCEMENTS_READ = 'MARK_ANNOUNCEMENTS_READ';

export const FETCH_INBOX_REQUEST = 'FETCH_INBOX_REQUEST';
export const FETCH_INBOX_SUCCESS = 'FETCH_INBOX_SUCCESS';
export const FETCH_INBOX_FAILURE = 'FETCH_INBOX_FAILURE';
export const MARK_ANNOUNCEMENT_READ = 'MARK_ANNOUNCEMENT_READ';
export const MARK_ALL_READ = 'MARK_ALL_READ';
export const FETCH_UNREAD_COUNT = 'FETCH_UNREAD_COUNT';

export const fetchUnreadAnnouncements = (db) => async (dispatch) => {
  try {
    dispatch({ type: FETCH_UNREAD_ANNOUNCEMENTS_REQUEST });
    
    if (!db) {
      console.error('Database not initialized');
      throw new Error('Database not initialized');
    }
    
    // console.log('Getting token from database...');
    const token = await getToken(db);
    // console.log('Token retrieved:', token ? `${token.substring(0, 20)}...` : 'null');
    
    if (!token) {
      console.error('No authentication token found');
      throw new Error('No authentication token found. Please login again.');
    }
    
    const response = await axios.get(`${apiURL}/api/announcements/unread`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    dispatch({
      type: FETCH_UNREAD_ANNOUNCEMENTS_SUCCESS,
      payload: response.data.announcements,
    });

    return response.data.announcements;
  } catch (error) {
    console.error('Error in fetchUnreadAnnouncements:', error);
    dispatch({
      type: FETCH_UNREAD_ANNOUNCEMENTS_FAILURE,
      payload: error.response?.data?.message || error.message || 'Failed to fetch announcements',
    });
    throw error;
  }
};

export const markAnnouncementsAsRead = () => ({
  type: MARK_ANNOUNCEMENTS_READ,
});

export const fetchInbox = (db, filter = 'all') => async (dispatch) => {
  try {
    dispatch({ type: FETCH_INBOX_REQUEST });
    
    if (!db) {
      console.error('❌ [fetchInbox] Database not initialized');
      throw new Error('Database not initialized');
    }
    
    console.log('📬 [fetchInbox] Getting token from database...');
    const token = await getToken(db);
    console.log('📬 [fetchInbox] Token retrieved:', token ? `${token.substring(0, 20)}...` : 'null');
    
    if (!token) {
      console.error('❌ [fetchInbox] No authentication token found');
      throw new Error('No authentication token found. Please login again.');
    }
    
    const url = `${apiURL}/api/announcements/inbox?filter=${filter}`;
    console.log('📬 [fetchInbox] Fetching from:', url);
    
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log('📬 [fetchInbox] Response:', {
      success: response.data.success,
      announcementsCount: response.data.announcements?.length,
      unreadCount: response.data.unreadCount,
    });

    dispatch({
      type: FETCH_INBOX_SUCCESS,
      payload: {
        announcements: response.data.announcements,
        unreadCount: response.data.unreadCount,
      },
    });

    return response.data;
  } catch (error) {
    console.error('❌ [fetchInbox] Error:', error.response?.data || error.message);
    dispatch({
      type: FETCH_INBOX_FAILURE,
      payload: error.response?.data?.message || error.message || 'Failed to fetch inbox',
    });
    throw error;
  }
};

export const markAnnouncementAsRead = (db, announcementId) => async (dispatch) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const token = await getToken(db);
    if (!token) throw new Error('No authentication token found. Please login again.');
    
    await axios.post(
      `${apiURL}/api/announcements/mark-read/${announcementId}`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    dispatch({
      type: MARK_ANNOUNCEMENT_READ,
      payload: announcementId,
    });
  } catch (error) {
    console.error('Error marking announcement as read:', error);
  }
};

export const markAllAsRead = (db) => async (dispatch) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const token = await getToken(db);
    if (!token) throw new Error('No authentication token found. Please login again.');
    
    await axios.post(
      `${apiURL}/api/announcements/mark-all-read`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    dispatch({ type: MARK_ALL_READ });
  } catch (error) {
    console.error('Error marking all as read:', error);
  }
};

export const fetchUnreadCount = (db) => async (dispatch) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const token = await getToken(db);
    if (!token) {
      console.warn('No token found for unread count');
      return 0;
    }
    
    const response = await axios.get(
      `${apiURL}/api/announcements/unread-count`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    dispatch({
      type: FETCH_UNREAD_COUNT,
      payload: response.data.unreadCount,
    });

    return response.data.unreadCount;
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return 0;
  }
};

// Fetch a single announcement by ID (for direct navigation from push notification)
export const fetchAnnouncementById = async (db, announcementId) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const token = await getToken(db);
    if (!token) throw new Error('No authentication token found. Please login again.');
    
    console.log('📢 [fetchAnnouncementById] Fetching announcement:', announcementId);
    
    const response = await axios.get(
      `${apiURL}/api/announcements/${announcementId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    console.log('📢 [fetchAnnouncementById] Response:', response.data);
    return response.data.announcement;
  } catch (error) {
    console.error('❌ [fetchAnnouncementById] Error:', error.response?.data || error.message);
    return null;
  }
};