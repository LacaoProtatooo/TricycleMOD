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
