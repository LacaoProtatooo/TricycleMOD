/**
 * bookingAction.js - Redux actions for booking/special trips
 */

import axios from 'axios';
import Constants from 'expo-constants';
import { getToken } from '../../utils/jwtStorage';

const BACKEND_URL = Constants.expoConfig?.extra?.BACKEND_URL || 'http://192.168.254.105:5000';
const API_URL = `${BACKEND_URL}/api/booking`;

// Action Types
export const BOOKING_TYPES = {
  // Create booking
  CREATE_BOOKING_REQUEST: 'CREATE_BOOKING_REQUEST',
  CREATE_BOOKING_SUCCESS: 'CREATE_BOOKING_SUCCESS',
  CREATE_BOOKING_FAIL: 'CREATE_BOOKING_FAIL',
  
  // Get user's bookings
  GET_BOOKINGS_REQUEST: 'GET_BOOKINGS_REQUEST',
  GET_BOOKINGS_SUCCESS: 'GET_BOOKINGS_SUCCESS',
  GET_BOOKINGS_FAIL: 'GET_BOOKINGS_FAIL',
  
  // Get single booking
  GET_BOOKING_REQUEST: 'GET_BOOKING_REQUEST',
  GET_BOOKING_SUCCESS: 'GET_BOOKING_SUCCESS',
  GET_BOOKING_FAIL: 'GET_BOOKING_FAIL',
  
  // Get active booking
  GET_ACTIVE_BOOKING_REQUEST: 'GET_ACTIVE_BOOKING_REQUEST',
  GET_ACTIVE_BOOKING_SUCCESS: 'GET_ACTIVE_BOOKING_SUCCESS',
  GET_ACTIVE_BOOKING_FAIL: 'GET_ACTIVE_BOOKING_FAIL',
  
  // Respond to driver offer
  RESPOND_OFFER_REQUEST: 'RESPOND_OFFER_REQUEST',
  RESPOND_OFFER_SUCCESS: 'RESPOND_OFFER_SUCCESS',
  RESPOND_OFFER_FAIL: 'RESPOND_OFFER_FAIL',
  
  // Complete trip
  COMPLETE_TRIP_REQUEST: 'COMPLETE_TRIP_REQUEST',
  COMPLETE_TRIP_SUCCESS: 'COMPLETE_TRIP_SUCCESS',
  COMPLETE_TRIP_FAIL: 'COMPLETE_TRIP_FAIL',
  
  // Cancel booking
  CANCEL_BOOKING_REQUEST: 'CANCEL_BOOKING_REQUEST',
  CANCEL_BOOKING_SUCCESS: 'CANCEL_BOOKING_SUCCESS',
  CANCEL_BOOKING_FAIL: 'CANCEL_BOOKING_FAIL',
  
  // Rate driver
  RATE_DRIVER_REQUEST: 'RATE_DRIVER_REQUEST',
  RATE_DRIVER_SUCCESS: 'RATE_DRIVER_SUCCESS',
  RATE_DRIVER_FAIL: 'RATE_DRIVER_FAIL',
  
  // Real-time updates
  UPDATE_BOOKING_STATUS: 'UPDATE_BOOKING_STATUS',
  RECEIVE_DRIVER_OFFER: 'RECEIVE_DRIVER_OFFER',
  
  // Clear states
  CLEAR_BOOKING_ERROR: 'CLEAR_BOOKING_ERROR',
  RESET_BOOKING_STATE: 'RESET_BOOKING_STATE',
};

// Helper function to get token from SQLite
const getAuthToken = async (db) => {
  if (!db) throw new Error('Database not initialized');
  const token = await getToken(db);
  if (!token) throw new Error('No authentication token found');
  return token;
};

/**
 * Create a new booking/special trip request
 * @param {Object} bookingData - Booking data
 * @param {Object} db - SQLite database instance
 */
export const createBooking = (bookingData, db) => async (dispatch) => {
  try {
    dispatch({ type: BOOKING_TYPES.CREATE_BOOKING_REQUEST });

    const token = await getAuthToken(db);
    const config = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    };

    const { data } = await axios.post(`${API_URL}/create`, bookingData, config);

    dispatch({
      type: BOOKING_TYPES.CREATE_BOOKING_SUCCESS,
      payload: data.booking,
    });

    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Failed to create booking';
    dispatch({
      type: BOOKING_TYPES.CREATE_BOOKING_FAIL,
      payload: message,
    });
    throw error;
  }
};

/**
 * Get user's booking history
 */
export const getUserBookings = (db, page = 1, limit = 10) => async (dispatch) => {
  try {
    dispatch({ type: BOOKING_TYPES.GET_BOOKINGS_REQUEST });

    const token = await getAuthToken(db);
    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    const { data } = await axios.get(
      `${API_URL}/user?page=${page}&limit=${limit}`,
      config
    );

    dispatch({
      type: BOOKING_TYPES.GET_BOOKINGS_SUCCESS,
      payload: data,
    });

    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Failed to fetch bookings';
    dispatch({
      type: BOOKING_TYPES.GET_BOOKINGS_FAIL,
      payload: message,
    });
    throw error;
  }
};

/**
 * Get single booking details
 */
