import { createSlice } from '@reduxjs/toolkit';
import { fetchUsersWithActivity, fetchUserDetails } from '../actions/userListAction';

const initialState = {
  users: [],
  selectedUser: null,
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalUsers: 0,
    limit: 20,
  },
  counts: {
    online: 0,
    offline: 0,
    total: 0,
  },
  loading: false,
  detailsLoading: false,
  error: null,
};

const userListSlice = createSlice({
  name: 'userList',
  initialState,
  reducers: {
    clearUserListError: (state) => {
      state.error = null;
    },
    clearSelectedUser: (state) => {
      state.selectedUser = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch users with activity
      .addCase(fetchUsersWithActivity.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUsersWithActivity.fulfilled, (state, action) => {
        state.loading = false;
        state.users = action.payload.users;
        state.pagination = action.payload.pagination;
        state.counts = action.payload.counts;
      })
      .addCase(fetchUsersWithActivity.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fetch user details
      .addCase(fetchUserDetails.pending, (state) => {
        state.detailsLoading = true;
        state.error = null;
      })
      .addCase(fetchUserDetails.fulfilled, (state, action) => {
        state.detailsLoading = false;
        state.selectedUser = action.payload.user;
      })
      .addCase(fetchUserDetails.rejected, (state, action) => {
        state.detailsLoading = false;
        state.error = action.payload;
      });
  },
});

export const { clearUserListError, clearSelectedUser } = userListSlice.actions;

export default userListSlice.reducer;
