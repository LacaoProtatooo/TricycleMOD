// actions/authAction.js
import { createAsyncThunk } from '@reduxjs/toolkit';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth } from '../../utils/firebase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Token storage helpers - exported for use in userAction.js
export const storeToken = (token) => {
  if (token && typeof token === 'string' && token.split('.').length === 3) {
    localStorage.setItem('adminToken', token);
  }
};

export const removeToken = () => {
  localStorage.removeItem('adminToken');
};

export const getToken = () => {
  const token = localStorage.getItem('adminToken');
  // Return null for missing, corrupted, or non-JWT values
  if (!token || token === 'null' || token === 'undefined' || token.split('.').length !== 3) {
    // Clean up bad value if present
    if (token) localStorage.removeItem('adminToken');
    return null;
  }
  return token;
};

// Store user data - exported for use in userAction.js
export const storeUserCredentials = (user) => {
  localStorage.setItem('adminUser', JSON.stringify(user));
};

export const removeUserCredentials = () => {
  localStorage.removeItem('adminUser');
};

export const getUserCredentials = () => {
  const user = localStorage.getItem('adminUser');
  return user ? JSON.parse(user) : null;
};

// Login with email and password
export const loginUser = createAsyncThunk(
  'auth/login',
  async ({ email, password }, thunkAPI) => {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.success) {
        // Check if user is admin
        if (data.user.role !== 'admin') {
          return thunkAPI.rejectWithValue('Access denied. Admin privileges required.');
        }

        // Store token and user data
        storeToken(data.token);
        storeUserCredentials(data.user);

        return { user: data.user, token: data.token };
      } else {
        return thunkAPI.rejectWithValue(data.message);
      }
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

// Google Login
export const googleLogin = createAsyncThunk(
  'auth/googleLogin',
  async (_, thunkAPI) => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });

      const result = await signInWithPopup(auth, provider);
      const firebaseIdToken = await result.user.getIdToken();

      // Send token to backend
      const res = await fetch(`${API_URL}/auth/googlelogin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ firebaseIdToken }),
      });

      const data = await res.json();

      if (data.success) {
        // Check if user is admin
        if (data.user.role !== 'admin') {
          // Sign out from Firebase
          await signOut(auth);
          return thunkAPI.rejectWithValue('Access denied. Admin privileges required.');
        }

        // Store token and user data
        storeToken(data.token);
        storeUserCredentials(data.user);

        return { user: data.user, token: data.token };
      } else {
        await signOut(auth);
        return thunkAPI.rejectWithValue(data.message);
      }
    } catch (error) {
      console.error('Google login error:', error);
      return thunkAPI.rejectWithValue(error.message || 'Google login failed');
    }
  }
);

// Logout
export const logoutUser = createAsyncThunk(
  'auth/logout',
  async (_, thunkAPI) => {
    try {
      const token = getToken();

      // Call backend logout
      if (token) {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }

      // Sign out from Firebase if signed in
      try {
        await signOut(auth);
      } catch (e) {
        // Ignore Firebase signout errors
      }

      // Clear local storage
      removeToken();
      removeUserCredentials();

      return null;
    } catch (error) {
      // Still clear local data even if API call fails
      removeToken();
      removeUserCredentials();
      return null;
    }
  }
);

// Verify current user (check if token is still valid)
export const verifyUser = createAsyncThunk(
  'auth/verifyUser',
  async (_, thunkAPI) => {
    try {
      const token = getToken();

      if (!token) {
        return thunkAPI.rejectWithValue('No token found');
      }

      const res = await fetch(`${API_URL}/auth/current-user`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (data.success) {
        // Verify user is still admin
        if (data.user.role !== 'admin') {
          removeToken();
          removeUserCredentials();
          return thunkAPI.rejectWithValue('Access denied. Admin privileges required.');
        }

        // Update stored user data
        storeUserCredentials(data.user);

        return { user: data.user, token };
      } else {
        removeToken();
        removeUserCredentials();
        return thunkAPI.rejectWithValue(data.message);
      }
    } catch (error) {
      removeToken();
      removeUserCredentials();
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);
