import { createSlice } from '@reduxjs/toolkit';
import { saveNotifToken, getNotifToken } from '../actions/notificationAction';

const initialState = {
  notifToken: null,
  loading: false,
  error: null,
};

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    clearNotifToken(state) {
      state.notifToken = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // SAVE TOKEN
      .addCase(saveNotifToken.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(saveNotifToken.fulfilled, (state, action) => {
        state.loading = false;
        state.notifToken = action.payload;
      })
      .addCase(saveNotifToken.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // GET TOKEN
      .addCase(getNotifToken.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getNotifToken.fulfilled, (state, action) => {
        state.loading = false;
        state.notifToken = action.payload;
      })
      .addCase(getNotifToken.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearNotifToken } = notificationSlice.actions;
export default notificationSlice.reducer;
