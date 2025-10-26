// userStorage.js
// User data is stored in AsyncStorage

import AsyncStorage from '@react-native-async-storage/async-storage';

export const storeUserCredentials = async (user) => {
  try {
    // Remove existing user data (if any)
    await AsyncStorage.removeItem('user');
    // Store the new user data as a JSON string
    await AsyncStorage.setItem('user', JSON.stringify(user));
    // console.log('User credentials stored successfully (AsyncStorage):', user);
  } catch (error) {
    console.error('Error storing user credentials:', error);
  }
};

export const getUserCredentials = async () => {
  try {
    const data = await AsyncStorage.getItem('user');
    // console.log('User credentials retrieved successfully (AsyncStorage):', data);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error retrieving user credentials:', error);
    return null;
  }
};

export const removeUserCredentials = async () => {
  try {
    await AsyncStorage.removeItem('user');
    console.log('User credentials removed successfully (AsyncStorage)');
  } catch (error) {
    console.error('Error removing user credentials:', error);
  }
};
