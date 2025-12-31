// actions/bookingAction.js - Redux actions for admin booking management
import { createAsyncThunk } from '@reduxjs/toolkit';
import { getToken } from './authAction';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Fetch all bookings with filters (Admin)
 */
export const fetchAllBookings = createAsyncThunk(
  'booking/fetchAllBookings',
  async ({ 
    page = 1, 
    limit = 20, 
    status = '', 
    search = '', 
    startDate = '', 
    endDate = '',
    sortBy = 'createdAt',
    sortOrder = 'desc',
    disputed = false,
  } = {}, thunkAPI) => {
    try {
      const token = getToken();
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', limit);
      if (status) params.append('status', status);
      if (search) params.append('search', search);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (disputed) params.append('disputed', 'true');
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);

      const res = await fetch(`${API_URL}/booking/admin/all?${params.toString()}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (data.success) {
        return data;
      } else {
        return thunkAPI.rejectWithValue(data.message);
      }
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

/**
 * Fetch single booking details (Admin)
 */
export const fetchBookingDetails = createAsyncThunk(
  'booking/fetchBookingDetails',
  async (bookingId, thunkAPI) => {
    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/booking/admin/${bookingId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (data.success) {
        return data.booking;
      } else {
        return thunkAPI.rejectWithValue(data.message);
      }
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

/**
 * Fetch booking statistics (Admin)
 */
export const fetchBookingStats = createAsyncThunk(
  'booking/fetchBookingStats',
  async (_, thunkAPI) => {
    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/booking/admin/stats`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (data.success) {
        return data;
      } else {
        return thunkAPI.rejectWithValue(data.message);
      }
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);
