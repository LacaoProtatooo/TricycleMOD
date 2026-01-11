// reducers/complaintReducer.js - Redux reducer for admin complaint management
import { createSlice } from '@reduxjs/toolkit';
import {
  fetchAllComplaints,
  fetchComplaintDetails,
  updateComplaintStatus,
  resolveComplaint,
  addComplaintNote,
  fetchDriverComplaints,
} from '../actions/complaintAction';

const initialState = {
  // Complaints list
  complaints: [],
  total: 0,
  page: 1,
  pages: 1,
  loading: false,
  error: null,

  // Statistics
  stats: null,

  // Selected complaint details
  selectedComplaint: null,
  detailsLoading: false,
  detailsError: null,

  // Driver complaints
  driverComplaints: null,
  driverComplaintsLoading: false,
  driverComplaintsError: null,

  // Action states
  updating: false,
  updateError: null,

  // Filters (persisted in state for UI)
  filters: {
    status: '',
    category: '',
    search: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    minCredibility: '',
    maxCredibility: '',
    urgency: '',           // Sentiment analysis urgency filter
    priorityOnly: '',      // Filter for high priority complaints
  },
};

const complaintSlice = createSlice({
  name: 'complaint',
  initialState,
  reducers: {
    clearComplaintError: (state) => {
      state.error = null;
      state.detailsError = null;
      state.updateError = null;
    },
    clearSelectedComplaint: (state) => {
      state.selectedComplaint = null;
      state.detailsError = null;
    },
    setComplaintFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    resetComplaintFilters: (state) => {
      state.filters = initialState.filters;
    },
    clearDriverComplaints: (state) => {
      state.driverComplaints = null;
      state.driverComplaintsError = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch All Complaints
    builder
      .addCase(fetchAllComplaints.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllComplaints.fulfilled, (state, action) => {
        state.loading = false;
        state.complaints = action.payload.complaints;
        state.total = action.payload.pagination?.total || action.payload.total;
        state.page = action.payload.pagination?.page || action.payload.page;
        state.pages = action.payload.pagination?.pages || action.payload.pages;
        if (action.payload.stats) {
          state.stats = action.payload.stats;
        }
      })
      .addCase(fetchAllComplaints.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch Complaint Details
    builder
      .addCase(fetchComplaintDetails.pending, (state) => {
        state.detailsLoading = true;
        state.detailsError = null;
      })
      .addCase(fetchComplaintDetails.fulfilled, (state, action) => {
        state.detailsLoading = false;
        state.selectedComplaint = action.payload;
      })
      .addCase(fetchComplaintDetails.rejected, (state, action) => {
        state.detailsLoading = false;
        state.detailsError = action.payload;
      });

    // Update Complaint Status
    builder
      .addCase(updateComplaintStatus.pending, (state) => {
        state.updating = true;
        state.updateError = null;
      })
      .addCase(updateComplaintStatus.fulfilled, (state, action) => {
        state.updating = false;
        state.selectedComplaint = action.payload;
        // Update in list
        const index = state.complaints.findIndex(c => c._id === action.payload._id);
        if (index !== -1) {
          state.complaints[index] = action.payload;
        }
      })
      .addCase(updateComplaintStatus.rejected, (state, action) => {
        state.updating = false;
        state.updateError = action.payload;
      });

    // Resolve Complaint
    builder
      .addCase(resolveComplaint.pending, (state) => {
        state.updating = true;
        state.updateError = null;
      })
      .addCase(resolveComplaint.fulfilled, (state, action) => {
        state.updating = false;
        state.selectedComplaint = action.payload;
        // Update in list
        const index = state.complaints.findIndex(c => c._id === action.payload._id);
        if (index !== -1) {
          state.complaints[index] = action.payload;
        }
      })
      .addCase(resolveComplaint.rejected, (state, action) => {
        state.updating = false;
        state.updateError = action.payload;
      });

    // Add Note
    builder
      .addCase(addComplaintNote.pending, (state) => {
        state.updating = true;
      })
      .addCase(addComplaintNote.fulfilled, (state) => {
        state.updating = false;
      })
      .addCase(addComplaintNote.rejected, (state, action) => {
        state.updating = false;
        state.updateError = action.payload;
      });

    // Fetch Driver Complaints
    builder
      .addCase(fetchDriverComplaints.pending, (state) => {
        state.driverComplaintsLoading = true;
        state.driverComplaintsError = null;
      })
      .addCase(fetchDriverComplaints.fulfilled, (state, action) => {
        state.driverComplaintsLoading = false;
        state.driverComplaints = action.payload;
      })
      .addCase(fetchDriverComplaints.rejected, (state, action) => {
        state.driverComplaintsLoading = false;
        state.driverComplaintsError = action.payload;
      });
  },
});

export const {
  clearComplaintError,
  clearSelectedComplaint,
  setComplaintFilters,
  resetComplaintFilters,
  clearDriverComplaints,
} = complaintSlice.actions;

export default complaintSlice.reducer;
