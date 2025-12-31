// reducers/bookingReducer.js - Redux reducer for admin booking management
import { createSlice } from '@reduxjs/toolkit';
import {
  fetchAllBookings,
  fetchBookingDetails,
  fetchBookingStats,
} from '../actions/bookingAction';

const initialState = {
  // Bookings list
  bookings: [],
  total: 0,
  page: 1,
  pages: 1,
  loading: false,
  error: null,

  // Selected booking details
  selectedBooking: null,
  detailsLoading: false,
  detailsError: null,

  // Statistics
  stats: null,
  dailyRevenue: [],
  statsLoading: false,
  statsError: null,

  // Filters (persisted in state for UI)
  filters: {
    status: '',
    search: '',
    startDate: '',
    endDate: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  },
};

const bookingSlice = createSlice({
  name: 'booking',
  initialState,
  reducers: {
    clearBookingError: (state) => {
      state.error = null;
      state.detailsError = null;
      state.statsError = null;
    },
    clearSelectedBooking: (state) => {
      state.selectedBooking = null;
      state.detailsError = null;
    },
    setBookingFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    resetBookingFilters: (state) => {
      state.filters = initialState.filters;
    },
  },
  extraReducers: (builder) => {
    // Fetch All Bookings
    builder
      .addCase(fetchAllBookings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllBookings.fulfilled, (state, action) => {
        state.loading = false;
        state.bookings = action.payload.bookings;
        state.total = action.payload.total;
        state.page = action.payload.page;
        state.pages = action.payload.pages;
        // Also update stats if returned
        if (action.payload.stats) {
          state.stats = action.payload.stats;
        }
      })
      .addCase(fetchAllBookings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch Booking Details
    builder
      .addCase(fetchBookingDetails.pending, (state) => {
        state.detailsLoading = true;
        state.detailsError = null;
      })
      .addCase(fetchBookingDetails.fulfilled, (state, action) => {
        state.detailsLoading = false;
        state.selectedBooking = action.payload;
      })
      .addCase(fetchBookingDetails.rejected, (state, action) => {
        state.detailsLoading = false;
        state.detailsError = action.payload;
      });

    // Fetch Booking Stats
    builder
      .addCase(fetchBookingStats.pending, (state) => {
        state.statsLoading = true;
        state.statsError = null;
      })
      .addCase(fetchBookingStats.fulfilled, (state, action) => {
        state.statsLoading = false;
        state.stats = action.payload.stats;
        state.dailyRevenue = action.payload.dailyRevenue || [];
      })
      .addCase(fetchBookingStats.rejected, (state, action) => {
        state.statsLoading = false;
        state.statsError = action.payload;
      });
  },
});

export const {
  clearBookingError,
  clearSelectedBooking,
  setBookingFilters,
  resetBookingFilters,
} = bookingSlice.actions;

export default bookingSlice.reducer;
