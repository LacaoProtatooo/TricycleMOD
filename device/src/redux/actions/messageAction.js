// messageAction.js

import axios from 'axios';
import Constants from 'expo-constants';
import { getToken } from '../../utils/jwtStorage';
import {
  setLoading,
  setConversations,
  setMessages,
  setUsers,
  setError
} from '../reducers/messageReducer';

const BACKEND_URL = Constants.expoConfig.extra.BACKEND_URL;

// Helper function
const getDbAndToken = async (getState) => {
  const state = getState();

  const db = state.db;
  if (!db) throw new Error('Database not initialized');

  const token = await getToken(db);
  if (!token) throw new Error('No authentication token found');

  return { db, token };
};

// SEND MESSAGE
export const sendMessage = (messageData) => async (dispatch, getState) => {
  try {
    dispatch(setLoading(true));
    const { token } = await getDbAndToken(getState);

    const response = await axios.post(
      `${BACKEND_URL}/api/messages/send`,
      messageData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    dispatch(setLoading(false));
    return response.data;

  } catch (error) {
    dispatch(setLoading(false));
    dispatch(setError(error.message));
    throw error;
  }
};

// GET ALL CONVERSATIONS
export const getConversations = (db) => async (dispatch) => {
  try {
    dispatch(setLoading(true));

    const token = await getToken(db);

    const response = await axios.get(
      `${BACKEND_URL}/api/messages/conversations`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    dispatch(setConversations(response.data.conversations));
    dispatch(setLoading(false));

  } catch (error) {
    dispatch(setLoading(false));
    dispatch(setError(error.message));
    throw error;
  }
};

// GET CONVERSATION WITH SPECIFIC USER
export const getConversation = (userId) => async (dispatch, getState) => {
  try {
    dispatch(setLoading(true));

    const { token } = await getDbAndToken(getState);

    const response = await axios.get(
      `${BACKEND_URL}/api/messages/conversation/${userId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    dispatch(setMessages(response.data.messages));
    dispatch(setLoading(false));

  } catch (error) {
    dispatch(setLoading(false));
    dispatch(setError(error.message));
    throw error;
  }
};

// MARK AS READ
export const markAsRead = (userId) => async (dispatch, getState) => {
  try {
    const { token } = await getDbAndToken(getState);

    await axios.put(
      `${BACKEND_URL}/api/messages/read/${userId}`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
  } catch (error) {
    dispatch(setError(error.message));
    throw error;
  }
};

// GET ALL USERS
export const getUsers = () => async (dispatch, getState) => {
  try {
    dispatch(setLoading(true));

    const { token } = await getDbAndToken(getState);

    const response = await axios.get(
      `${BACKEND_URL}/api/messages/users`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    dispatch(setUsers(response.data.users));
    dispatch(setLoading(false));

  } catch (error) {
    dispatch(setLoading(false));
    dispatch(setError(error.message));
    throw error;
  }
};
