// actions/driverAction.js - Redux actions for driver/license management
import { createAsyncThunk } from '@reduxjs/toolkit';
import { getToken } from './authAction';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Fetch all drivers with their license status
 */
export const fetchAllDrivers = createAsyncThunk(
  'driver/fetchAllDrivers',
  async ({ page = 1, limit = 20, search = '', licenseStatus = '' } = {}, thunkAPI) => {
    try {
      const token = getToken();
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', limit);
      if (search) params.append('search', search);
      if (licenseStatus) params.append('licenseStatus', licenseStatus);

      const res = await fetch(`${API_URL}/license/admin/drivers?${params.toString()}`, {
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
 * Fetch single driver details
 */
export const fetchDriverDetails = createAsyncThunk(
  'driver/fetchDriverDetails',
  async (driverId, thunkAPI) => {
    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/license/admin/drivers/${driverId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (data.success) {
        return data.driver;
      } else {
        return thunkAPI.rejectWithValue(data.message);
      }
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

/**
 * Verify a driver's license
 */
export const verifyDriverLicense = createAsyncThunk(
  'driver/verifyLicense',
  async (licenseId, thunkAPI) => {
    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/license/admin/verify/${licenseId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();

      if (data.success) {
        return { license: data.license, driver: data.driver };
      } else {
        return thunkAPI.rejectWithValue(data.message);
      }
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

/**
 * Reject/Unverify a driver's license
 */
export const rejectDriverLicense = createAsyncThunk(
  'driver/rejectLicense',
  async ({ licenseId, reason }, thunkAPI) => {
    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/license/admin/reject/${licenseId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });

      const data = await res.json();

      if (data.success) {
        return { license: data.license, driver: data.driver };
      } else {
        return thunkAPI.rejectWithValue(data.message);
      }
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

/**
 * Delete a license
 */
export const deleteDriverLicense = createAsyncThunk(
  'driver/deleteLicense',
  async (licenseId, thunkAPI) => {
    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/license/admin/${licenseId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (data.success) {
        return licenseId;
      } else {
        return thunkAPI.rejectWithValue(data.message);
      }
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

/**
 * Fetch license statistics
 */
export const fetchLicenseStats = createAsyncThunk(
  'driver/fetchLicenseStats',
  async (_, thunkAPI) => {
    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/license/admin/stats`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (data.success) {
        return data.stats;
      } else {
        return thunkAPI.rejectWithValue(data.message);
      }
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

/**
 * Suspend a driver
 */
export const suspendDriver = createAsyncThunk(
  'driver/suspendDriver',
  async ({ driverId, days, reason, ruleViolated, offenseNumber }, thunkAPI) => {
    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/admin/drivers/${driverId}/suspend`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ days, reason, ruleViolated, offenseNumber }),
      });

      const data = await res.json();

      if (data.success) {
        return data.user;
      } else {
        return thunkAPI.rejectWithValue(data.message);
      }
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

/**
 * Unsuspend a driver
 */
export const unsuspendDriver = createAsyncThunk(
  'driver/unsuspendDriver',
  async (driverId, thunkAPI) => {
    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/admin/drivers/${driverId}/unsuspend`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (data.success) {
        return data.user;
      } else {
        return thunkAPI.rejectWithValue(data.message);
      }
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);
