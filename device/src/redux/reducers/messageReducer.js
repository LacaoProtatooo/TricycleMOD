// messageReducer.js

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  conversations: [],
  messages: [],
  users: [],
  loading: false,
  error: null,
};

const messageSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    setLoading(state, action) {
      state.loading = action.payload;
    },
    setConversations(state, action) {
      state.conversations = action.payload;
    },
    setMessages(state, action) {
      state.messages = action.payload;
    },
    setUsers(state, action) {
      state.users = action.payload;
    },
    setError(state, action) {
      state.error = action.payload;
    },
    clearMessages(state) {
      state.messages = [];
    },
  },
});

export const {
  setLoading,
  setConversations,
  setMessages,
  setUsers,
  setError,
  clearMessages,
} = messageSlice.actions;

export default messageSlice.reducer;
