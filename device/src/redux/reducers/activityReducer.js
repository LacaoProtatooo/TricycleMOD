import { createSlice } from '@reduxjs/toolkit';
import { sendHeartbeat, markUserOffline } from '../actions/activityAction';

const initialState = {
  isOnline: false,
  lastHeartbeat: null,
  error: null,
};

const activitySlice = createSlice({
  name: 'activity',
  initialState,
  reducers: {
    resetActivity: (state) => {
      state.isOnline = false;
      state.lastHeartbeat = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendHeartbeat.fulfilled, (state) => {
        state.isOnline = true;
        state.lastHeartbeat = new Date().toISOString();
        state.error = null;
      })
      .addCase(sendHeartbeat.rejected, (state, action) => {
        // Don't change online status on rejection - might be temporary network issue
        state.error = action.payload;
      })
      .addCase(markUserOffline.fulfilled, (state) => {
        state.isOnline = false;
      })
      .addCase(markUserOffline.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});

export const { resetActivity } = activitySlice.actions;

export default activitySlice.reducer;
