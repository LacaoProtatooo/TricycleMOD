import { createSlice } from '@reduxjs/toolkit';
import {
  fetchAdminNotifications,
  fetchNotificationCounts,
  markNotificationRead,
  markAllNotificationsRead,
} from '../actions/adminNotificationAction';

const initialState = {
  notifications: [],
  total: 0,
  page: 1,
  pages: 1,
  loading: false,
  error: null,

  counts: {
    disputes: 0,
    expiring: 0,
    total: 0,
  },
  countsLoading: false,
  countsError: null,
  
  markingRead: false,
  markReadError: null,
};

const adminNotificationSlice = createSlice({
  name: 'adminNotification',
  initialState,
  reducers: {
    clearNotifications: (state) => {
      state.notifications = [];
      state.total = 0;
      state.page = 1;
      state.pages = 1;
    },
    clearNotificationError: (state) => {
      state.error = null;
      state.countsError = null;
      state.markReadError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch notifications
      .addCase(fetchAdminNotifications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAdminNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.notifications = action.payload.notifications || [];
        state.total = action.payload.total || 0;
        state.page = action.payload.page || 1;
        state.pages = action.payload.pages || 1;
      })
      .addCase(fetchAdminNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch counts
      .addCase(fetchNotificationCounts.pending, (state) => {
        state.countsLoading = true;
        state.countsError = null;
      })
      .addCase(fetchNotificationCounts.fulfilled, (state, action) => {
        state.countsLoading = false;
        state.counts = action.payload.counts || { disputes: 0, expiring: 0, total: 0 };
      })
      .addCase(fetchNotificationCounts.rejected, (state, action) => {
        state.countsLoading = false;
        state.countsError = action.payload;
      })

      // Mark notification as read
      .addCase(markNotificationRead.pending, (state) => {
        state.markingRead = true;
        state.markReadError = null;
      })
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        state.markingRead = false;
        // Update the notification in the list
        const notificationId = action.payload.notificationId;
        const notification = state.notifications.find(n => n._id === notificationId);
        if (notification) {
          notification.isRead = true;
        }
        // Decrement the appropriate count
        if (notificationId.startsWith('dispute_')) {
          state.counts.disputes = Math.max(0, state.counts.disputes - 1);
        } else if (notificationId.startsWith('expiring_')) {
          state.counts.expiring = Math.max(0, state.counts.expiring - 1);
        }
        state.counts.total = state.counts.disputes + state.counts.expiring;
      })
      .addCase(markNotificationRead.rejected, (state, action) => {
        state.markingRead = false;
        state.markReadError = action.payload;
      })

      // Mark all notifications as read
      .addCase(markAllNotificationsRead.pending, (state) => {
        state.markingRead = true;
        state.markReadError = null;
      })
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        state.markingRead = false;
        // Mark all notifications as read
        state.notifications.forEach(n => {
          n.isRead = true;
        });
        // Reset counts
        state.counts = { disputes: 0, expiring: 0, total: 0 };
      })
      .addCase(markAllNotificationsRead.rejected, (state, action) => {
        state.markingRead = false;
        state.markReadError = action.payload;
      });
  },
});

export const {
  clearNotifications,
  clearNotificationError,
} = adminNotificationSlice.actions;

export default adminNotificationSlice.reducer;
