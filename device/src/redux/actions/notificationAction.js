import { createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { API_URL } from '../../utils/config';

const apiURL = API_URL;

// 👉 Save notification token to backend
export const saveNotifToken = createAsyncThunk(
  'notifications/saveToken',
  async ({ userId, token }, thunkAPI) => {
    try {
      const res = await axios.post(`${apiURL}/api/notifications/save-token`, {
        userId,
        token,
      });

      if (res.data.success) {
        return res.data.token; // return saved token
      } else {
        return thunkAPI.rejectWithValue(res.data.message);
      }
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

// 👉 Fetch notification token from backend
export const getNotifToken = createAsyncThunk(
  'notifications/getToken',
  async ({ userId }, thunkAPI) => {
    try {
      const res = await axios.get(`${apiURL}/api/notifications/get-token/${userId}`);

      if (res.data.success) {
        return res.data.token;
      } else {
        return thunkAPI.rejectWithValue(res.data.message);
      }
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);
