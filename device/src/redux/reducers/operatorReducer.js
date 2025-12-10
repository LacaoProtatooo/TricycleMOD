import { createSlice } from '@reduxjs/toolkit';
import {
  fetchOperatorData,
  assignDriver,
  unassignDriver,
  createTricycle,
  fetchSickLeaves,
  scanReceipt
} from '../actions/operatorAction';

const initialState = {
  // Operator overview data
  tricycles: [],
  drivers: [],
  availableDrivers: [],
  
  // Sick leaves data
  sickLeaves: [],
  
  // Receipt scanner data
  receiptResult: null,
  
  // Loading states
  loading: false,
  loadingSickLeaves: false,
  loadingReceipt: false,
  assigning: false,
  creating: false,
  unassigning: false,
  
  // Error states
  error: null,
  errorSickLeaves: null,
  errorReceipt: null,
};

const operatorSlice = createSlice({
  name: 'operator',
  initialState,
  reducers: {
    // Clear operator data
    clearOperatorData: (state) => {
      state.tricycles = [];
      state.drivers = [];
      state.availableDrivers = [];
      state.sickLeaves = [];
      state.receiptResult = null;
      state.error = null;
      state.errorSickLeaves = null;
      state.errorReceipt = null;
    },
    
    // Clear receipt result
    clearReceiptResult: (state) => {
      state.receiptResult = null;
      state.errorReceipt = null;
    },
    
    // Clear errors
    clearErrors: (state) => {
      state.error = null;
      state.errorSickLeaves = null;
      state.errorReceipt = null;
    },
    
    // Manual update for testing/demo
    updateTricycles: (state, action) => {
      state.tricycles = action.payload;
    },
    
    updateAvailableDrivers: (state, action) => {
      state.availableDrivers = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // ========== FETCH OPERATOR DATA ==========
      .addCase(fetchOperatorData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchOperatorData.fulfilled, (state, action) => {
        state.loading = false;
        state.tricycles = action.payload.tricycles || [];
        state.drivers = action.payload.allDrivers || action.payload.drivers || [];
        state.availableDrivers = action.payload.availableDrivers || [];
      })
      .addCase(fetchOperatorData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // ========== ASSIGN DRIVER ==========
      .addCase(assignDriver.pending, (state) => {
        state.assigning = true;
      })
      .addCase(assignDriver.fulfilled, (state) => {
        state.assigning = false;
      })
      .addCase(assignDriver.rejected, (state, action) => {
        state.assigning = false;
        state.error = action.payload;
      })
      
      // ========== UNASSIGN DRIVER ==========
      .addCase(unassignDriver.pending, (state) => {
        state.unassigning = true;
      })
      .addCase(unassignDriver.fulfilled, (state) => {
        state.unassigning = false;
      })
      .addCase(unassignDriver.rejected, (state, action) => {
        state.unassigning = false;
        state.error = action.payload;
      })
      
      // ========== CREATE TRICYCLE ==========
      .addCase(createTricycle.pending, (state) => {
        state.creating = true;
      })
      .addCase(createTricycle.fulfilled, (state) => {
        state.creating = false;
      })
      .addCase(createTricycle.rejected, (state, action) => {
        state.creating = false;
        state.error = action.payload;
      })
      
      // ========== FETCH SICK LEAVES ==========
      .addCase(fetchSickLeaves.pending, (state) => {
        state.loadingSickLeaves = true;
        state.errorSickLeaves = null;
      })
      .addCase(fetchSickLeaves.fulfilled, (state, action) => {
        state.loadingSickLeaves = false;
        state.sickLeaves = action.payload || [];
      })
      .addCase(fetchSickLeaves.rejected, (state, action) => {
        state.loadingSickLeaves = false;
        state.errorSickLeaves = action.payload;
      })
      
      // ========== SCAN RECEIPT ==========
      .addCase(scanReceipt.pending, (state) => {
        state.loadingReceipt = true;
        state.errorReceipt = null;
        state.receiptResult = null;
      })
      .addCase(scanReceipt.fulfilled, (state, action) => {
        state.loadingReceipt = false;
        state.receiptResult = action.payload;
      })
      .addCase(scanReceipt.rejected, (state, action) => {
        state.loadingReceipt = false;
        state.errorReceipt = action.payload;
      });
  },
});

export const {
  clearOperatorData,
  clearReceiptResult,
  clearErrors,
  updateTricycles,
  updateAvailableDrivers
} = operatorSlice.actions;

export default operatorSlice.reducer;