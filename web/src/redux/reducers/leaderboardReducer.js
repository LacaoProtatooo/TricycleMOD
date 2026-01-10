// reducers/leaderboardReducer.js - Redux reducer for leaderboard state
import { createSlice } from '@reduxjs/toolkit';
import {
  fetchLeaderboard,
  fetchAllTimeLeaderboard,
  fetchAvailableMonths,
} from '../actions/leaderboardAction';

const initialState = {
  // Monthly leaderboard
  leaderboard: [],
  period: null,
  userRank: null,
  loading: false,
  error: null,

  // All-time leaderboard
  allTimeLeaderboard: [],
  allTimeUserRank: null,
  allTimeLoading: false,
  allTimeError: null,

  // Available months
  availableMonths: [],
  monthsLoading: false,
  monthsError: null,
};

const leaderboardSlice = createSlice({
  name: 'leaderboard',
  initialState,
  reducers: {
    clearLeaderboardError: (state) => {
      state.error = null;
      state.allTimeError = null;
      state.monthsError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Monthly Leaderboard
      .addCase(fetchLeaderboard.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLeaderboard.fulfilled, (state, action) => {
        state.loading = false;
        state.leaderboard = action.payload.leaderboard;
        state.period = action.payload.period;
        state.userRank = action.payload.userRank;
      })
      .addCase(fetchLeaderboard.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch All-Time Leaderboard
      .addCase(fetchAllTimeLeaderboard.pending, (state) => {
        state.allTimeLoading = true;
        state.allTimeError = null;
      })
      .addCase(fetchAllTimeLeaderboard.fulfilled, (state, action) => {
        state.allTimeLoading = false;
        state.allTimeLeaderboard = action.payload.leaderboard;
        state.allTimeUserRank = action.payload.userRank;
      })
      .addCase(fetchAllTimeLeaderboard.rejected, (state, action) => {
        state.allTimeLoading = false;
        state.allTimeError = action.payload;
      })

      // Fetch Available Months
      .addCase(fetchAvailableMonths.pending, (state) => {
        state.monthsLoading = true;
        state.monthsError = null;
      })
      .addCase(fetchAvailableMonths.fulfilled, (state, action) => {
        state.monthsLoading = false;
        state.availableMonths = action.payload;
      })
      .addCase(fetchAvailableMonths.rejected, (state, action) => {
        state.monthsLoading = false;
        state.monthsError = action.payload;
      });
  },
});

export const { clearLeaderboardError } = leaderboardSlice.actions;
export default leaderboardSlice.reducer;
