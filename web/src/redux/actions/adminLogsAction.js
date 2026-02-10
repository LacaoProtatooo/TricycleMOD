import { createAsyncThunk } from '@reduxjs/toolkit';
import { getToken } from './authAction';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

/**
 * Fetch admin activity logs
 */
export const fetchAdminLogs = createAsyncThunk(
  'adminLogs/fetchAdminLogs',
  async ({ page = 1, limit = 20, adminId, action, startDate, endDate, search, sortBy, sortOrder } = {}, { rejectWithValue }) => {
    try {
      const token = getToken();
      if (!token) {
        return rejectWithValue('No authentication token found');
      }

      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', limit);
      if (adminId) params.append('adminId', adminId);
      if (action && action !== 'all') params.append('action', action);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (search) params.append('search', search);
      if (sortBy) params.append('sortBy', sortBy);
      if (sortOrder) params.append('sortOrder', sortOrder);

      const response = await fetch(`${API_BASE_URL}/api/admin/logs?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return rejectWithValue(data.message || 'Failed to fetch admin logs');
      }

      return data;
    } catch (error) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

/**
 * Fetch admin activity log details
 */
export const fetchAdminLogDetails = createAsyncThunk(
  'adminLogs/fetchAdminLogDetails',
  async (logId, { rejectWithValue }) => {
    try {
      const token = getToken();
      if (!token) {
        return rejectWithValue('No authentication token found');
      }

      const response = await fetch(`${API_BASE_URL}/api/admin/logs/${logId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return rejectWithValue(data.message || 'Failed to fetch log details');
      }

      return data;
    } catch (error) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

/**
 * Fetch admin activity stats
 */
export const fetchAdminLogStats = createAsyncThunk(
  'adminLogs/fetchAdminLogStats',
  async ({ startDate, endDate } = {}, { rejectWithValue }) => {
    try {
      const token = getToken();
      if (!token) {
        return rejectWithValue('No authentication token found');
      }

      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`${API_BASE_URL}/api/admin/logs/stats?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return rejectWithValue(data.message || 'Failed to fetch log stats');
      }

      return data;
    } catch (error) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);
