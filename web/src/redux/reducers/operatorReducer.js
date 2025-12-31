import { createSlice } from '@reduxjs/toolkit';
import {
  fetchAllOperators,
  fetchOperatorDetails,
  fetchOperatorStats,
} from '../actions/operatorAction';

const initialState = {
  operators: [],
  total: 0,
  page: 1,
  pages: 1,
  loading: false,
  error: null,

  selectedOperator: null,
  selectedTricycles: [],
  detailsLoading: false,
  detailsError: null,

  stats: null,
  statsLoading: false,
  statsError: null,

  filters: {
    search: '',
  },
};

const operatorSlice = createSlice({
  name: 'operator',
  initialState,
  reducers: {
    clearSelectedOperator: (state) => {
      state.selectedOperator = null;
      state.selectedTricycles = [];
      state.detailsError = null;
    },
    setOperatorFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    resetOperatorFilters: (state) => {
      state.filters = initialState.filters;
    },
    clearOperatorError: (state) => {
      state.error = null;
      state.detailsError = null;
      state.statsError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch all operators
      .addCase(fetchAllOperators.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllOperators.fulfilled, (state, action) => {
        state.loading = false;
        state.operators = action.payload.operators || [];
        state.total = action.payload.total || 0;
        state.page = action.payload.page || 1;
        state.pages = action.payload.pages || 1;
      })
      .addCase(fetchAllOperators.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch operator details
      .addCase(fetchOperatorDetails.pending, (state) => {
        state.detailsLoading = true;
        state.detailsError = null;
      })
      .addCase(fetchOperatorDetails.fulfilled, (state, action) => {
        state.detailsLoading = false;
        state.selectedOperator = action.payload.operator;
        state.selectedTricycles = action.payload.tricycles || [];
      })
      .addCase(fetchOperatorDetails.rejected, (state, action) => {
        state.detailsLoading = false;
        state.detailsError = action.payload;
      })

      // Fetch operator stats
      .addCase(fetchOperatorStats.pending, (state) => {
        state.statsLoading = true;
        state.statsError = null;
      })
      .addCase(fetchOperatorStats.fulfilled, (state, action) => {
        state.statsLoading = false;
        state.stats = action.payload.stats;
      })
      .addCase(fetchOperatorStats.rejected, (state, action) => {
        state.statsLoading = false;
        state.statsError = action.payload;
      });
  },
});

export const {
  clearSelectedOperator,
  setOperatorFilters,
  resetOperatorFilters,
  clearOperatorError,
} = operatorSlice.actions;

export default operatorSlice.reducer;
