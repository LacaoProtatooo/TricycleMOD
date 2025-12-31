import { createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Helper to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('adminToken');
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

/**
 * Fetch admin notifications (disputes + expiring announcements)
 */
export const fetchAdminNotifications = createAsyncThunk(
  'adminNotification/fetchAll',
  async ({ page = 1, limit = 20, type = '', showRead = true } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', limit);
      params.append('showRead', showRead.toString());
      if (type) params.append('type', type);

      const response = await axios.get(
        `${API_URL}/operator/admin/notifications/all?${params.toString()}`,
        getAuthHeaders()
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to fetch notifications'
      );
    }
  }
);

/**
 * Fetch notification counts
 */
export const fetchNotificationCounts = createAsyncThunk(
  'adminNotification/fetchCounts',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${API_URL}/operator/admin/notifications/counts`,
        getAuthHeaders()
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to fetch notification counts'
      );
    }
  }
);

/**
 * Mark a notification as read
 */
export const markNotificationRead = createAsyncThunk(
  'adminNotification/markRead',
  async (notificationId, { rejectWithValue }) => {
    try {
      const response = await axios.put(
        `${API_URL}/operator/admin/notifications/read/${encodeURIComponent(notificationId)}`,
        {},
        getAuthHeaders()
      );
      return { ...response.data, notificationId };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to mark notification as read'
      );
    }
  }
);

/**
 * Mark all notifications as read
 */
export const markAllNotificationsRead = createAsyncThunk(
  'adminNotification/markAllRead',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.put(
        `${API_URL}/operator/admin/notifications/read-all`,
        {},
        getAuthHeaders()
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to mark all notifications as read'
      );
    }
  }
);
