import { createSlice } from '@reduxjs/toolkit';
import { fetchUsersWithActivity, fetchUserDetails, changeUserRole } from '../actions/userListAction';

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
  roleChangeLoading: false,
  error: null,
  roleChangeSuccess: false,
  roleChangeError: null,
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
    clearRoleChangeStatus: (state) => {
      state.roleChangeSuccess = false;
      state.roleChangeError = null;
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
      })
      // Change user role
      .addCase(changeUserRole.pending, (state) => {
        state.roleChangeLoading = true;
        state.roleChangeError = null;
        state.roleChangeSuccess = false;
      })
      .addCase(changeUserRole.fulfilled, (state, action) => {
        state.roleChangeLoading = false;
        state.roleChangeSuccess = true;
        // Update the selected user's role
        if (state.selectedUser && state.selectedUser._id === action.payload.user._id) {
          state.selectedUser.role = action.payload.user.role;
        }
        // Update the user in the list
        const userIndex = state.users.findIndex(u => u._id === action.payload.user._id);
        if (userIndex !== -1) {
          state.users[userIndex].role = action.payload.user.role;
        }
      })
      .addCase(changeUserRole.rejected, (state, action) => {
        state.roleChangeLoading = false;
        state.roleChangeError = action.payload;
      });
  },
});

export const { clearUserListError, clearSelectedUser, clearRoleChangeStatus } = userListSlice.actions;

export default userListSlice.reducer;
