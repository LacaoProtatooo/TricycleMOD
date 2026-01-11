import { createSlice } from '@reduxjs/toolkit';
import {
  fetchOperatorData,
  assignDriver,
  unassignDriver,
  createTricycle,
  fetchSickLeaves,
  rejectSickLeave,
  scanReceipt,
  saveReceipt,
  fetchReceipts,
  deleteReceipt,
  fetchExpenseSummary
} from '../actions/operatorAction';
import {
  approveSickLeave,
} from '../actions/operatorAction';
import { logoutUser } from '../actions/authAction';

const initialState = {
  // Operator overview data
  tricycles: [],
  drivers: [],
  availableDrivers: [],
  
  // Sick leaves data
  sickLeaves: [],
  sickLeaveStatistics: null,
  
  // Receipt scanner data
  receiptResult: null,
  receipts: [],
  receiptsPagination: null,
  categoryTotals: {},
  expenseSummary: null,
  
  // Loading states
  loading: false,
  loadingSickLeaves: false,
  loadingReceipt: false,
  loadingReceipts: false,
  savingReceipt: false,
  deletingReceipt: false,
  loadingSummary: false,
  assigning: false,
  creating: false,
  unassigning: false,
  
  // Error states
  error: null,
  errorSickLeaves: null,
  errorReceipt: null,
  errorReceipts: null,
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
    
    // Clear receipts list
    clearReceipts: (state) => {
      state.receipts = [];
      state.receiptsPagination = null;
      state.categoryTotals = {};
      state.errorReceipts = null;
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
        state.sickLeaves = action.payload.sickLeaves || [];
        state.sickLeaveStatistics = action.payload.statistics || null;
      })
      .addCase(fetchSickLeaves.rejected, (state, action) => {
        state.loadingSickLeaves = false;
        state.errorSickLeaves = action.payload;
      })

        // ========== APPROVE SICK LEAVE ==========
        .addCase(approveSickLeave.pending, (state) => {
          state.errorSickLeaves = null;
        })
        .addCase(approveSickLeave.fulfilled, (state, action) => {
          const updated = action.payload;
          if (updated?._id) {
            state.sickLeaves = state.sickLeaves.map((sl) => sl._id === updated._id ? updated : sl);
          }
        })
        .addCase(approveSickLeave.rejected, (state, action) => {
          state.errorSickLeaves = action.payload;
        })
        
        // ========== REJECT SICK LEAVE ==========
        .addCase(rejectSickLeave.pending, (state) => {
          state.errorSickLeaves = null;
        })
        .addCase(rejectSickLeave.fulfilled, (state, action) => {
          const updated = action.payload;
          if (updated?._id) {
            state.sickLeaves = state.sickLeaves.map((sl) => sl._id === updated._id ? updated : sl);
          }
        })
        .addCase(rejectSickLeave.rejected, (state, action) => {
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
      })
      
      // ========== SAVE RECEIPT ==========
      .addCase(saveReceipt.pending, (state) => {
        state.savingReceipt = true;
        state.errorReceipt = null;
      })
      .addCase(saveReceipt.fulfilled, (state, action) => {
        state.savingReceipt = false;
        state.receipts = [action.payload, ...state.receipts];
      })
      .addCase(saveReceipt.rejected, (state, action) => {
        state.savingReceipt = false;
        state.errorReceipt = action.payload;
      })
      
      // ========== FETCH RECEIPTS ==========
      .addCase(fetchReceipts.pending, (state) => {
        state.loadingReceipts = true;
        state.errorReceipts = null;
      })
      .addCase(fetchReceipts.fulfilled, (state, action) => {
        state.loadingReceipts = false;
        state.receipts = action.payload.data || [];
        state.receiptsPagination = action.payload.pagination || null;
        state.categoryTotals = action.payload.categoryTotals || {};
      })
      .addCase(fetchReceipts.rejected, (state, action) => {
        state.loadingReceipts = false;
        state.errorReceipts = action.payload;
      })
      
      // ========== DELETE RECEIPT ==========
      .addCase(deleteReceipt.pending, (state) => {
        state.deletingReceipt = true;
      })
      .addCase(deleteReceipt.fulfilled, (state, action) => {
        state.deletingReceipt = false;
        state.receipts = state.receipts.filter(r => r._id !== action.payload);
      })
      .addCase(deleteReceipt.rejected, (state, action) => {
        state.deletingReceipt = false;
        state.errorReceipts = action.payload;
      })
      
      // ========== FETCH EXPENSE SUMMARY ==========
      .addCase(fetchExpenseSummary.pending, (state) => {
        state.loadingSummary = true;
      })
      .addCase(fetchExpenseSummary.fulfilled, (state, action) => {
        state.loadingSummary = false;
        state.expenseSummary = action.payload;
      })
      .addCase(fetchExpenseSummary.rejected, (state, action) => {
        state.loadingSummary = false;
      })
      
      // ========== LOGOUT - Clear all operator data ==========
      .addCase(logoutUser.fulfilled, (state) => {
        // Reset to initial state when user logs out
        state.tricycles = [];
        state.drivers = [];
        state.availableDrivers = [];
        state.sickLeaves = [];
        state.sickLeaveStatistics = null;
        state.receiptResult = null;
        state.receipts = [];
        state.receiptsPagination = null;
        state.categoryTotals = {};
        state.expenseSummary = null;
        state.loading = false;
        state.loadingSickLeaves = false;
        state.loadingReceipt = false;
        state.loadingReceipts = false;
        state.savingReceipt = false;
        state.deletingReceipt = false;
        state.loadingSummary = false;
        state.assigning = false;
        state.creating = false;
        state.unassigning = false;
        state.error = null;
        state.errorSickLeaves = null;
        state.errorReceipt = null;
        state.errorReceipts = null;
      });
  },
});

export const {
  clearOperatorData,
  clearReceiptResult,
  clearReceipts,
  clearErrors,
  updateTricycles,
  updateAvailableDrivers
} = operatorSlice.actions;

export default operatorSlice.reducer;