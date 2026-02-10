import { createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { getToken } from './authAction';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Helper to get auth headers
const getAuthHeaders = () => {
  const token = getToken();
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

/**
 * Fetch all operators with their tricycles and drivers
 */
export const fetchAllOperators = createAsyncThunk(
  'operator/fetchAll',
  async ({ page = 1, limit = 20, search = '' } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', limit);
      if (search) params.append('search', search);

      const response = await axios.get(
        `${API_URL}/operator/admin/all?${params.toString()}`,
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

/**
 * Fetch operator details by ID
 */
export const fetchOperatorDetails = createAsyncThunk(
  'operator/fetchDetails',
  async (operatorId, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${API_URL}/operator/admin/${operatorId}`,
        getAuthHeaders()
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to fetch operator details'
      );
    }
  }
);

/**
 * Fetch operator statistics
 */
export const fetchOperatorStats = createAsyncThunk(
  'operator/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${API_URL}/operator/admin/stats`,
        getAuthHeaders()
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to fetch operator stats'
      );
    }
  }
);
