import { createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { getToken } from './authAction';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Helper to get auth headers
const getAuthHeaders = () => {
  const token = getToken();
  return {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
    },
  };
};

/**
 * Fetch dashboard statistics
 */
export const fetchDashboardStats = createAsyncThunk(
  'dashboard/fetchStats',
  async (year, { rejectWithValue }) => {
    try {
      const params = year ? `?year=${year}` : '';
      const response = await axios.get(
        `${API_URL}/dashboard/stats${params}`,
        getAuthHeaders()
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to fetch dashboard stats'
      );
    }
  }
);
