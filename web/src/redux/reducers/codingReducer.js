import { createSlice } from '@reduxjs/toolkit';
import {
  fetchCodingData,
  updateCodingDay,
  fetchCodingStats,
  fetchOperatorsForFilter,
} from '../actions/codingAction';

const initialState = {
  // Tricycles grouped by operator
  tricycles: [],
  operators: [], // List of all operators for filtering
  total: 0,
  page: 1,
  pages: 1,
  loading: false,
  error: null,

  // Stats
  stats: null,
  statsLoading: false,
  statsError: null,

  // Update state
  updateLoading: false,
  updateSuccess: false,
  updateError: null,

  // Operators loading
  operatorsLoading: false,
  operatorsError: null,

  // Filters
  filters: {
    search: '',
    operatorId: '',
    codingDay: '',
  },
};

// Days of the week mapping
export const DAYS_OF_WEEK = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

export const DAYS_SHORT = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

// Helper to check if today is coding day
export const isTodayCodingDay = (codingDay) => {
  if (codingDay === null || codingDay === undefined) return false;
  return new Date().getDay() === codingDay;
};

// Helper to get coding day name
export const getCodingDayName = (codingDay, short = false) => {
  if (codingDay === null || codingDay === undefined) return 'None';
  return short ? DAYS_SHORT[codingDay] : DAYS_OF_WEEK[codingDay];
};

const codingSlice = createSlice({
  name: 'coding',
  initialState,
  reducers: {
    setCodingFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    resetCodingFilters: (state) => {
      state.filters = initialState.filters;
    },
    clearUpdateStatus: (state) => {
      state.updateSuccess = false;
      state.updateError = null;
    },
    clearCodingError: (state) => {
      state.error = null;
      state.statsError = null;
      state.updateError = null;
      state.operatorsError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch coding data
      .addCase(fetchCodingData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCodingData.fulfilled, (state, action) => {
        state.loading = false;
        state.tricycles = action.payload.tricycles || [];
        state.total = action.payload.total || 0;
        state.page = action.payload.page || 1;
        state.pages = action.payload.pages || 1;
      })
      .addCase(fetchCodingData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Update coding day
      .addCase(updateCodingDay.pending, (state) => {
        state.updateLoading = true;
        state.updateError = null;
        state.updateSuccess = false;
      })
      .addCase(updateCodingDay.fulfilled, (state, action) => {
        state.updateLoading = false;
        state.updateSuccess = true;
        // Update the tricycle in the list
        const updatedTricycle = action.payload.tricycle;
        if (updatedTricycle) {
          const index = state.tricycles.findIndex(t => t._id === updatedTricycle._id);
          if (index !== -1) {
            state.tricycles[index] = { ...state.tricycles[index], ...updatedTricycle };
          }
        }
      })
      .addCase(updateCodingDay.rejected, (state, action) => {
        state.updateLoading = false;
        state.updateError = action.payload;
      })

      // Fetch coding stats
      .addCase(fetchCodingStats.pending, (state) => {
        state.statsLoading = true;
        state.statsError = null;
      })
      .addCase(fetchCodingStats.fulfilled, (state, action) => {
        state.statsLoading = false;
        state.stats = action.payload.stats;
      })
      .addCase(fetchCodingStats.rejected, (state, action) => {
        state.statsLoading = false;
        state.statsError = action.payload;
      })

      // Fetch operators for filter
      .addCase(fetchOperatorsForFilter.pending, (state) => {
        state.operatorsLoading = true;
        state.operatorsError = null;
      })
      .addCase(fetchOperatorsForFilter.fulfilled, (state, action) => {
        state.operatorsLoading = false;
        state.operators = action.payload.operators || [];
      })
      .addCase(fetchOperatorsForFilter.rejected, (state, action) => {
        state.operatorsLoading = false;
        state.operatorsError = action.payload;
      });
  },
});

export const {
  setCodingFilters,
  resetCodingFilters,
  clearUpdateStatus,
  clearCodingError,
} = codingSlice.actions;

export default codingSlice.reducer;
