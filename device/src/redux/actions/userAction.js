// userAction.js
import { createAsyncThunk } from '@reduxjs/toolkit';
import Constants from 'expo-constants';
import { getUserCredentials, storeUserCredentials } from '../../utils/userStorage';
import { getToken } from '../../utils/jwtStorage';

const apiURL = Constants.expoConfig.extra?.BACKEND_URL || 'http://192.168.254.105:5000';

export const fetchCurrentUser = createAsyncThunk(
  'user/fetchCurrentUser',
  async (_, thunkAPI) => {
    try {
        // sa AsyncStorage lang ako nagfetch, sa update user na lang magfetch sa backend tapos update sa local storage
        // sa sqlite lang ung tokens, user credentials sa async storage
        const userCredentials = await getUserCredentials();
        if (!userCredentials) {
            return thunkAPI.rejectWithValue('No user credentials found');
        } else {
            console.log('User credentials:', userCredentials);
            return userCredentials;
        }
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

export const updateProfile = createAsyncThunk(
  'user/updateProfile',
  async ({ user, db }, thunkAPI) => {
    try {
      const token = await getToken(db);
      const formData = new FormData();
      formData.append('userId', user._id || user.id);
      formData.append('username', user.username);
      formData.append('firstname', user.firstname);
      formData.append('lastname', user.lastname);
      formData.append('email', user.email);
      
      if (user.address) {
        formData.append('address', JSON.stringify(user.address));
      }
      if (user.phone) {
        formData.append('phone', user.phone);
      }

      // Append image file if available
      if (user.image && user.image.url) {
        const localUri = user.image.url;
        const filename = localUri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image`;
        formData.append('image', { uri: localUri, name: filename, type });
      }
      
      // const res = await fetch(`${apiURL}/api/auth/update-profile`, {
      //   method: 'PUT',
      //   body: formData,
      // });
      const config = {
        method: 'PUT',
        body: formData,
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      };
      const res = await fetch(`${apiURL}/api/auth/update-profile`, config);
      const data = await res.json();

      if (data.success) {
        // Update AsyncStorage with the new user data
        await storeUserCredentials(data.user);
        return data.user;
      } else {
        return thunkAPI.rejectWithValue(data.message);
      }
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

export const uploadNotifToken = createAsyncThunk(
  'user/uploadNotifToken',
  async ({ token, id }, thunkAPI) => {
    console.log('Uploading token:', token, 'for user ID:', id);
    try {
      const res = await fetch(`${apiURL}/api/auth/store-fcm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ FCMToken: token, userId: id }),
      });
      const data = await res.json();
      console.log('Backend response:', data);
      if (data.success) {
        console.log('Token successfully uploaded to backend.');
        return data.token;
      } else {
        console.error('Backend error:', data.message);
        return thunkAPI.rejectWithValue(data.message);
      }
    } catch (error) {
      console.error('Error uploading token:', error.message);
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);




