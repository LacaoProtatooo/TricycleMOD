import { createAsyncThunk } from '@reduxjs/toolkit';
import { getToken } from '../../utils/jwtStorage';
import Constants from 'expo-constants';
import * as Location from 'expo-location';

const API_BASE_URL = Constants.expoConfig?.extra?.BACKEND_URL || 'http://localhost:5000';

/**
 * Get current GPS location for heartbeat (non-blocking)
 * Returns null if location permission denied or unavailable
 */
const getCurrentLocation = async () => {
  try {
    // Check if location permission is granted
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      return null;
    }

    // Get current position with timeout
    const location = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);

    if (location?.coords) {
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        altitude: location.coords.altitude || 0,
        accuracy: location.coords.accuracy || 0,
        speed: location.coords.speed || 0,
        heading: location.coords.heading || 0,
        timestamp: location.timestamp || Date.now(),
      };
    }
    return null;
  } catch (error) {
    // Silently fail - location is optional for heartbeat
    console.log('[Heartbeat] Location fetch failed (silent):', error.message);
    return null;
  }
};

/**
 * Send heartbeat to update user activity status
 * Should be called periodically (every 2-3 minutes) when app is active
 * Includes GPS location if available for live tracking
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

      // Get current GPS location (non-blocking, will be null if unavailable)
      const location = await getCurrentLocation();
      console.log('[Heartbeat] Location:', location ? 'available' : 'unavailable');

      console.log('[Heartbeat] Sending to:', `${API_BASE_URL}/api/activity/heartbeat`);
      const response = await fetch(`${API_BASE_URL}/api/activity/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          platform: 'mobile',
          location, // Include GPS location if available
        }),
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
