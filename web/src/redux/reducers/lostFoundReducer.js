// reducers/lostFoundReducer.js - Redux reducer for admin lost & found management
import { createSlice } from '@reduxjs/toolkit';
import {
  fetchAllLostFound,
  fetchLostFoundStats,
  verifyLostFoundItem,
  deleteLostFoundItem,
} from '../actions/lostFoundAction';

const initialState = {
  // Lost & Found items list
  items: [],
  loading: false,
  error: null,

  // Statistics
  stats: null,
  statsLoading: false,
  statsError: null,

  // Action states
  verifyLoading: false,
  verifyError: null,
  deleteLoading: false,
  deleteError: null,

  // Filters
  statusFilter: '',
};

const lostFoundSlice = createSlice({
  name: 'lostFound',
  initialState,
  reducers: {
    clearLostFoundError: (state) => {
      state.error = null;
      state.verifyError = null;
      state.deleteError = null;
      state.statsError = null;
    },
    setStatusFilter: (state, action) => {
      state.statusFilter = action.payload;
    },
    resetLostFoundFilters: (state) => {
      state.statusFilter = '';
    },
  },
  extraReducers: (builder) => {
    // Fetch All Lost & Found Items
    builder
      .addCase(fetchAllLostFound.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllLostFound.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchAllLostFound.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch Lost & Found Stats
    builder
      .addCase(fetchLostFoundStats.pending, (state) => {
        state.statsLoading = true;
        state.statsError = null;
      })
      .addCase(fetchLostFoundStats.fulfilled, (state, action) => {
        state.statsLoading = false;
        state.stats = action.payload;
      })
      .addCase(fetchLostFoundStats.rejected, (state, action) => {
        state.statsLoading = false;
        state.statsError = action.payload;
      });

    // Verify Lost & Found Item
    builder
      .addCase(verifyLostFoundItem.pending, (state) => {
        state.verifyLoading = true;
        state.verifyError = null;
      })
      .addCase(verifyLostFoundItem.fulfilled, (state, action) => {
        state.verifyLoading = false;
        // Update the item in the list
        const index = state.items.findIndex(item => item._id === action.payload._id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
        // Update stats
        if (state.stats) {
          // Recalculate stats based on current items
          const posted = state.items.filter(item => item.status === 'posted').length;
          const claimed = state.items.filter(item => item.status === 'claimed').length;
          const returned = state.items.filter(item => item.status === 'returned').length;
          state.stats = { total: state.items.length, posted, claimed, returned };
        }
      })
      .addCase(verifyLostFoundItem.rejected, (state, action) => {
        state.verifyLoading = false;
        state.verifyError = action.payload;
      });

    // Delete Lost & Found Item
    builder
      .addCase(deleteLostFoundItem.pending, (state) => {
        state.deleteLoading = true;
        state.deleteError = null;
      })
      .addCase(deleteLostFoundItem.fulfilled, (state, action) => {
        state.deleteLoading = false;
        // Remove the item from the list
        state.items = state.items.filter(item => item._id !== action.payload);
        // Update stats
        if (state.stats) {
          state.stats.total = state.items.length;
          state.stats.posted = state.items.filter(item => item.status === 'posted').length;
          state.stats.claimed = state.items.filter(item => item.status === 'claimed').length;
          state.stats.returned = state.items.filter(item => item.status === 'returned').length;
        }
      })
      .addCase(deleteLostFoundItem.rejected, (state, action) => {
        state.deleteLoading = false;
        state.deleteError = action.payload;
      });
  },
});

export const { clearLostFoundError, setStatusFilter, resetLostFoundFilters } = lostFoundSlice.actions;
export default lostFoundSlice.reducer;
