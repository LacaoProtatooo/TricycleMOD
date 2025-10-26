import { createSlice } from '@reduxjs/toolkit';
import Constants from 'expo-constants';
import axios from 'axios';

const apiURL = Constants.expoConfig?.extra?.BACKEND_URL || 'http://192.168.1.123:5000';

const initialState = {
    notifToken: null,
    loading: false,
    error: null,
  };

  const SetNotifToken = createSlice({
    name: 'notifToken',
    initialState,
    reducers: {
      createLiquorRequest: (state) => {
        state.loading = true;
        state.error = null;
      },
    },
  });