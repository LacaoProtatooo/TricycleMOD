/**
 * bookingReducer.js - Redux reducer for booking/special trips state
 */

import { BOOKING_TYPES } from '../actions/bookingAction';

const initialState = {
  // Current active booking
  currentBooking: null,
  
  // User's booking history
  bookings: [],
  
  // Driver offer for current booking
  driverOffer: null,
  
  // Pagination
  totalBookings: 0,
  currentPage: 1,
  totalPages: 1,
  
  // Loading states
  loading: false,
  loadingBookings: false,
  
  // Error state
  error: null,
  
  // Success flags
  ratingSubmitted: false,
};

const bookingReducer = (state = initialState, action) => {
  switch (action.type) {
    // Create Booking
    case BOOKING_TYPES.CREATE_BOOKING_REQUEST:
      return {
        ...state,
        loading: true,
        error: null,
      };
    case BOOKING_TYPES.CREATE_BOOKING_SUCCESS:
      return {
        ...state,
        loading: false,
        currentBooking: action.payload,
        error: null,
      };
    case BOOKING_TYPES.CREATE_BOOKING_FAIL:
      return {
        ...state,
        loading: false,
        error: action.payload,
      };

    // Get User Bookings
    case BOOKING_TYPES.GET_BOOKINGS_REQUEST:
      return {
        ...state,
        loadingBookings: true,
        error: null,
      };
    case BOOKING_TYPES.GET_BOOKINGS_SUCCESS:
      return {
        ...state,
        loadingBookings: false,
        bookings: action.payload.bookings,
        totalBookings: action.payload.total,
        currentPage: action.payload.page,
        totalPages: action.payload.pages,
        error: null,
      };
    case BOOKING_TYPES.GET_BOOKINGS_FAIL:
      return {
        ...state,
        loadingBookings: false,
        error: action.payload,
      };

    // Get Single Booking
    case BOOKING_TYPES.GET_BOOKING_REQUEST:
      return {
        ...state,
        loading: true,
        error: null,
      };
    case BOOKING_TYPES.GET_BOOKING_SUCCESS:
      return {
        ...state,
        loading: false,
        currentBooking: action.payload,
        error: null,
      };
    case BOOKING_TYPES.GET_BOOKING_FAIL:
      return {
        ...state,
        loading: false,
        error: action.payload,
      };

    // Get Active Booking
    case BOOKING_TYPES.GET_ACTIVE_BOOKING_REQUEST:
      return {
        ...state,
        loading: true,
        error: null,
      };
    case BOOKING_TYPES.GET_ACTIVE_BOOKING_SUCCESS:
      return {
        ...state,
        loading: false,
        currentBooking: action.payload,
        error: null,
      };
    case BOOKING_TYPES.GET_ACTIVE_BOOKING_FAIL:
      return {
        ...state,
        loading: false,
        // Don't set error - no active booking is okay
      };

    // Respond to Offer
    case BOOKING_TYPES.RESPOND_OFFER_REQUEST:
      return {
        ...state,
        loading: true,
        error: null,
      };
    case BOOKING_TYPES.RESPOND_OFFER_SUCCESS:
      return {
        ...state,
        loading: false,
        currentBooking: action.payload,
        driverOffer: null,
        error: null,
      };
    case BOOKING_TYPES.RESPOND_OFFER_FAIL:
      return {
        ...state,
        loading: false,
        error: action.payload,
      };

    // Complete Trip
    case BOOKING_TYPES.COMPLETE_TRIP_REQUEST:
      return {
        ...state,
        loading: true,
        error: null,
      };
    case BOOKING_TYPES.COMPLETE_TRIP_SUCCESS:
      return {
        ...state,
        loading: false,
        currentBooking: action.payload,
        error: null,
      };
    case BOOKING_TYPES.COMPLETE_TRIP_FAIL:
      return {
        ...state,
        loading: false,
        error: action.payload,
      };

    // Cancel Booking
    case BOOKING_TYPES.CANCEL_BOOKING_REQUEST:
      return {
        ...state,
        loading: true,
        error: null,
      };
    case BOOKING_TYPES.CANCEL_BOOKING_SUCCESS:
      return {
        ...state,
        loading: false,
        currentBooking: null,
        driverOffer: null,
        error: null,
      };
    case BOOKING_TYPES.CANCEL_BOOKING_FAIL:
      return {
        ...state,
        loading: false,
        error: action.payload,
      };

    // Rate Driver
    case BOOKING_TYPES.RATE_DRIVER_REQUEST:
      return {
        ...state,
        loading: true,
        error: null,
        ratingSubmitted: false,
      };
    case BOOKING_TYPES.RATE_DRIVER_SUCCESS:
      return {
        ...state,
        loading: false,
        ratingSubmitted: true,
        error: null,
      };
    case BOOKING_TYPES.RATE_DRIVER_FAIL:
      return {
        ...state,
        loading: false,
        error: action.payload,
        ratingSubmitted: false,
      };

    // Real-time Updates
    case BOOKING_TYPES.UPDATE_BOOKING_STATUS:
      // Merge with existing booking data if available, or use the new data
      return {
        ...state,
        currentBooking: state.currentBooking && action.payload._id === state.currentBooking._id
          ? {
              ...state.currentBooking,
              ...action.payload,
            }
          : action.payload,
      };
    case BOOKING_TYPES.RECEIVE_DRIVER_OFFER:
      return {
        ...state,
        driverOffer: action.payload,
        currentBooking: state.currentBooking
          ? {
              ...state.currentBooking,
              status: 'offer_made',
              driverOffer: action.payload,
            }
          : null,
      };

    // Clear Error
    case BOOKING_TYPES.CLEAR_BOOKING_ERROR:
      return {
        ...state,
        error: null,
      };

    // Reset State
    case BOOKING_TYPES.RESET_BOOKING_STATE:
      return {
        ...initialState,
        bookings: state.bookings, // Keep booking history
        totalBookings: state.totalBookings,
        currentPage: state.currentPage,
        totalPages: state.totalPages,
      };

    default:
      return state;
  }
};

export default bookingReducer;