export const getBookingDetails = (bookingId, db) => async (dispatch) => {
  try {
    dispatch({ type: BOOKING_TYPES.GET_BOOKING_REQUEST });

    const token = await getAuthToken(db);
    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    const { data } = await axios.get(`${API_URL}/${bookingId}`, config);

    dispatch({
      type: BOOKING_TYPES.GET_BOOKING_SUCCESS,
      payload: data.booking,
    });

    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Failed to fetch booking';
    dispatch({
      type: BOOKING_TYPES.GET_BOOKING_FAIL,
      payload: message,
    });
    throw error;
  }
};

/**
 * Get user's active booking (pending, offer_made, accepted, in_progress, awaiting_confirmation)
 */
export const getActiveBooking = (db) => async (dispatch) => {
  try {
    dispatch({ type: BOOKING_TYPES.GET_ACTIVE_BOOKING_REQUEST });

    const token = await getAuthToken(db);
    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    const { data } = await axios.get(`${API_URL}/active`, config);

    dispatch({
      type: BOOKING_TYPES.GET_ACTIVE_BOOKING_SUCCESS,
      payload: data.booking,
    });

    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Failed to fetch active booking';
    dispatch({
      type: BOOKING_TYPES.GET_ACTIVE_BOOKING_FAIL,
      payload: message,
    });
    // Don't throw - no active booking is okay
    return { booking: null };
  }
};

/**
 * Respond to driver's fare offer (accept or decline)
 */
export const respondToOffer = ({ bookingId, accepted, db }) => async (dispatch) => {
  try {
    dispatch({ type: BOOKING_TYPES.RESPOND_OFFER_REQUEST });

    const token = await getAuthToken(db);
    const config = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    };

    const { data } = await axios.post(
      `${API_URL}/${bookingId}/respond-offer`,
      { accepted },
      config
    );

    dispatch({
      type: BOOKING_TYPES.RESPOND_OFFER_SUCCESS,
      payload: data.booking,
    });

    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Failed to respond to offer';
    dispatch({
      type: BOOKING_TYPES.RESPOND_OFFER_FAIL,
      payload: message,
    });
    throw error;
  }
};

/**
 * Complete the trip (user confirms arrival at destination)
 * This is called when user confirms the driver's completion
 */
export const completeTrip = ({ bookingId, db, confirmed = true, disputeReason = null }) => async (dispatch) => {
  try {
    dispatch({ type: BOOKING_TYPES.COMPLETE_TRIP_REQUEST });

    const token = await getAuthToken(db);
    const config = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    };

    const { data } = await axios.post(
      `${API_URL}/${bookingId}/confirm-completion`,
      { confirmed, disputeReason },
      config
    );

    dispatch({
      type: BOOKING_TYPES.COMPLETE_TRIP_SUCCESS,
      payload: data.booking,
    });

    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Failed to complete trip';
    dispatch({
      type: BOOKING_TYPES.COMPLETE_TRIP_FAIL,
      payload: message,
    });
    throw error;
  }
};

/**
 * Cancel a booking
 */
export const cancelBooking = ({ bookingId, reason, db }) => async (dispatch) => {
  try {
    dispatch({ type: BOOKING_TYPES.CANCEL_BOOKING_REQUEST });

    const token = await getAuthToken(db);
    const config = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    };

    const { data } = await axios.post(
      `${API_URL}/${bookingId}/cancel`,
      { reason },
      config
    );

    dispatch({
      type: BOOKING_TYPES.CANCEL_BOOKING_SUCCESS,
      payload: data.booking,
    });

    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Failed to cancel booking';
    dispatch({
      type: BOOKING_TYPES.CANCEL_BOOKING_FAIL,
      payload: message,
    });
    throw error;
  }
};

/**
 * Rate the driver after trip completion
 */
export const rateDriver = ({ bookingId, driverId, rating, comment, db }) => async (dispatch) => {
  try {
    dispatch({ type: BOOKING_TYPES.RATE_DRIVER_REQUEST });

    const token = await getAuthToken(db);
    const config = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    };

    const { data } = await axios.post(
      `${API_URL}/${bookingId}/rate`,
      { driverId, rating, comment },
      config
    );

    dispatch({
      type: BOOKING_TYPES.RATE_DRIVER_SUCCESS,
      payload: data,
    });

    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Failed to submit rating';
    dispatch({
      type: BOOKING_TYPES.RATE_DRIVER_FAIL,
      payload: message,
    });
    throw error;
  }
};

/**
 * Update booking status (for real-time updates via socket/polling)
 */
export const updateBookingStatus = (booking) => ({
  type: BOOKING_TYPES.UPDATE_BOOKING_STATUS,
  payload: booking,
});

/**
 * Receive driver offer (for real-time updates)
 */
export const receiveDriverOffer = (offer) => ({
  type: BOOKING_TYPES.RECEIVE_DRIVER_OFFER,
  payload: offer,
});

/**
 * Clear booking error
 */
export const clearBookingError = () => ({
  type: BOOKING_TYPES.CLEAR_BOOKING_ERROR,
});

/**
 * Reset booking state
 */
export const resetBookingState = () => ({
  type: BOOKING_TYPES.RESET_BOOKING_STATE,
});
