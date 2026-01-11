// reducers/driverReducer.js - Redux reducer for driver/license management
import { createSlice } from '@reduxjs/toolkit';
import {
  fetchAllDrivers,
  fetchDriverDetails,
  verifyDriverLicense,
  rejectDriverLicense,
  deleteDriverLicense,
  fetchLicenseStats,
  suspendDriver,
  unsuspendDriver,
} from '../actions/driverAction';

const initialState = {
  // Drivers list
  drivers: [],
  total: 0,
  page: 1,
  pages: 1,
  loading: false,
  error: null,

  // Selected driver details
  selectedDriver: null,
  detailsLoading: false,
  detailsError: null,

  // License actions
  verifyLoading: false,
  verifySuccess: false,
  verifyError: null,
  rejectLoading: false,
  rejectSuccess: false,
  rejectError: null,
  deleteLoading: false,
  deleteSuccess: false,
  deleteError: null,

  // Suspension actions
  suspendLoading: false,
  suspendSuccess: false,
  suspendError: null,
  unsuspendLoading: false,
  unsuspendSuccess: false,
  unsuspendError: null,

  // Statistics
  stats: null,
  statsLoading: false,
  statsError: null,
};

const driverSlice = createSlice({
  name: 'driver',
  initialState,
  reducers: {
    clearDriverError: (state) => {
      state.error = null;
      state.detailsError = null;
      state.verifyError = null;
      state.rejectError = null;
      state.deleteError = null;
      state.statsError = null;
      state.suspendError = null;
      state.unsuspendError = null;
    },
    clearVerifyStatus: (state) => {
      state.verifySuccess = false;
      state.verifyError = null;
    },
    clearRejectStatus: (state) => {
      state.rejectSuccess = false;
      state.rejectError = null;
    },
    clearDeleteStatus: (state) => {
      state.deleteSuccess = false;
      state.deleteError = null;
    },
    clearSelectedDriver: (state) => {
      state.selectedDriver = null;
      state.detailsError = null;
    },
    clearSuspendStatus: (state) => {
      state.suspendSuccess = false;
      state.suspendError = null;
    },
    clearUnsuspendStatus: (state) => {
      state.unsuspendSuccess = false;
      state.unsuspendError = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch All Drivers
    builder
      .addCase(fetchAllDrivers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllDrivers.fulfilled, (state, action) => {
        state.loading = false;
        state.drivers = action.payload.drivers;
        state.total = action.payload.total;
        state.page = action.payload.page;
        state.pages = action.payload.pages;
      })
      .addCase(fetchAllDrivers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch Driver Details
    builder
      .addCase(fetchDriverDetails.pending, (state) => {
        state.detailsLoading = true;
        state.detailsError = null;
      })
      .addCase(fetchDriverDetails.fulfilled, (state, action) => {
        state.detailsLoading = false;
        state.selectedDriver = action.payload;
      })
      .addCase(fetchDriverDetails.rejected, (state, action) => {
        state.detailsLoading = false;
        state.detailsError = action.payload;
      });

    // Verify License
    builder
      .addCase(verifyDriverLicense.pending, (state) => {
        state.verifyLoading = true;
        state.verifyError = null;
      })
      .addCase(verifyDriverLicense.fulfilled, (state, action) => {
        state.verifyLoading = false;
        state.verifySuccess = true;
        // Update driver in list
        const driverId = action.payload.driver._id;
        const idx = state.drivers.findIndex((d) => d._id === driverId);
        if (idx !== -1) {
          state.drivers[idx] = {
            ...state.drivers[idx],
            license: action.payload.license,
            licenseStatus: 'verified',
          };
        }
        // Update selected driver
        if (state.selectedDriver?._id === driverId) {
          state.selectedDriver.license = action.payload.license;
          state.selectedDriver.licenseStatus = 'verified';
        }
      })
      .addCase(verifyDriverLicense.rejected, (state, action) => {
        state.verifyLoading = false;
        state.verifyError = action.payload;
      });

    // Reject License
    builder
      .addCase(rejectDriverLicense.pending, (state) => {
        state.rejectLoading = true;
        state.rejectError = null;
      })
      .addCase(rejectDriverLicense.fulfilled, (state, action) => {
        state.rejectLoading = false;
        state.rejectSuccess = true;
        // Update driver in list
        const driverId = action.payload.driver._id;
        const idx = state.drivers.findIndex((d) => d._id === driverId);
        if (idx !== -1) {
          state.drivers[idx] = {
            ...state.drivers[idx],
            license: action.payload.license,
            licenseStatus: 'pending',
          };
        }
        // Update selected driver
        if (state.selectedDriver?._id === driverId) {
          state.selectedDriver.license = action.payload.license;
          state.selectedDriver.licenseStatus = 'pending';
        }
      })
      .addCase(rejectDriverLicense.rejected, (state, action) => {
        state.rejectLoading = false;
        state.rejectError = action.payload;
      });

    // Delete License
    builder
      .addCase(deleteDriverLicense.pending, (state) => {
        state.deleteLoading = true;
        state.deleteError = null;
      })
      .addCase(deleteDriverLicense.fulfilled, (state, action) => {
        state.deleteLoading = false;
        state.deleteSuccess = true;
        // Update driver in list - remove license
        const idx = state.drivers.findIndex((d) => d.license?._id === action.payload);
        if (idx !== -1) {
          state.drivers[idx] = {
            ...state.drivers[idx],
            license: null,
            licenseStatus: 'none',
          };
        }
        // Update selected driver
        if (state.selectedDriver?.license?._id === action.payload) {
          state.selectedDriver.license = null;
          state.selectedDriver.licenseStatus = 'none';
        }
      })
      .addCase(deleteDriverLicense.rejected, (state, action) => {
        state.deleteLoading = false;
        state.deleteError = action.payload;
      });

    // Fetch License Stats
    builder
      .addCase(fetchLicenseStats.pending, (state) => {
        state.statsLoading = true;
        state.statsError = null;
      })
      .addCase(fetchLicenseStats.fulfilled, (state, action) => {
        state.statsLoading = false;
        state.stats = action.payload;
      })
      .addCase(fetchLicenseStats.rejected, (state, action) => {
        state.statsLoading = false;
        state.statsError = action.payload;
      });

    // Suspend Driver
    builder
      .addCase(suspendDriver.pending, (state) => {
        state.suspendLoading = true;
        state.suspendError = null;
      })
      .addCase(suspendDriver.fulfilled, (state, action) => {
        state.suspendLoading = false;
        state.suspendSuccess = true;
        // Update driver in list
        const driverId = action.payload._id;
        const idx = state.drivers.findIndex((d) => d._id === driverId);
        if (idx !== -1) {
          state.drivers[idx] = {
            ...state.drivers[idx],
            isSuspended: action.payload.isSuspended,
            suspendedUntil: action.payload.suspendedUntil,
            suspensionReason: action.payload.suspensionReason,
          };
        }
        // Update selected driver
        if (state.selectedDriver?._id === driverId) {
          state.selectedDriver.isSuspended = action.payload.isSuspended;
          state.selectedDriver.suspendedUntil = action.payload.suspendedUntil;
          state.selectedDriver.suspensionReason = action.payload.suspensionReason;
        }
      })
      .addCase(suspendDriver.rejected, (state, action) => {
        state.suspendLoading = false;
        state.suspendError = action.payload;
      });

    // Unsuspend Driver
    builder
      .addCase(unsuspendDriver.pending, (state) => {
        state.unsuspendLoading = true;
        state.unsuspendError = null;
      })
      .addCase(unsuspendDriver.fulfilled, (state, action) => {
        state.unsuspendLoading = false;
        state.unsuspendSuccess = true;
        // Update driver in list
        const driverId = action.payload._id;
        const idx = state.drivers.findIndex((d) => d._id === driverId);
        if (idx !== -1) {
          state.drivers[idx] = {
            ...state.drivers[idx],
            isSuspended: false,
            suspendedUntil: null,
            suspensionReason: null,
          };
        }
        // Update selected driver
        if (state.selectedDriver?._id === driverId) {
          state.selectedDriver.isSuspended = false;
          state.selectedDriver.suspendedUntil = null;
          state.selectedDriver.suspensionReason = null;
        }
      })
      .addCase(unsuspendDriver.rejected, (state, action) => {
        state.unsuspendLoading = false;
        state.unsuspendError = action.payload;
      });
  },
});

export const {
  clearDriverError,
  clearVerifyStatus,
  clearRejectStatus,
  clearDeleteStatus,
  clearSelectedDriver,
  clearSuspendStatus,
  clearUnsuspendStatus,
} = driverSlice.actions;

export default driverSlice.reducer;
