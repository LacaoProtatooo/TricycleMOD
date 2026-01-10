import { configureStore } from '@reduxjs/toolkit';
import authReducer from './reducers/authReducer';
import userReducer from './reducers/userReducer';
import announcementReducer from './reducers/announcementReducer';
import driverReducer from './reducers/driverReducer';
import bookingReducer from './reducers/bookingReducer';
import operatorReducer from './reducers/operatorReducer';
import adminNotificationReducer from './reducers/adminNotificationReducer';
import dashboardReducer from './reducers/dashboardReducer';
import userListReducer from './reducers/userListReducer';
import adminLogsReducer from './reducers/adminLogsReducer';
import lostFoundReducer from './reducers/lostFoundReducer';
import leaderboardReducer from './reducers/leaderboardReducer';

const store = configureStore({
  reducer: {
    auth: authReducer,
    user: userReducer,
    announcement: announcementReducer,
    driver: driverReducer,
    booking: bookingReducer,
    operator: operatorReducer,
    adminNotification: adminNotificationReducer,
    dashboard: dashboardReducer,
    userList: userListReducer,
    adminLogs: adminLogsReducer,
    lostFound: lostFoundReducer,
    leaderboard: leaderboardReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types (file uploads and auth)
        ignoredActions: [
          'auth/googleLogin/fulfilled',
          'user/updateProfileImage/pending',
          'user/updateProfileImage/fulfilled',
          'user/updateProfileImage/rejected',
          'user/updateProfile/pending',
          'user/updateProfile/fulfilled',
          'user/updateProfile/rejected',
        ],
        // Ignore these field paths in all actions
        ignoredActionPaths: [
          'payload.createdAt',
          'payload.updatedAt',
          'meta.arg.imageFile',
          'meta.arg',
        ],
        // Ignore these paths in the state
        ignoredPaths: ['auth.user.createdAt', 'auth.user.updatedAt'],
      },
    }),
});

export default store;
