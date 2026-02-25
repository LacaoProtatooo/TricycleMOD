/**
 * BookingContext.jsx - Shared context for driver booking state
 * 
 * Allows both Trips tab and Maps tab to access and modify booking state
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Alert } from 'react-native';
import { getToken } from '../utils/jwtStorage';
import { useAsyncSQLiteContext } from '../utils/asyncSQliteProvider';
import { getCodingDayStatus } from '../utils/codingDayUtils';
import { API_URL as BASE_URL } from '../utils/config';
import { getRoute } from '../utils/routeService';

const BACKEND_URL = BASE_URL;
const API_URL = `${BACKEND_URL}/api/booking`;
const POLL_INTERVAL = 10000;
const COMPLETION_RADIUS_METERS = 300;
const PICKUP_RADIUS_METERS = 50;
const REROUTE_THRESHOLD_METERS = 80; // Reroute when driver is more than 80m off route
const REROUTE_COOLDOWN_MS = 15000; // Don't reroute more than once every 15 seconds

const BookingContext = createContext(null);

export const useBooking = () => {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
};

// Safe version that returns defaults when outside BookingProvider (for operators using MapsTab)
const SAFE_DEFAULTS = {
  activeBooking: null,
  isPickedUp: false,
  distanceToPickup: null,
  distanceToDestination: null,
  driverArrivedAt: null,
  noShowWaitMinutes: 5,
  bookingRoute: null,
  confirmPickup: () => {},
  completeTrip: () => {},
  cancelTrip: () => {},
  markDriverArrived: () => {},
  markNoShow: () => {},
};

export const useSafeBooking = () => {
  const context = useContext(BookingContext);
  return context || SAFE_DEFAULTS;
};

export const BookingProvider = ({ children }) => {
  const db = useAsyncSQLiteContext();
  
  // Authentication
  const [authToken, setAuthToken] = useState(null);
  
  // Online status
  const [isOnline, setIsOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Location
  const [userLocation, setUserLocation] = useState(null);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  
  // Bookings
  const [nearbyBookings, setNearbyBookings] = useState([]);
  const [activeBooking, setActiveBooking] = useState(null);
  const [pendingOffers, setPendingOffers] = useState([]);
  
  // Trip tracking
  const [distanceToDestination, setDistanceToDestination] = useState(null);
  const [distanceToPickup, setDistanceToPickup] = useState(null);
  const [isPickedUp, setIsPickedUp] = useState(false);
  const [driverArrivedAt, setDriverArrivedAt] = useState(null);
  const noShowWaitMinutes = 5; // 5 minutes wait time before no-show allowed
  
  // Booking route for map display
  const [bookingRoute, setBookingRoute] = useState(null);
  
  // Tricycle info
  const [assignedTricycle, setAssignedTricycle] = useState(null);
  
  // Refs
  const pollIntervalRef = useRef(null);
  const watchRef = useRef(null);
  const bookingRouteRef = useRef(null); // For rerouting comparison
  const lastRerouteTimeRef = useRef(0);
  const isReroutingRef = useRef(false);
  
  // Coding day status
  const codingDayStatus = useMemo(() => {
    if (!assignedTricycle) return null;
    return getCodingDayStatus(assignedTricycle.codingDay);
  }, [assignedTricycle]);

  // Auth headers helper
  const getAuthHeaders = useCallback(() => ({
    headers: { Authorization: `Bearer ${authToken}` }
  }), [authToken]);

  // Calculate distance between two points
  const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  // Initialize
  useEffect(() => {
    const init = async () => {
      try {
        setIsLoading(true);
        
        if (db) {
          const token = await getToken(db);
          if (token) {
            setAuthToken(token);
            
            // Fetch assigned tricycle
            try {
              const trikeRes = await axios.get(`${BACKEND_URL}/api/tricycles`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              if (trikeRes.data.success && trikeRes.data.data?.length > 0) {
                setAssignedTricycle(trikeRes.data.data[0]);
              }
            } catch (err) {
              console.warn('Error fetching tricycle:', err);
            }
            
            // Check for active booking
            await checkActiveBooking(token);
          }
        }
        
        // Request location permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          setHasLocationPermission(true);
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      } catch (err) {
        console.error('BookingContext init error:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    init();
    
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (watchRef.current) watchRef.current.remove();
    };
  }, [db]);

  // Start location tracking
  const startLocationTracking = useCallback(async () => {
    if (watchRef.current) return;
    
    try {
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        (location) => {
          const { latitude, longitude } = location.coords;
          setUserLocation({ latitude, longitude });
        }
      );
      watchRef.current = subscription;
    } catch (err) {
      console.error('Error starting location tracking:', err);
    }
  }, []);

  // Stop location tracking
  const stopLocationTracking = useCallback(() => {
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }
  }, []);

  // Update distances when location changes
  useEffect(() => {
    if (!activeBooking || !userLocation) return;
    
    if (!isPickedUp && activeBooking.pickup) {
      const pickupDist = calculateDistance(
        userLocation.latitude, userLocation.longitude,
        activeBooking.pickup.latitude, activeBooking.pickup.longitude
      );
      setDistanceToPickup(pickupDist);
    }
    
    if (activeBooking.destination) {
      const destDist = calculateDistance(
        userLocation.latitude, userLocation.longitude,
        activeBooking.destination.latitude, activeBooking.destination.longitude
      );
      setDistanceToDestination(destDist);
    }
  }, [activeBooking, userLocation, isPickedUp, calculateDistance]);

  // Fetch booking route when active booking changes
  useEffect(() => {
    const fetchBookingRoute = async () => {
      if (!activeBooking) {
        setBookingRoute(null);
        bookingRouteRef.current = null;
        return;
      }
      
      // Determine route: to pickup if not picked up, to destination if picked up
      const origin = userLocation;
      const destination = isPickedUp ? activeBooking.destination : activeBooking.pickup;
      
      if (!origin || !destination) return;
      
      try {
        const result = await getRoute(origin, destination);
        if (result.success && result.route?.coordinates) {
          setBookingRoute(result.route.coordinates);
          bookingRouteRef.current = result.route.coordinates;
        }
      } catch (err) {
        console.warn('Error fetching booking route:', err);
      }
    };
    
    fetchBookingRoute();
  }, [activeBooking?._id, isPickedUp, userLocation?.latitude?.toFixed(3), userLocation?.longitude?.toFixed(3)]);

  // Rerouting: recalculate route when driver deviates significantly from planned route
  useEffect(() => {
    if (!activeBooking || !userLocation || isReroutingRef.current) return;
    
    const routeCoords = bookingRouteRef.current;
    if (!routeCoords || routeCoords.length < 2) return;
    
    // Don't reroute more often than cooldown period
    const now = Date.now();
    if (now - lastRerouteTimeRef.current < REROUTE_COOLDOWN_MS) return;
    
    // Find minimum distance from current position to any point on the route
    let minDist = Infinity;
    for (const coord of routeCoords) {
      const dist = calculateDistance(
        userLocation.latitude, userLocation.longitude,
        coord.latitude, coord.longitude
      );
      if (dist < minDist) minDist = dist;
      if (minDist < REROUTE_THRESHOLD_METERS) return; // Still on route
    }
    
    // Driver is off route — recalculate from current position to target
    console.log('Driver off route by', Math.round(minDist), 'm — rerouting...');
    lastRerouteTimeRef.current = now;
    isReroutingRef.current = true;
    
    const target = isPickedUp ? activeBooking.destination : activeBooking.pickup;
    
    (async () => {
      try {
        const result = await getRoute(userLocation, target);
        if (result.success && result.route?.coordinates) {
          setBookingRoute(result.route.coordinates);
          bookingRouteRef.current = result.route.coordinates;
        }
      } catch (err) {
        console.warn('Reroute failed:', err);
      } finally {
        isReroutingRef.current = false;
      }
    })();
  }, [userLocation?.latitude, userLocation?.longitude, activeBooking?._id, isPickedUp, calculateDistance]);

  // Keep bookingRouteRef in sync
  useEffect(() => {
    bookingRouteRef.current = bookingRoute;
  }, [bookingRoute]);

  // Check for active booking
  const checkActiveBooking = useCallback(async (token) => {
    const t = token || authToken;
    if (!t) return;
    
    try {
      const response = await axios.get(`${API_URL}/driver?status=accepted,in_progress`, {
        headers: { Authorization: `Bearer ${t}` }
      });
      
      if (response.data.success && response.data.bookings?.length > 0) {
        const booking = response.data.bookings[0];
        setActiveBooking(booking);
        setIsPickedUp(booking.status === 'in_progress');
        // Restore driverArrivedAt if it exists
        if (booking.driverArrivedAt) {
          setDriverArrivedAt(new Date(booking.driverArrivedAt));
        }
        startLocationTracking();
      }
    } catch (err) {
      console.error('Error checking active booking:', err);
    }
  }, [authToken, startLocationTracking]);

  // Fetch nearby bookings
  const fetchNearbyBookings = useCallback(async () => {
    if (!userLocation || !authToken) return;
    
    try {
      const response = await axios.get(
        `${API_URL}/nearby?lat=${userLocation.latitude}&lon=${userLocation.longitude}&radius=5`,
        getAuthHeaders()
      );
      
      if (response.data.success) {
        setNearbyBookings(response.data.bookings || []);
      }
    } catch (err) {
      console.error('Error fetching nearby bookings:', err);
    }
  }, [userLocation, authToken, getAuthHeaders]);

  // Fetch pending offers
  const fetchPendingOffers = useCallback(async () => {
    if (!authToken) return;
    
    try {
      const response = await axios.get(`${API_URL}/driver/pending-offers`, getAuthHeaders());
      if (response.data.success) {
        setPendingOffers(response.data.bookings || []);
      }
    } catch (err) {
      console.error('Error fetching pending offers:', err);
    }
  }, [authToken, getAuthHeaders]);

  // Start/stop polling
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) return;
    
    fetchNearbyBookings();
    fetchPendingOffers();
    
    pollIntervalRef.current = setInterval(() => {
      fetchNearbyBookings();
      fetchPendingOffers();
    }, POLL_INTERVAL);
  }, [fetchNearbyBookings, fetchPendingOffers]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Handle online/offline toggle
  useEffect(() => {
    if (isOnline && !activeBooking && authToken) {
      startPolling();
    } else {
      stopPolling();
    }
  }, [isOnline, activeBooking, authToken, startPolling, stopPolling]);

  // Toggle online status
  const toggleOnlineStatus = useCallback(() => {
    if (codingDayStatus?.isCodingDay && !isOnline) {
      Alert.alert('Coding Day Restriction', 'You cannot go online on your coding day.');
      return;
    }
    
    if (!assignedTricycle && !isOnline) {
      Alert.alert('No Tricycle Assigned', 'Contact your operator to assign a tricycle.');
      return;
    }
    
    setIsOnline(prev => !prev);
    if (isOnline) {
      setNearbyBookings([]);
    }
  }, [codingDayStatus, assignedTricycle, isOnline]);

  // Accept booking
  const acceptBooking = useCallback(async (booking, navigation) => {
    if (!assignedTricycle) {
      Alert.alert('No Tricycle Assigned', 'Contact your operator to assign a tricycle.');
      return false;
    }
    
    if (codingDayStatus?.isCodingDay) {
      Alert.alert('Coding Day Restriction', 'You cannot accept bookings on your coding day.');
      return false;
    }
    
    if (!authToken) {
      Alert.alert('Error', 'Authentication required');
      return false;
    }
    
    try {
      const response = await axios.post(
        `${API_URL}/${booking._id}/driver-respond`,
        { accept: true },
        getAuthHeaders()
      );
      
      if (response.data.success) {
        setActiveBooking(response.data.booking);
        setIsPickedUp(false);
        startLocationTracking();
        fetchNearbyBookings();
        
        // Trigger recording on Maps tab
        const passengerName = booking.user?.firstname 
          ? `${booking.user.firstname} ${booking.user.lastname || ''}`.trim()
          : 'Passenger';
          
        await AsyncStorage.setItem('booking_trigger_recording_v1', JSON.stringify({
          shouldStart: true,
          bookingId: booking._id,
          passengerName,
          timestamp: Date.now(),
        }));
        
        // Auto-navigate to Maps tab
        if (navigation) {
          navigation.navigate('Maps');
        }
        
        return true;
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to accept booking');
    }
    return false;
  }, [assignedTricycle, codingDayStatus, authToken, getAuthHeaders, startLocationTracking, fetchNearbyBookings]);

  // Send counter offer
  const sendCounterOffer = useCallback(async (booking, amount, message) => {
    if (!authToken) return false;
    
    try {
      const response = await axios.post(
        `${API_URL}/${booking._id}/driver-respond`,
        { accept: false, counterOffer: amount, message },
        getAuthHeaders()
      );
      
      if (response.data.success) {
        Alert.alert('Offer Sent', 'Your counter offer has been sent to the passenger.');
        fetchNearbyBookings();
        fetchPendingOffers();
        return true;
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to send offer');
    }
    return false;
  }, [authToken, getAuthHeaders, fetchNearbyBookings, fetchPendingOffers]);

  // Confirm pickup
  const confirmPickup = useCallback(async () => {
    if (!activeBooking || !authToken) return false;
    
    try {
      const response = await axios.post(
        `${API_URL}/${activeBooking._id}/start-trip`,
        {},
        getAuthHeaders()
      );
      
      if (response.data.success) {
        setIsPickedUp(true);
        setActiveBooking(response.data.booking);
        return true;
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to start trip');
    }
    return false;
  }, [activeBooking, authToken, getAuthHeaders]);

  // Complete trip
  const completeTrip = useCallback(async () => {
    if (!activeBooking || !authToken) return false;
    
    try {
      const response = await axios.post(
        `${API_URL}/${activeBooking._id}/complete`,
        {},
        getAuthHeaders()
      );
      
      if (response.data.success) {
        Alert.alert('Trip Completed', `Fare: ₱${response.data.booking?.agreedFare || activeBooking.agreedFare}`);
        resetTripState();
        return true;
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to complete trip');
    }
    return false;
  }, [activeBooking, authToken, getAuthHeaders]);

  // Cancel trip
  const cancelTrip = useCallback(async () => {
    if (!activeBooking || !authToken) return false;
    
    try {
      const response = await axios.post(
        `${API_URL}/${activeBooking._id}/cancel`,
        { cancelReason: 'Driver cancelled' },
        getAuthHeaders()
      );
      
      if (response.data.success) {
        resetTripState();
        return true;
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to cancel trip');
    }
    return false;
  }, [activeBooking, authToken, getAuthHeaders]);

  // Mark driver arrived at pickup location
  const markDriverArrived = useCallback(async () => {
    if (!activeBooking || !authToken || !userLocation) return false;
    
    try {
      const response = await axios.post(
        `${API_URL}/${activeBooking._id}/driver-arrived`,
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        },
        getAuthHeaders()
      );
      
      if (response.data.success) {
        setDriverArrivedAt(new Date(response.data.booking.driverArrivedAt));
        setActiveBooking(response.data.booking);
        return true;
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to mark arrival');
    }
    return false;
  }, [activeBooking, authToken, userLocation, getAuthHeaders]);

  // Mark passenger as no-show
  const markNoShow = useCallback(async () => {
    if (!activeBooking || !authToken || !userLocation) return false;
    
    try {
      const response = await axios.post(
        `${API_URL}/${activeBooking._id}/no-show`,
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        },
        getAuthHeaders()
      );
      
      if (response.data.success) {
        Alert.alert(
          'No-Show Recorded',
          `Passenger marked as no-show. Fee: ₱${response.data.booking.noShowFee}`,
          [{ text: 'OK' }]
        );
        resetTripState();
        return true;
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to mark no-show');
    }
    return false;
  }, [activeBooking, authToken, userLocation, getAuthHeaders, resetTripState]);

  // Reset trip state
  const resetTripState = useCallback(() => {
    setActiveBooking(null);
    setIsPickedUp(false);
    setDistanceToPickup(null);
    setDistanceToDestination(null);
    setDriverArrivedAt(null);
    setBookingRoute(null);
    bookingRouteRef.current = null;
    stopLocationTracking();
    
    // Clear recording trigger
    AsyncStorage.removeItem('booking_trigger_recording_v1').catch(() => {});
  }, [stopLocationTracking]);

  // Refresh
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchNearbyBookings(), fetchPendingOffers()]);
    setIsRefreshing(false);
  }, [fetchNearbyBookings, fetchPendingOffers]);

  const value = {
    // State
    authToken,
    isOnline,
    isLoading,
    isRefreshing,
    userLocation,
    hasLocationPermission,
    nearbyBookings,
    activeBooking,
    pendingOffers,
    distanceToDestination,
    distanceToPickup,
    isPickedUp,
    assignedTricycle,
    codingDayStatus,
    driverArrivedAt,
    noShowWaitMinutes,
    bookingRoute,
    
    // Constants
    PICKUP_RADIUS_METERS,
    COMPLETION_RADIUS_METERS,
    
    // Actions
    toggleOnlineStatus,
    acceptBooking,
    sendCounterOffer,
    confirmPickup,
    completeTrip,
    cancelTrip,
    markDriverArrived,
    markNoShow,
    refresh,
    fetchNearbyBookings,
    resetTripState,
  };

  return (
    <BookingContext.Provider value={value}>
      {children}
    </BookingContext.Provider>
  );
};
