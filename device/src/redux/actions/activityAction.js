import { createAsyncThunk } from '@reduxjs/toolkit';
import { getToken } from '../../utils/jwtStorage';
import Constants from 'expo-constants';

const API_BASE_URL = Constants.expoConfig?.extra?.BACKEND_URL || 'http://localhost:5000';

/**
 * Send heartbeat to update user activity status
 * Should be called periodically (every 2-3 minutes) when app is active
 */
export const sendHeartbeat = createAsyncThunk(
  'activity/sendHeartbeat',
  async (db, { rejectWithValue }) => {
    try {
      console.log('[Heartbeat] Getting token from db...');
      const token = await getToken(db);
      if (!token) {
        console.log('[Heartbeat] No token found');
        return rejectWithValue('No authentication token');
      }

      console.log('[Heartbeat] Sending to:', `${API_BASE_URL}/api/activity/heartbeat`);
      const response = await fetch(`${API_BASE_URL}/api/activity/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ platform: 'mobile' }),
      });

      const data = await response.json();
      console.log('[Heartbeat] Response:', response.status, data);

      if (!response.ok) {
        return rejectWithValue(data.message || 'Failed to send heartbeat');
      }

      return data;
    } catch (error) {
      console.log('[Heartbeat] Error:', error.message);
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Mark user as offline (call on logout or app going to background for extended time)
 */
export const markUserOffline = createAsyncThunk(
  'activity/markOffline',
  async (db, { rejectWithValue }) => {
    try {
      const token = await getToken(db);
      if (!token) {
        return rejectWithValue('No authentication token');
      }

      const response = await fetch(`${API_BASE_URL}/api/activity/offline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return rejectWithValue(data.message || 'Failed to mark offline');
      }

      return data;
    } catch (error) {
      console.log('Mark offline error (silent):', error.message);
      return rejectWithValue(error.message);
    }
  }
);
