// userReducer.js
import { createSlice } from '@reduxjs/toolkit';
import { fetchCurrentUser, updateProfile, uploadNotifToken } from '../actions/userAction';

const initialState = {
  currentUser: null,
  expoPushToken: null,
  loading: false,
  error: null,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    // You could add manual reducers here if needed
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCurrentUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.loading = false;
        state.currentUser = action.payload;
      })
      .addCase(fetchCurrentUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(updateProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.currentUser = action.payload;
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      .addCase(uploadNotifToken.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(uploadNotifToken.fulfilled, (state, action) => {
        state.loading = false;
        state.expoPushToken = action.payload;
      })
      .addCase(uploadNotifToken.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      ;
  },
});

export default userSlice.reducer;
