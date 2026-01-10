// actions/leaderboardAction.js - Redux actions for leaderboard management
import { createAsyncThunk } from '@reduxjs/toolkit';
import { getToken } from './authAction';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Fetch monthly leaderboard
 */
export const fetchLeaderboard = createAsyncThunk(
  'leaderboard/fetchLeaderboard',
  async ({ month, year, limit = 20 } = {}, thunkAPI) => {
    try {
      const token = getToken();
      const params = new URLSearchParams();
      if (month) params.append('month', month);
      if (year) params.append('year', year);
      params.append('limit', limit);

      const res = await fetch(`${API_URL}/leaderboard?${params.toString()}`, {
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
 * Fetch all-time leaderboard
 */
export const fetchAllTimeLeaderboard = createAsyncThunk(
  'leaderboard/fetchAllTimeLeaderboard',
  async ({ limit = 20 } = {}, thunkAPI) => {
    try {
      const token = getToken();
      const params = new URLSearchParams();
      params.append('limit', limit);

      const res = await fetch(`${API_URL}/leaderboard/all-time?${params.toString()}`, {
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
 * Fetch available months for dropdown
 */
export const fetchAvailableMonths = createAsyncThunk(
  'leaderboard/fetchAvailableMonths',
  async (_, thunkAPI) => {
    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/leaderboard/months`, {
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
