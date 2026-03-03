import { createAsyncThunk } from '@reduxjs/toolkit';
import { Alert } from 'react-native';

// Helper function to show success/error alerts
const showAlert = (title, message, isError = false) => {
  Alert.alert(title, message);
  return { success: !isError, error: isError ? message : null };
};

export const fetchOperatorData = createAsyncThunk(
  'operator/fetchData',
  async ({ token, BACKEND }, thunkAPI) => {
    try {
      const res = await fetch(`${BACKEND}/api/operator/overview`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      if (data.success) {
        return data;
      } else {
        return thunkAPI.rejectWithValue(data.message || 'Failed to fetch data');
      }
    } catch (error) {
      console.error('Error fetching operator data:', error);
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

export const approveSickLeave = createAsyncThunk(
  'operator/approveSickLeave',
  async ({ token, BACKEND, id }, thunkAPI) => {
    try {
      const res = await fetch(`${BACKEND}/api/sick-leave/${id}/approve`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        return data.data;
      }
      return thunkAPI.rejectWithValue(data.message || 'Failed to approve sick leave');
    } catch (error) {
      console.error('Error approving sick leave:', error);
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

export const assignDriver = createAsyncThunk(
  'operator/assignDriver',
  async ({ token, BACKEND, payload }, thunkAPI) => {
    try {
      const res = await fetch(`${BACKEND}/api/operator/assign-driver`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        Alert.alert('Success', 'Driver assigned successfully');
        // Refetch data after successful assignment
        thunkAPI.dispatch(fetchOperatorData({ token, BACKEND }));
        return { success: true, data };
      } else {
        Alert.alert('Error', data.message || 'Failed to assign driver');
        return thunkAPI.rejectWithValue(data.message);
      }
    } catch (error) {
      console.error('Error assigning driver:', error);
      Alert.alert('Error', 'Failed to assign driver. Please try again.');
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

export const unassignDriver = createAsyncThunk(
  'operator/unassignDriver',
  async ({ token, BACKEND, tricycleId, driverId = null }, thunkAPI) => {
    try {
      const payload = { tricycleId };
      if (driverId) payload.driverId = driverId;

      const res = await fetch(`${BACKEND}/api/operator/unassign-driver`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        Alert.alert('Success', 'Driver unassigned successfully');
        // Refetch data after successful unassignment
        thunkAPI.dispatch(fetchOperatorData({ token, BACKEND }));
        return { success: true, data };
      } else {
        Alert.alert('Error', data.message || 'Failed to unassign driver');
        return thunkAPI.rejectWithValue(data.message);
      }
    } catch (error) {
      console.error('Error unassigning driver:', error);
      Alert.alert('Error', 'Failed to unassign driver. Please try again.');
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

export const createTricycle = createAsyncThunk(
  'operator/createTricycle',
  async ({ token, BACKEND, tricycleData }, thunkAPI) => {
    try {
      const res = await fetch(`${BACKEND}/api/tricycles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          plateNumber: tricycleData.plateNumber,
          bodyNumber: tricycleData.bodyNumber,
          model: tricycleData.model,
          status: 'unavailable',
          currentOdometer: tricycleData.currentOdometer ? parseFloat(tricycleData.currentOdometer) : 0,
          codingDay: tricycleData.codingDay !== undefined ? tricycleData.codingDay : null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        Alert.alert('Success', 'Tricycle added successfully');
        // Refetch data after successful creation
        thunkAPI.dispatch(fetchOperatorData({ token, BACKEND }));
        return { success: true, data: data.tricycle || data.data };
      } else {
        Alert.alert('Error', data.message || 'Failed to create tricycle');
        return thunkAPI.rejectWithValue(data.message);
      }
    } catch (error) {
      console.error('Error creating tricycle:', error);
      Alert.alert('Error', 'Failed to create tricycle. Please try again.');
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

export const fetchSickLeaves = createAsyncThunk(
  'operator/fetchSickLeaves',
  async ({ token, BACKEND, status = '', startDate = '', endDate = '' }, thunkAPI) => {
    try {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const res = await fetch(`${BACKEND}/api/sick-leave/operator?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        return { sickLeaves: data.data, statistics: data.statistics };
      } else {
        return thunkAPI.rejectWithValue(data.message || 'Failed to fetch sick leaves');
      }
    } catch (error) {
      console.error('Error fetching sick leaves:', error);
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

export const rejectSickLeave = createAsyncThunk(
  'operator/rejectSickLeave',
  async ({ token, BACKEND, id, rejectionReason }, thunkAPI) => {
    try {
      const res = await fetch(`${BACKEND}/api/sick-leave/${id}/reject`, {
        method: 'PATCH',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rejectionReason }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        Alert.alert('Success', 'Sick leave request rejected');
        return data.data;
      }
      return thunkAPI.rejectWithValue(data.message || 'Failed to reject sick leave');
    } catch (error) {
      console.error('Error rejecting sick leave:', error);
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

export const scanReceipt = createAsyncThunk(
  'operator/scanReceipt',
  async ({ token, BACKEND, imageFormData }, thunkAPI) => {
    try {
      const res = await fetch(`${BACKEND}/api/operator/scan-receipt`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        body: imageFormData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        return data.data;
      } else {
        return thunkAPI.rejectWithValue(data.message || 'OCR failed');
      }
    } catch (error) {
      console.error('Upload error', error);
      return thunkAPI.rejectWithValue('Failed to upload image');
    }
  }
);

// Save receipt
export const saveReceipt = createAsyncThunk(
  'operator/saveReceipt',
  async ({ token, BACKEND, receiptData }, thunkAPI) => {
    try {
      const res = await fetch(`${BACKEND}/api/operator/receipts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(receiptData),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        return data.data;
      } else {
        return thunkAPI.rejectWithValue(data.message || 'Failed to save receipt');
      }
    } catch (error) {
      console.error('Save receipt error', error);
      return thunkAPI.rejectWithValue('Failed to save receipt');
    }
  }
);

// Fetch receipts
export const fetchReceipts = createAsyncThunk(
  'operator/fetchReceipts',
  async ({ token, BACKEND, filters = {} }, thunkAPI) => {
    try {
      const params = new URLSearchParams();
      if (filters.category) params.append('category', filters.category);
      if (filters.tricycleId) params.append('tricycleId', filters.tricycleId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.page) params.append('page', filters.page);
      if (filters.limit) params.append('limit', filters.limit);

      const res = await fetch(`${BACKEND}/api/operator/receipts?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();
      if (res.ok && data.success) {
        return data;
      } else {
        return thunkAPI.rejectWithValue(data.message || 'Failed to fetch receipts');
      }
    } catch (error) {
      console.error('Fetch receipts error', error);
      return thunkAPI.rejectWithValue('Failed to fetch receipts');
    }
  }
);

// Delete receipt
export const deleteReceipt = createAsyncThunk(
  'operator/deleteReceipt',
  async ({ token, BACKEND, receiptId }, thunkAPI) => {
    try {
      const res = await fetch(`${BACKEND}/api/operator/receipts/${receiptId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (res.ok && data.success) {
        return receiptId;
      } else {
        return thunkAPI.rejectWithValue(data.message || 'Failed to delete receipt');
      }
    } catch (error) {
      console.error('Delete receipt error', error);
      return thunkAPI.rejectWithValue('Failed to delete receipt');
    }
  }
);

// Get expense summary
export const fetchExpenseSummary = createAsyncThunk(
  'operator/fetchExpenseSummary',
  async ({ token, BACKEND, filters = {} }, thunkAPI) => {
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.groupBy) params.append('groupBy', filters.groupBy);

      const res = await fetch(`${BACKEND}/api/operator/receipts/summary?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();
      if (res.ok && data.success) {
        return data.data;
      } else {
        return thunkAPI.rejectWithValue(data.message || 'Failed to fetch summary');
      }
    } catch (error) {
      console.error('Fetch summary error', error);
      return thunkAPI.rejectWithValue('Failed to fetch expense summary');
    }
  }
);