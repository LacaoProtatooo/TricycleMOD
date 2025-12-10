import { configureStore } from '@reduxjs/toolkit';
import authReducer from './reducers/authReducer';
import userReducer from './reducers/userReducer';
import notificationReducer from './reducers/notificationReducer';
import messageReducer from './reducers/messageReducer';
import operatorReducer from './reducers/operatorReducer';

const store = configureStore({
  reducer: {
    auth: authReducer,
    user: userReducer,
    notifications: notificationReducer,
    messages: messageReducer,
    operator: operatorReducer,
  },
});

export default store;
