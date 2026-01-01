import { createSlice } from '@reduxjs/toolkit';
import { fetchAdminLogs, fetchAdminLogDetails, fetchAdminLogStats } from '../actions/adminLogsAction';

const initialState = {
  logs: [],
  selectedLog: null,
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalLogs: 0,
    limit: 20,
  },
  filters: {
    actionTypes: [],
    admins: [],
  },
  stats: {
    totalActions: 0,
    actionsByType: [],
    actionsByAdmin: [],
    activityTimeline: [],
  },
  loading: false,
  detailsLoading: false,
  statsLoading: false,
  error: null,
};

const adminLogsSlice = createSlice({
  name: 'adminLogs',
  initialState,
  reducers: {
    clearAdminLogsError: (state) => {
      state.error = null;
    },
    clearSelectedLog: (state) => {
      state.selectedLog = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch admin logs
      .addCase(fetchAdminLogs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAdminLogs.fulfilled, (state, action) => {
        state.loading = false;
        state.logs = action.payload.logs;
        state.pagination = action.payload.pagination;
        state.filters = action.payload.filters;
      })
      .addCase(fetchAdminLogs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fetch log details
      .addCase(fetchAdminLogDetails.pending, (state) => {
        state.detailsLoading = true;
        state.error = null;
      })
      .addCase(fetchAdminLogDetails.fulfilled, (state, action) => {
        state.detailsLoading = false;
        state.selectedLog = action.payload.log;
      })
      .addCase(fetchAdminLogDetails.rejected, (state, action) => {
        state.detailsLoading = false;
        state.error = action.payload;
      })
      // Fetch stats
      .addCase(fetchAdminLogStats.pending, (state) => {
        state.statsLoading = true;
        state.error = null;
      })
      .addCase(fetchAdminLogStats.fulfilled, (state, action) => {
        state.statsLoading = false;
        state.stats = action.payload.stats;
      })
      .addCase(fetchAdminLogStats.rejected, (state, action) => {
        state.statsLoading = false;
        state.error = action.payload;
      });
  },
});

export const { clearAdminLogsError, clearSelectedLog } = adminLogsSlice.actions;

export default adminLogsSlice.reducer;
