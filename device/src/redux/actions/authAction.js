// actions/authAction.js
import { createAsyncThunk } from '@reduxjs/toolkit';
import Constants from 'expo-constants';
import { storeToken, removeToken, getToken } from '../../utils/jwtStorage';
import { removeUserCredentials, storeUserCredentials } from '../../utils/userStorage';
const apiURL = Constants.expoConfig.extra?.BACKEND_URL || 'http://192.168.1.123:5000';

export const loginUser = createAsyncThunk(
  'auth/login',
  async ({ email, password, db }, thunkAPI) => {
    try {
      const token = await getToken(db);
      const res = await fetch(`${apiURL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
         },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        // save JWT on sqlite
        await storeToken(db, data.token);
        await storeUserCredentials(data.user);
        console.log('User credentials stored successfully:', data.user);
        return data.user;
      } else {
        return thunkAPI.rejectWithValue(data.message);
      }
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

export const signupUser = createAsyncThunk(
  'auth/signup',
  async ({ username, firstname, lastname, email, password, address, phone, image }, thunkAPI) => {
    try {
      const res = await fetch(`${apiURL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, firstname, lastname, email, password, address, phone, image }),
      });
      const data = await res.json();
      if (data.success) {
        return data.user;
      } else {
        return thunkAPI.rejectWithValue(data.message);
      }
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logout',
  async (db, thunkAPI) => {
    try {
      await removeToken(db);
      await removeUserCredentials();
      console.log('User logged out successfully');
      return;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

// New thunk for Google Login using token storage
export const googleLogin = createAsyncThunk(
  'auth/googleLogin',
  async ({ firebaseIdToken, db }, thunkAPI) => {
    try {
      const res = await fetch(`${apiURL}/api/auth/googlelogin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firebaseIdToken }),
      });
      const data = await res.json();
      if (data.success) {
        // Store only the token locally 
        await storeToken(db, data.token);
        await storeUserCredentials(data.user);
        console.log('Google login successful:', data.user);
        return data.user;
      } else {
        return thunkAPI.rejectWithValue(data.message);
      }
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

// actions/authAction.js
// New thunk for verifying the stored token with the backend
export const verifyUser = createAsyncThunk(
  'auth/verifyUser',
  async ({ db }, thunkAPI) => {
    try {
      // Retrieve token from SQLite
      const token = await getToken(db);
      if (!token) {
        return thunkAPI.rejectWithValue("No token found");
      }
      // Call the backend endpoint to verify the token
      const res = await fetch(`${apiURL}/api/auth/current-user`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        // Optionally update token if backend returns a refreshed one
        await storeUserCredentials(data.user);
        console.log("Token verified, user fetched:", data.user);
        return data.user;
      } else {
        // If token is invalid, clear it locally
        await removeToken(db);
        await removeUserCredentials();
        return thunkAPI.rejectWithValue(data.message || "Token verification failed");
      }
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);
