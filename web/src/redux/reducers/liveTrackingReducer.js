import { createSlice } from '@reduxjs/toolkit';
import { fetchActiveDrivers } from '../actions/liveTrackingAction';

const initialState = {
  // Online drivers data
  drivers: [], // Drivers with location on map
  driversNoLocation: [], // Online drivers without GPS location
  count: 0,
  totalOnline: 0,
  lastUpdated: null,
  
  // Loading and error states
  loading: false,
  error: null,
  
  // Selected driver for details view
  selectedDriver: null,
  
  // Map settings
  mapSettings: {
    showRoute: true,
    showServiceArea: true,
    autoRefresh: true,
    refreshInterval: 10000, // 10 seconds
  },
};

const liveTrackingSlice = createSlice({
  name: 'liveTracking',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    selectDriver: (state, action) => {
      state.selectedDriver = action.payload;
    },
    clearSelectedDriver: (state) => {
      state.selectedDriver = null;
    },
    updateMapSettings: (state, action) => {
      state.mapSettings = { ...state.mapSettings, ...action.payload };
    },
    toggleAutoRefresh: (state) => {
      state.mapSettings.autoRefresh = !state.mapSettings.autoRefresh;
    },
    toggleShowRoute: (state) => {
      state.mapSettings.showRoute = !state.mapSettings.showRoute;
    },
    toggleShowServiceArea: (state) => {
      state.mapSettings.showServiceArea = !state.mapSettings.showServiceArea;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch active drivers
      .addCase(fetchActiveDrivers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchActiveDrivers.fulfilled, (state, action) => {
        state.loading = false;
        state.drivers = action.payload.drivers || [];
        state.driversNoLocation = action.payload.driversNoLocation || [];
        state.count = action.payload.count || 0;
        state.totalOnline = action.payload.totalOnline || 0;
        state.lastUpdated = action.payload.timestamp || new Date().toISOString();
        state.error = null;
      })
      .addCase(fetchActiveDrivers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch active drivers';
      });
  },
});

export const {
  clearError,
  selectDriver,
  clearSelectedDriver,
  updateMapSettings,
  toggleAutoRefresh,
  toggleShowRoute,
  toggleShowServiceArea,
} = liveTrackingSlice.actions;

export default liveTrackingSlice.reducer;
