// actions/lostFoundAction.js - Redux actions for admin lost & found management
import { createAsyncThunk } from '@reduxjs/toolkit';
import { getToken } from './authAction';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Fetch all lost & found items (Admin)
 */
export const fetchAllLostFound = createAsyncThunk(
  'lostFound/fetchAllLostFound',
  async ({ status = '' } = {}, thunkAPI) => {
    try {
      const token = getToken();
      const params = new URLSearchParams();
      if (status) params.append('status', status);

      const res = await fetch(`${API_URL}/lost-found?${params.toString()}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (data.success) {
        return data.data;
      } else {
        return thunkAPI.rejectWithValue(data.message);
      }
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

/**
 * Fetch lost & found statistics (Admin)
 */
export const fetchLostFoundStats = createAsyncThunk(
  'lostFound/fetchLostFoundStats',
  async (_, thunkAPI) => {
    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/lost-found/admin/stats`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (data.success) {
        return data.data;
      } else {
        return thunkAPI.rejectWithValue(data.message);
      }
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

/**
 * Verify/Update lost & found item status (Admin)
 */
export const verifyLostFoundItem = createAsyncThunk(
  'lostFound/verifyLostFoundItem',
  async ({ id, status, claimerName, claimerContact, claimNotes }, thunkAPI) => {
    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/lost-found/admin/${id}/verify`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, claimerName, claimerContact, claimNotes }),
      });

      const data = await res.json();

      if (data.success) {
        return data.data;
      } else {
        return thunkAPI.rejectWithValue(data.message);
      }
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

/**
 * Delete lost & found item (Admin)
 */
export const deleteLostFoundItem = createAsyncThunk(
  'lostFound/deleteLostFoundItem',
  async (id, thunkAPI) => {
    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/lost-found/admin/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (data.success) {
        return id;
      } else {
        return thunkAPI.rejectWithValue(data.message);
      }
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);
