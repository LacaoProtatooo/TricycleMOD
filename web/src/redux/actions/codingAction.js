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
 * Fetch all tricycles with coding information for admin
 * Groups by operator and includes driver assignments
 */
export const fetchCodingData = createAsyncThunk(
  'coding/fetchAll',
  async ({ page = 1, limit = 50, search = '', operatorId = '', codingDay = '' } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', limit);
      if (search) params.append('search', search);
      if (operatorId) params.append('operatorId', operatorId);
      if (codingDay !== '') params.append('codingDay', codingDay);

      const response = await axios.get(
        `${API_URL}/tricycles/admin/coding?${params.toString()}`,
        getAuthHeaders()
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to fetch coding data'
      );
    }
  }
);

/**
 * Update tricycle coding day
 */
export const updateCodingDay = createAsyncThunk(
  'coding/updateCodingDay',
  async ({ tricycleId, codingDay }, { rejectWithValue }) => {
    try {
      const response = await axios.put(
        `${API_URL}/tricycles/admin/coding/${tricycleId}`,
        { codingDay },
        getAuthHeaders()
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to update coding day'
      );
    }
  }
);

/**
 * Fetch coding statistics
 */
export const fetchCodingStats = createAsyncThunk(
  'coding/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${API_URL}/tricycles/admin/coding/stats`,
        getAuthHeaders()
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to fetch coding stats'
      );
    }
  }
);

/**
 * Fetch all operators (for filter dropdown)
 */
export const fetchOperatorsForFilter = createAsyncThunk(
  'coding/fetchOperators',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${API_URL}/operator/admin/list`,
        getAuthHeaders()
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to fetch operators'
      );
    }
  }
);
