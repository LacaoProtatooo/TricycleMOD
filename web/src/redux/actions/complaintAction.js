// actions/complaintAction.js - Redux actions for admin complaint management
import { createAsyncThunk } from '@reduxjs/toolkit';
import { getToken } from './authAction';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Fetch all complaints with filters (Admin)
 */
export const fetchAllComplaints = createAsyncThunk(
  'complaint/fetchAllComplaints',
  async ({ 
    page = 1, 
    limit = 20, 
    status = '', 
    category = '',
    search = '',
    sortBy = 'createdAt',
    sortOrder = 'desc',
    minCredibility = '',
    maxCredibility = '',
  } = {}, thunkAPI) => {
    try {
      const token = getToken();
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', limit);
      if (status) params.append('status', status);
      if (category) params.append('category', category);
      if (search) params.append('search', search);
      if (minCredibility) params.append('minCredibility', minCredibility);
      if (maxCredibility) params.append('maxCredibility', maxCredibility);
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);

      const res = await fetch(`${API_URL}/complaints/admin/all?${params.toString()}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (data.success) {
        return data;
      } else {
        return thunkAPI.rejectWithValue(data.message);
      }
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

/**
 * Fetch single complaint details (Admin)
 */
export const fetchComplaintDetails = createAsyncThunk(
  'complaint/fetchComplaintDetails',
  async (complaintId, thunkAPI) => {
    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/complaints/${complaintId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (data.success) {
        return data.complaint;
      } else {
        return thunkAPI.rejectWithValue(data.message);
      }
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

/**
 * Update complaint status (Admin)
 */
export const updateComplaintStatus = createAsyncThunk(
  'complaint/updateStatus',
  async ({ complaintId, status, note }, thunkAPI) => {
    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/complaints/admin/${complaintId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, note }),
      });

      const data = await res.json();

      if (data.success) {
        return data.complaint;
      } else {
        return thunkAPI.rejectWithValue(data.message);
      }
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

/**
 * Resolve complaint with action (Admin)
 */
export const resolveComplaint = createAsyncThunk(
  'complaint/resolve',
  async ({ complaintId, action, details, isFalseComplaint }, thunkAPI) => {
    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/complaints/admin/${complaintId}/resolve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, details, isFalseComplaint }),
      });

      const data = await res.json();

      if (data.success) {
        return data.complaint;
      } else {
        return thunkAPI.rejectWithValue(data.message);
      }
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

/**
 * Add note to complaint (Admin)
 */
export const addComplaintNote = createAsyncThunk(
  'complaint/addNote',
  async ({ complaintId, note }, thunkAPI) => {
    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/complaints/admin/${complaintId}/note`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ note }),
      });

      const data = await res.json();

      if (data.success) {
        return { complaintId, note };
      } else {
        return thunkAPI.rejectWithValue(data.message);
      }
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

/**
 * Get driver complaint history (Admin)
 */
export const fetchDriverComplaints = createAsyncThunk(
  'complaint/fetchDriverComplaints',
  async (driverId, thunkAPI) => {
    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/complaints/admin/driver/${driverId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (data.success) {
        return data;
      } else {
        return thunkAPI.rejectWithValue(data.message);
      }
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);
