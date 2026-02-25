/**
 * DriverBookingScreen.jsx - Driver's Special Trip Booking Screen
 *
 * Features for drivers:
 * - Toggle online/offline status
 * - View nearby passenger booking requests
 * - Accept bookings directly or make counter offers
 * - Track active trips with real-time location
 * - Complete trips within destination radius (300m)
 * - View booking/trip history
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Dimensions,
  Platform,
} from 'react-native';
import MapView, { Marker, Circle, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { colors, spacing } from '../../components/common/theme';
import { getToken } from '../../utils/jwtStorage';
import { useAsyncSQLiteContext } from '../../utils/asyncSQliteProvider';
import { getCodingDayStatus, getCodingDayName } from '../../utils/codingDayUtils';
import {
  getRouteWithFare,
  getRoute,
  formatDistance,
  formatDuration,
  FARE_CONFIG,
} from '../../utils/routeService';
import { API_URL as BASE_URL } from '../../utils/config';
// TripSimulator removed - simulation logic now inline for better control

const BACKEND_URL = BASE_URL;
const API_URL = `${BACKEND_URL}/api/booking`;

// Trip completion radius (300 meters)
const COMPLETION_RADIUS_METERS = 300;
// Pickup confirmation radius (50 meters) - driver must be within this distance to confirm pickup
// Note: GPS accuracy is typically ±5-15m, so 10m was too strict
const PICKUP_RADIUS_METERS = 50;
// Default search radius for nearby bookings (km)
const SEARCH_RADIUS_KM = 5;
// Polling interval for fetching bookings (ms) - increased for better battery life
const POLL_INTERVAL = 15000;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// View modes
const VIEW_MODE = {
  LIST: 'list',
  MAP: 'map',
};

const DriverBookingScreen = ({ navigation }) => {
  const isFocused = useIsFocused();
  const db = useAsyncSQLiteContext();
  const mapRef = useRef(null);
  const watchRef = useRef(null);
  const pollIntervalRef = useRef(null);

  const { user } = useSelector((state) => state.auth);

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
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [pendingOffers, setPendingOffers] = useState([]); // Offers made by driver awaiting user response

  // Trip tracking
  const [distanceToDestination, setDistanceToDestination] = useState(null);
  const [distanceToPickup, setDistanceToPickup] = useState(null);
  const [isPickedUp, setIsPickedUp] = useState(false);

  // Route calculation state
  const [activeRouteCoordinates, setActiveRouteCoordinates] = useState([]);
  const [activeRouteInfo, setActiveRouteInfo] = useState(null);
  const [previewRouteCoordinates, setPreviewRouteCoordinates] = useState([]);
  const [previewPickupRoute, setPreviewPickupRoute] = useState([]);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);

  // Rerouting refs
  const activeRouteRef = useRef([]);
  const lastRerouteTimeRef = useRef(0);
  const isReroutingRef = useRef(false);
  // Ref for throttling driver location broadcasts to the server
  const lastLocationBroadcastRef = useRef(0);

  // UI state
  const [viewMode, setViewMode] = useState(VIEW_MODE.LIST);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showRoutePreviewModal, setShowRoutePreviewModal] = useState(false);
  const [previewBooking, setPreviewBooking] = useState(null);
  const [counterOffer, setCounterOffer] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [tripHistory, setTripHistory] = useState([]);
  
  // Map view selected booking state
  const [mapSelectedBooking, setMapSelectedBooking] = useState(null);
  const [mapSelectedRoute, setMapSelectedRoute] = useState([]);
  const [mapSelectedPickupRoute, setMapSelectedPickupRoute] = useState([]);
  const [isLoadingMapRoute, setIsLoadingMapRoute] = useState(false);

  // Assigned tricycle for coding day
  const [assignedTricycle, setAssignedTricycle] = useState(null);

  // Trip simulation state (for testing) - lives in parent so it persists when modal closes
  const [showSimulator, setShowSimulator] = useState(false);
  const [simulatedPosition, setSimulatedPosition] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [simulationPaused, setSimulationPaused] = useState(false);
  const [simulatedDistance, setSimulatedDistance] = useState(0);
  const [simulationCompleted, setSimulationCompleted] = useState(false); // Track if simulation finished
  const [simulatedPath, setSimulatedPath] = useState([]); // Traversed route points
  const simulationRef = useRef(null);
  const simulationRouteRef = useRef([]);
  const simulationIndexRef = useRef(0);
  const simulationSpeedRef = useRef(1);
  const simulationPausedRef = useRef(false);
  const simulatedDistanceRef = useRef(0); // Ref for accessing in callbacks

  // DEV: Tracking API integration for simulation (records trip for relive + map movement)
  const simTripIdRef = useRef(null); // server-side tracking tripId
  const simCoordsBufferRef = useRef([]); // accumulated coords to sync
  const simSyncIntervalRef = useRef(null);
  const SIM_BROADCAST_KEY = 'dev_sim_broadcast_v1'; // shared with TrackingMap
  const SIM_SYNC_INTERVAL = 5000; // sync every 5s during sim

  // Calculate coding day status
  const codingDayStatus = useMemo(() => {
    if (!assignedTricycle) return null;
    return getCodingDayStatus(assignedTricycle.codingDay);
  }, [assignedTricycle]);

  // Koding/Boundary state
  const [showKodingModal, setShowKodingModal] = useState(false);
  const [kodingInfo, setKodingInfo] = useState(null);
  const [loadingKoding, setLoadingKoding] = useState(false);
  const [settlingAmount, setSettlingAmount] = useState('');
  const [settlementNotes, setSettlementNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [submittingSettlement, setSubmittingSettlement] = useState(false);

  // Map region
  const [mapRegion, setMapRegion] = useState({
    latitude: 14.5176,
    longitude: 121.0509,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  // ==================== INITIALIZATION ====================

  useEffect(() => {
    initializeScreen();
    return () => {
      cleanup();
    };
  }, [db]);

  useEffect(() => {
    // Start/stop polling based on online status
    if (isOnline && !activeBooking && authToken) {
      startPolling();
    } else {
      stopPolling();
    }
    return () => stopPolling();
  }, [isOnline, activeBooking, authToken, userLocation]);

  // Calculate route when there's an active booking
  useEffect(() => {
    const calculateActiveRoute = async () => {
      if (activeBooking?.pickup && activeBooking?.destination) {
        try {
          const result = await getRoute(activeBooking.pickup, activeBooking.destination);
          if (result.success && result.route) {
            setActiveRouteCoordinates(result.route.coordinates);
            setActiveRouteInfo(result.route);
          } else {
            // Fallback to straight line
            setActiveRouteCoordinates([activeBooking.pickup, activeBooking.destination]);
          }
        } catch (error) {
          console.error('Error calculating active route:', error);
          setActiveRouteCoordinates([activeBooking.pickup, activeBooking.destination]);
        }
      } else {
        setActiveRouteCoordinates([]);
        setActiveRouteInfo(null);
      }
    };
    
    calculateActiveRoute();
  }, [activeBooking?.pickup, activeBooking?.destination]);

  // Keep activeRouteRef in sync with state
  useEffect(() => {
    activeRouteRef.current = activeRouteCoordinates;
  }, [activeRouteCoordinates]);

  // Rerouting: recalculate route when driver deviates significantly from planned route
  useEffect(() => {
    if (!activeBooking || !userLocation) return;
    if (isReroutingRef.current) return;

    const routeCoords = activeRouteRef.current;
    if (!routeCoords || routeCoords.length < 2) return;

    // Don't reroute more often than every 15 seconds
    const now = Date.now();
    if (now - lastRerouteTimeRef.current < 15000) return;

    // Find minimum distance from current position to any point on the route
    let minDist = Infinity;
    for (const coord of routeCoords) {
      const dist = calculateDistance(
        userLocation.latitude, userLocation.longitude,
        coord.latitude, coord.longitude
      );
      if (dist < minDist) minDist = dist;
      if (minDist < 80) return; // Still on route (within 80m)
    }

    // Driver is off route — recalculate from current position to target
    console.log('Driver off route by', Math.round(minDist), 'm — rerouting...');
    lastRerouteTimeRef.current = now;
    isReroutingRef.current = true;

    const target = isPickedUp ? activeBooking.destination : activeBooking.pickup;

    (async () => {
      try {
        const result = await getRoute(userLocation, target);
        if (result.success && result.route) {
          setActiveRouteCoordinates(result.route.coordinates);
          setActiveRouteInfo(result.route);
        }
      } catch (err) {
        console.warn('Reroute failed:', err);
      } finally {
        isReroutingRef.current = false;
      }
    })();
  }, [userLocation?.latitude, userLocation?.longitude, activeBooking?._id, isPickedUp]);

  // Calculate distances when active booking or user location changes
  useEffect(() => {
    if (activeBooking && userLocation) {
      // Calculate distance to pickup if not picked up yet
      if (!isPickedUp && activeBooking.pickup) {
        const pickupDist = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          activeBooking.pickup.latitude,
          activeBooking.pickup.longitude
        );
        setDistanceToPickup(pickupDist);
        console.log('Distance to pickup:', pickupDist, 'meters');
      }

      // Calculate distance to destination
      if (activeBooking.destination) {
        const destDist = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          activeBooking.destination.latitude,
          activeBooking.destination.longitude
        );
        setDistanceToDestination(destDist);
      }
    }
  }, [activeBooking?._id, userLocation?.latitude, userLocation?.longitude, isPickedUp]);

  // Poll for trip cancellation by passenger when there's an active booking
  useEffect(() => {
    let tripStatusPollInterval = null;
    
    // Poll when we have an active booking that's accepted or in_progress
    if (activeBooking && ['accepted', 'in_progress'].includes(activeBooking.status) && authToken) {
      tripStatusPollInterval = setInterval(async () => {
        try {
          // Check if the booking still exists and its current status
          const response = await axios.get(
            `${API_URL}/${activeBooking._id}`,
            { headers: { Authorization: `Bearer ${authToken}` } }
          );
          
          if (response.data.success && response.data.booking) {
            const booking = response.data.booking;
            
            // Check if passenger cancelled the trip
            if (booking.status === 'cancelled') {
              Alert.alert(
                'Trip Cancelled',
                booking.cancelledBy === 'user' 
                  ? 'The passenger has cancelled the trip.'
                  : 'The trip has been cancelled.',
                [{ text: 'OK' }]
              );
              resetTripState();
            }
          }
        } catch (error) {
          // If we get a 404, the booking might have been deleted or cancelled
          if (error.response?.status === 404) {
            Alert.alert(
              'Trip Unavailable',
              'This trip is no longer available.',
              [{ text: 'OK' }]
            );
            resetTripState();
          } else {
            console.error('Error polling trip status:', error);
          }
        }
      }, 5000); // Poll every 5 seconds
    }
    
    return () => {
      if (tripStatusPollInterval) {
        clearInterval(tripStatusPollInterval);
      }
    };
  }, [activeBooking?._id, activeBooking?.status, authToken]);

  // No longer need to poll for awaiting_confirmation - trip completes directly

  const initializeScreen = async () => {
    try {
      setIsLoading(true);

      // Get auth token
      let token = null;
      if (db) {
        token = await getToken(db);
        if (token) {
          setAuthToken(token);
        } else {
          Alert.alert('Authentication Required', 'Please login to access driver booking.');
          return;
        }
      }

      // Fetch assigned tricycle for coding day check
      if (token) {
        try {
          const trikeRes = await axios.get(`${BACKEND_URL}/api/tricycles`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (trikeRes.data.success && trikeRes.data.data?.length > 0) {
            const tricycle = trikeRes.data.data[0];
            setAssignedTricycle(tricycle);
            console.log('Assigned tricycle codingDay:', tricycle.codingDay);
          }
        } catch (trikeError) {
          console.warn('Error fetching tricycle for coding day:', trikeError);
        }
      }

      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setHasLocationPermission(true);
        await getCurrentLocation();
      } else {
        Alert.alert(
          'Location Required',
          'Location permission is needed to find nearby passengers and complete trips.'
        );
      }

      // Check for existing active booking - pass token directly since state may not be updated yet
      if (token) {
        await checkActiveBooking(token);
      }

    } catch (error) {
      console.error('Error initializing driver screen:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const cleanup = () => {
    stopPolling();
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }
  };

  // ==================== LOCATION ====================

  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = location.coords;
      const newLocation = { latitude, longitude };
      setUserLocation(newLocation);
      setMapRegion({
        ...newLocation,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    } catch (error) {
      console.error('Error getting current location:', error);
    }
  };

  const startLocationTracking = async () => {
    if (watchRef.current) return;

    try {
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced, // Balanced instead of High for better battery
          timeInterval: 8000, // Reduced frequency
          distanceInterval: 15, // Only update when moved 15m
        },
        (location) => {
          const { latitude, longitude } = location.coords;
          const newLocation = { latitude, longitude };
          setUserLocation(newLocation);

          // Broadcast driver location to server for passenger tracking (throttle to every 5s)
          if (activeBooking && authToken) {
            const now = Date.now();
            if (now - lastLocationBroadcastRef.current >= 5000) {
              lastLocationBroadcastRef.current = now;
              axios.put(
                `${API_URL}/${activeBooking._id}/driver-location`,
                { latitude, longitude },
                { headers: { Authorization: `Bearer ${authToken}` } }
              ).catch(() => {}); // fire-and-forget, don't block UI
            }
          }

          // Update distances if active booking
          if (activeBooking) {
            // Distance to pickup
            if (!isPickedUp) {
              const pickupDist = calculateDistance(
                latitude,
                longitude,
                activeBooking.pickup.latitude,
                activeBooking.pickup.longitude
              );
              setDistanceToPickup(pickupDist);
            }

            // Distance to destination
            const destDist = calculateDistance(
              latitude,
              longitude,
              activeBooking.destination.latitude,
              activeBooking.destination.longitude
            );
            setDistanceToDestination(destDist);
          }
        }
      );
      watchRef.current = subscription;
    } catch (error) {
      console.error('Error starting location tracking:', error);
    }
  };

  const stopLocationTracking = () => {
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  const formatDistance = (meters) => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };

  // ==================== POLLING ====================

  const startPolling = () => {
    if (pollIntervalRef.current) return;
    fetchNearbyBookings();
    pollIntervalRef.current = setInterval(fetchNearbyBookings, POLL_INTERVAL);
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  // ==================== API CALLS ====================

  const getAuthHeaders = (token = null) => ({
    headers: { Authorization: `Bearer ${token || authToken}` },
  });

  const checkActiveBooking = async (token = null) => {
    const currentToken = token || authToken;
    if (!currentToken) return;

    try {
      // Check for accepted or in_progress bookings in one call
      const response = await axios.get(
        `${API_URL}/driver?status=accepted,in_progress`,
        getAuthHeaders(currentToken)
      );

      if (response.data.success && response.data.bookings?.length > 0) {
        const booking = response.data.bookings[0];
        setActiveBooking(booking);
        setIsOnline(true);
        // If status is in_progress, passenger is already picked up
        if (booking.status === 'in_progress') {
          setIsPickedUp(true);
        }
        startLocationTracking();
        return; // Found active booking, no need to check further
      }

      // Check for pending offers (offer_made status) where this driver made an offer
      await checkPendingOffers(currentToken);
    } catch (error) {
      console.error('Error checking active booking:', error);
    }
  };

  /**
   * Check for offers the driver made that are awaiting user response
   * Updated for multi-offer support - uses new endpoint
   */
  const checkPendingOffers = async (token = null) => {
    const currentToken = token || authToken;
    if (!currentToken) return;

    try {
      // Use the new driver pending offers endpoint
      const response = await axios.get(
        `${API_URL}/driver/pending-offers`,
        getAuthHeaders(currentToken)
      );

      if (response.data.success) {
        const offers = response.data.pendingOffers || [];
        // Map to the expected format for display
        const formattedOffers = offers.map(item => ({
          _id: item.booking._id,
          user: item.booking.user,
          pickup: item.booking.pickup,
          destination: item.booking.destination,
          preferredFare: item.booking.preferredFare,
          createdAt: item.booking.createdAt,
          expiresAt: item.booking.expiresAt,
          driverOffer: item.offer,
        }));
        setPendingOffers(formattedOffers);
        
        // Check if any of our offers have been accepted
        const acceptedResponse = await axios.get(
          `${API_URL}/driver?status=accepted`,
          getAuthHeaders(currentToken)
        );
        
        if (acceptedResponse.data.success && acceptedResponse.data.bookings?.length > 0) {
          const acceptedBooking = acceptedResponse.data.bookings[0];
          setActiveBooking(acceptedBooking);
          setIsOnline(true);
          setIsPickedUp(false);
          startLocationTracking();
          Alert.alert(
            'Offer Accepted!',
            'A passenger has accepted your offer. Navigate to the pickup location.',
            [{ text: 'OK' }]
          );
        }
      } else {
        setPendingOffers([]);
      }
    } catch (error) {
      console.error('Error checking pending offers:', error);
      // Fallback to old endpoint format if new one doesn't exist
      try {
        const fallbackResponse = await axios.get(
          `${API_URL}/driver?status=offer_made`,
          getAuthHeaders(currentToken)
        );
        if (fallbackResponse.data.success) {
          setPendingOffers(fallbackResponse.data.bookings || []);
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    }
  };

  /**
   * Withdraw an offer that is still pending
   */
  const handleWithdrawOffer = async (bookingId) => {
    if (!authToken) return;

    Alert.alert(
      'Withdraw Offer',
      'Are you sure you want to withdraw your offer?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await axios.post(
                `${API_URL}/${bookingId}/withdraw-offer`,
                {},
                getAuthHeaders()
              );

              if (response.data.success) {
                Alert.alert('Success', 'Your offer has been withdrawn.');
                // Refresh pending offers
                await checkPendingOffers();
              }
            } catch (error) {
              Alert.alert('Error', error.response?.data?.message || 'Failed to withdraw offer');
            }
          },
        },
      ]
    );
  };

  const fetchNearbyBookings = async () => {
    if (!userLocation || !authToken) return;

    try {
      const response = await axios.get(
        `${API_URL}/nearby?lat=${userLocation.latitude}&lon=${userLocation.longitude}&radius=${SEARCH_RADIUS_KM}`,
        getAuthHeaders()
      );

      if (response.data.success) {
        setNearbyBookings(response.data.bookings || []);
      }

      // Also check for pending offers that may have been accepted
      await checkPendingOffers();
    } catch (error) {
      console.error('Error fetching nearby bookings:', error);
    }
  };

  const fetchTripHistory = async () => {
    if (!authToken) return;

    try {
      const response = await axios.get(
        `${API_URL}/driver?status=completed`,
        getAuthHeaders()
      );

      if (response.data.success) {
        setTripHistory(response.data.bookings || []);
      }
    } catch (error) {
      console.error('Error fetching trip history:', error);
    }
  };

  const handleAcceptBooking = async (booking) => {
    // Check if driver has an assigned tricycle
    if (!assignedTricycle) {
      Alert.alert(
        'No Tricycle Assigned',
        'You cannot accept bookings without a tricycle assigned to you. Please contact your operator to assign a tricycle.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Check coding day restriction before accepting
    if (codingDayStatus?.isCodingDay) {
      Alert.alert(
        'Coding Day Restriction',
        'You cannot accept bookings on your coding day.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!authToken) {
      Alert.alert('Error', 'Authentication required');
      return;
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
        
        // Auto-start trip recording when booking is accepted
        const passengerName = booking?.user?.firstname 
          ? `${booking.user.firstname} ${booking.user.lastname || ''}`
          : 'Passenger';
          
        await AsyncStorage.setItem('booking_trigger_recording_v1', JSON.stringify({
          shouldStart: true,
          bookingId: booking._id,
          passengerName: passengerName.trim(),
          timestamp: Date.now(),
        }));

        // Navigate to Maps tab so recording auto-starts immediately
        Alert.alert('Success', 'Booking accepted! Navigating to Maps for trip recording.', [
          {
            text: 'OK',
            onPress: () => {
              if (navigation) navigation.navigate('Maps');
            },
          },
        ]);
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to accept booking');
    }
  };

  const handleSendCounterOffer = async () => {
    if (!authToken || !selectedBooking) return;

    // Check if driver has an assigned tricycle
    if (!assignedTricycle) {
      Alert.alert(
        'No Tricycle Assigned',
        'You cannot send offers without a tricycle assigned to you. Please contact your operator to assign a tricycle.',
        [{ text: 'OK' }]
      );
      return;
    }

    const offerAmount = parseFloat(counterOffer);
    if (isNaN(offerAmount) || offerAmount <= 0) {
      Alert.alert('Invalid Offer', 'Please enter a valid fare amount.');
      return;
    }

    try {
      const response = await axios.post(
        `${API_URL}/${selectedBooking._id}/driver-respond`,
        {
          accept: false,
          counterOffer: offerAmount,
          message: offerMessage,
        },
        getAuthHeaders()
      );

      if (response.data.success) {
        Alert.alert('Offer Sent', 'Your counter offer has been sent to the passenger.');
        setShowOfferModal(false);
        setCounterOffer('');
        setOfferMessage('');
        setSelectedBooking(null);
        fetchNearbyBookings();
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to send offer');
    }
  };

  const handleConfirmPickup = () => {
    Alert.alert(
      'Confirm Pickup',
      'Has the passenger boarded your tricycle?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Start Trip',
          onPress: async () => {
            try {
              const response = await axios.post(
                `${API_URL}/${activeBooking._id}/start-trip`,
                {},
                getAuthHeaders()
              );

              if (response.data.success) {
                setIsPickedUp(true);
                setActiveBooking(response.data.booking);
                
                // Trigger recording on the Maps tab by setting a flag in AsyncStorage
                const passengerName = activeBooking?.user?.firstname 
                  ? `${activeBooking.user.firstname} ${activeBooking.user.lastname || ''}`
                  : 'Passenger';
                  
                await AsyncStorage.setItem('booking_trigger_recording_v1', JSON.stringify({
                  shouldStart: true,
                  bookingId: activeBooking._id,
                  passengerName: passengerName.trim(),
                  timestamp: Date.now(),
                }));
                
                // Navigate to Maps tab so recording auto-starts
                Alert.alert(
                  'Trip Started', 
                  'Navigate to the destination. Switching to Maps tab for trip recording.',
                  [{
                    text: 'OK',
                    onPress: () => {
                      if (navigation) navigation.navigate('Maps');
                    },
                  }]
                );
              }
            } catch (error) {
              Alert.alert('Error', error.response?.data?.message || 'Failed to start trip');
            }
          },
        },
      ]
    );
  };

  const handleCompleteTrip = async () => {
    if (!activeBooking || !userLocation) return;

    // If simulation was completed, bypass distance check
    if (!simulationCompleted) {
      const distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        activeBooking.destination.latitude,
        activeBooking.destination.longitude
      );

      if (distance > COMPLETION_RADIUS_METERS) {
        Alert.alert(
          'Not at Destination',
          `You must be within ${COMPLETION_RADIUS_METERS}m of the destination to complete the trip.\n\nCurrent distance: ${formatDistance(distance)}`
        );
        return;
      }
    }

    try {
      // Use simulated position if simulation completed, otherwise use actual location
      const completionLat = simulationCompleted ? activeBooking.destination.latitude : userLocation.latitude;
      const completionLon = simulationCompleted ? activeBooking.destination.longitude : userLocation.longitude;

      const response = await axios.post(
        `${API_URL}/${activeBooking._id}/complete`,
        {
          driverLat: completionLat,
          driverLon: completionLon,
          simulated: simulationCompleted, // Flag for testing/debugging
        },
        getAuthHeaders()
      );

      if (response.data.success) {
        const fare = activeBooking.agreedFare || activeBooking.preferredFare;
        Alert.alert(
          'Trip Completed!',
          `Fare collected: ₱${fare}${simulationCompleted ? '\n\n(Simulated trip)' : ''}\n\nTrip recording on the Maps tab is still running. Stop it manually when you are ready.`,
          [{ text: 'OK' }]
        );
        resetTripState();
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to complete trip');
    }
  };

  const handleCancelTrip = () => {
    Alert.alert(
      'Cancel Trip',
      'Are you sure you want to cancel this trip? This may affect your rating.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.post(
                `${API_URL}/${activeBooking._id}/cancel`,
                { reason: 'Driver cancelled' },
                getAuthHeaders()
              );
              Alert.alert('Trip Cancelled', 'The trip has been cancelled. Remember to stop recording on the Maps tab if active.');
              resetTripState();
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel trip');
            }
          },
        },
      ]
    );
  };

  const resetTripState = () => {
    setActiveBooking(null);
    setDistanceToDestination(null);
    setDistanceToPickup(null);
    setIsPickedUp(false);
    setSimulatedPosition(null);
    setSimulationCompleted(false); // Reset simulation completed flag
    stopLocationTracking();
    if (isOnline) {
      fetchNearbyBookings();
    }
  };

  // Handle simulation completion - allows trip completion without being at location
  const handleSimulationComplete = async (simulationData) => {
    try {
      // After simulation completes, we can complete the trip
      // The simulation has already updated the odometer
      Alert.alert(
        'Simulation Complete',
        `Distance simulated: ${(simulationData.distanceTraveled / 1000).toFixed(2)} km\n\nYou can now complete the trip even without being at the destination (for testing purposes).`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Complete Trip Now',
            onPress: async () => {
              try {
                // Use simulated final position for completion
                const response = await axios.post(
                  `${API_URL}/${activeBooking._id}/complete`,
                  {
                    driverLat: simulationData.finalPosition.latitude,
                    driverLon: simulationData.finalPosition.longitude,
                    simulated: true, // Flag for testing
                  },
                  getAuthHeaders()
                );

                if (response.data.success) {
                  const fare = activeBooking.agreedFare || activeBooking.preferredFare;
                  Alert.alert(
                    '✅ Trip Completed (Simulated)',
                    `Fare: ₱${fare}\nDistance: ${(simulationData.distanceTraveled / 1000).toFixed(2)} km\n\nOdometer has been updated.`
                  );
                  resetTripState();
                }
              } catch (error) {
                Alert.alert('Error', error.response?.data?.message || 'Failed to complete trip');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error handling simulation complete:', error);
    }
  };

  // ==================== SIMULATION FUNCTIONS ====================

  // Haversine distance calculation
  const haversineMeters = (a, b) => {
    if (!a || !b) return 0;
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371000;
    const φ1 = toRad(a.latitude), φ2 = toRad(b.latitude);
    const Δφ = toRad(b.latitude - a.latitude);
    const Δλ = toRad(b.longitude - a.longitude);
    const aa = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
               Math.cos(φ1) * Math.cos(φ2) *
               Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1-aa));
    return R * c;
  };

  // Interpolate points along a route for smooth animation
  const interpolateRoutePoints = useCallback((routeCoords, targetPoints = 100) => {
    if (!routeCoords || routeCoords.length < 2) return routeCoords;
    
    // Calculate total route distance
    let totalDistance = 0;
    const distances = [0];
    for (let i = 1; i < routeCoords.length; i++) {
      const d = haversineMeters(routeCoords[i - 1], routeCoords[i]);
      totalDistance += d;
      distances.push(totalDistance);
    }
    
    if (totalDistance === 0) return routeCoords;
    
    // Generate evenly spaced points along the route
    const points = [];
    const segmentDistance = totalDistance / (targetPoints - 1);
    
    for (let i = 0; i < targetPoints; i++) {
      const targetDist = i * segmentDistance;
      
      // Find which segment this distance falls into
      let segmentIndex = 0;
      for (let j = 1; j < distances.length; j++) {
        if (distances[j] >= targetDist) {
          segmentIndex = j - 1;
          break;
        }
        segmentIndex = j - 1;
      }
      
      // Interpolate within the segment
      const segmentStart = routeCoords[segmentIndex];
      const segmentEnd = routeCoords[Math.min(segmentIndex + 1, routeCoords.length - 1)];
      const segmentLength = distances[segmentIndex + 1] - distances[segmentIndex];
      
      let ratio = 0;
      if (segmentLength > 0) {
        ratio = (targetDist - distances[segmentIndex]) / segmentLength;
      }
      ratio = Math.max(0, Math.min(1, ratio));
      
      points.push({
        latitude: segmentStart.latitude + (segmentEnd.latitude - segmentStart.latitude) * ratio,
        longitude: segmentStart.longitude + (segmentEnd.longitude - segmentStart.longitude) * ratio,
      });
    }
    
    return points;
  }, []);

  // DEV: Sync accumulated simulated coords to tracking server
  const syncSimCoordsToServer = useCallback(async () => {
    const tripId = simTripIdRef.current;
    const buffer = simCoordsBufferRef.current;
    if (!tripId || buffer.length === 0) return;
    try {
      const toSync = [...buffer];
      simCoordsBufferRef.current = [];
      await axios.post(`${BACKEND_URL}/api/tracking/${tripId}/sync`, { coordinates: toSync });
      console.log(`[DEV SIM] Synced ${toSync.length} coords to trip ${tripId}`);
    } catch (err) {
      console.warn('[DEV SIM] Sync error:', err.message);
    }
  }, []);

  // DEV: Start a tracking record on the server for the simulation
  const startSimTrackingRecord = useCallback(async (initialCoord) => {
    try {
      // Use a SEPARATE device ID for simulations so it doesn't conflict with real trip recording
      const SIM_DEVICE_ID_KEY = 'dev_sim_device_id_v1';
      let simDevId = await AsyncStorage.getItem(SIM_DEVICE_ID_KEY);
      if (!simDevId) {
        simDevId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        await AsyncStorage.setItem(SIM_DEVICE_ID_KEY, simDevId);
      }

      // Cancel the previous simulation trip if we still have a reference to it.
      // NOTE: We intentionally avoid using GET /api/tracking/active here because
      // cookies attach the driver's userId to the request, causing the server to
      // return the REAL trip (from TrackingMap) instead of the sim trip — which
      // would then get cancelled by mistake (409 on save).
      if (simTripIdRef.current) {
        try {
          await axios.post(`${BACKEND_URL}/api/tracking/${simTripIdRef.current}/cancel`);
          console.log('[DEV SIM] Cancelled previous simulation trip:', simTripIdRef.current);
          simTripIdRef.current = null;
        } catch (_) { /* already cancelled or ended - fine */ }
      }

      const response = await axios.post(`${BACKEND_URL}/api/tracking/start`, {
        deviceId: simDevId,
        name: `Simulated Trip ${new Date().toLocaleDateString()} (DEV)`,
        initialCoordinate: initialCoord,
      });

      if (response.data.success) {
        simTripIdRef.current = response.data.tripId;
        simCoordsBufferRef.current = [];
        // Start periodic sync
        simSyncIntervalRef.current = setInterval(syncSimCoordsToServer, SIM_SYNC_INTERVAL);
        console.log('[DEV SIM] Started tracking record:', response.data.tripId);
      }
    } catch (err) {
      console.warn('[DEV SIM] Failed to start tracking record:', err.message);
    }
  }, [syncSimCoordsToServer]);

  // DEV: Broadcast simulated position to TrackingMap via AsyncStorage
  const broadcastSimPosition = useCallback(async (point, routePoints, index) => {
    try {
      await AsyncStorage.setItem(SIM_BROADCAST_KEY, JSON.stringify({
        latitude: point.latitude,
        longitude: point.longitude,
        altitude: 0,
        speed: 6.9, // ~25 kph simulated
        heading: 0,
        accuracy: 5,
        timestamp: Date.now(),
        isActive: true,
        progress: index / Math.max(routePoints.length - 1, 1),
      }));
    } catch (_) {}
  }, []);

  // DEV: Clear simulation broadcast
  const clearSimBroadcast = useCallback(async () => {
    try {
      await AsyncStorage.setItem(SIM_BROADCAST_KEY, JSON.stringify({ isActive: false }));
    } catch (_) {}
  }, []);

  // Start simulation - called from TripSimulator modal
  const startSimulation = useCallback(async (speed = 1) => {
    if (!activeBooking?.pickup || !activeBooking?.destination) return;
    
    // Prepare route points
    let routePoints;
    if (activeRouteCoordinates && activeRouteCoordinates.length > 2) {
      // Use actual road route with more interpolation points for smooth movement
      routePoints = interpolateRoutePoints(activeRouteCoordinates, 120);
    } else {
      // Fallback: interpolate straight line
      const numPoints = 60;
      routePoints = [];
      for (let i = 0; i <= numPoints; i++) {
        const ratio = i / numPoints;
        routePoints.push({
          latitude: activeBooking.pickup.latitude + (activeBooking.destination.latitude - activeBooking.pickup.latitude) * ratio,
          longitude: activeBooking.pickup.longitude + (activeBooking.destination.longitude - activeBooking.pickup.longitude) * ratio,
        });
      }
    }
    
    simulationRouteRef.current = routePoints;
    simulationIndexRef.current = 0;
    simulationSpeedRef.current = speed;
    simulationPausedRef.current = false;
    simulatedDistanceRef.current = 0;
    
    setSimulationSpeed(speed);
    setSimulationPaused(false);
    setSimulatedDistance(0);
    setSimulationProgress(0);
    setIsSimulating(true);
    setSimulatedPosition(routePoints[0]);
    setSimulatedPath([routePoints[0]]);

    // DEV: Start server-side tracking record so trip appears in history/relive
    const initialCoord = {
      latitude: routePoints[0].latitude,
      longitude: routePoints[0].longitude,
      altitude: 0,
      accuracy: 5,
      speed: 0,
      heading: 0,
      timestamp: Date.now(),
    };
    await startSimTrackingRecord(initialCoord);

    // DEV: Broadcast initial position to TrackingMap
    await broadcastSimPosition(routePoints[0], routePoints, 0);
    
    // Start the animation loop
    runSimulationStep();
  }, [activeBooking, activeRouteCoordinates, interpolateRoutePoints, startSimTrackingRecord, broadcastSimPosition]);

  // Run a single simulation step
  const runSimulationStep = useCallback(() => {
    if (simulationPausedRef.current) return;
    
    const route = simulationRouteRef.current;
    const index = simulationIndexRef.current;
    
    if (!route || index >= route.length) {
      // Simulation complete
      finishSimulation();
      return;
    }
    
    const currentPoint = route[index];
    const progress = index / (route.length - 1);
    
    // Update state
    setSimulatedPosition(currentPoint);
    setSimulationProgress(progress);
    setSimulatedPath(route.slice(0, index + 1));
    
    // Calculate distance traveled
    if (index > 0) {
      const prevPoint = route[index - 1];
      const segmentDist = haversineMeters(prevPoint, currentPoint);
      simulatedDistanceRef.current += segmentDist;
      setSimulatedDistance(simulatedDistanceRef.current);
      // Update odometer
      updateSimulatedOdometer(segmentDist);
    }
    
    // Update distance to destination
    if (activeBooking?.destination) {
      const dist = calculateDistance(
        currentPoint.latitude,
        currentPoint.longitude,
        activeBooking.destination.latitude,
        activeBooking.destination.longitude
      );
      setDistanceToDestination(dist);
    }
    
    // Center map on simulated position
    if (mapRef.current) {
      mapRef.current.animateCamera({
        center: currentPoint,
        zoom: 17,
      }, { duration: 200 });
    }

    // DEV: Buffer coordinate for server sync and broadcast to TrackingMap
    const simCoord = {
      latitude: currentPoint.latitude,
      longitude: currentPoint.longitude,
      altitude: 0,
      accuracy: 5,
      speed: 6.9,
      heading: 0,
      timestamp: Date.now(),
    };
    simCoordsBufferRef.current.push(simCoord);
    broadcastSimPosition(currentPoint, route, index);

    // Push simulated position to server so guest/passenger can track it
    if (activeBooking?._id && authToken) {
      const now = Date.now();
      if (now - lastLocationBroadcastRef.current >= 3000) {
        lastLocationBroadcastRef.current = now;
        axios.put(
          `${API_URL}/${activeBooking._id}/driver-location`,
          { latitude: currentPoint.latitude, longitude: currentPoint.longitude },
          { headers: { Authorization: `Bearer ${authToken}` } }
        ).catch(() => {});
      }
    }
    
    // Schedule next step
    simulationIndexRef.current = index + 1;
    const baseDelay = 150; // 150ms between points for smooth animation
    const delay = baseDelay / simulationSpeedRef.current;
    
    simulationRef.current = setTimeout(runSimulationStep, delay);
  }, [activeBooking, authToken, broadcastSimPosition]);

  // Update odometer during simulation
  const updateSimulatedOdometer = async (distanceMeters) => {
    try {
      const KM_KEY = 'vehicle_current_km_v1';
      const storedKm = await AsyncStorage.getItem(KM_KEY);
      const currentKm = storedKm ? parseFloat(storedKm) : 0;
      const newKm = currentKm + (distanceMeters / 1000);
      await AsyncStorage.setItem(KM_KEY, String(Math.round(newKm * 100) / 100));
    } catch (error) {
      console.error('Error updating odometer:', error);
    }
  };

  // Finish simulation
  const finishSimulation = useCallback(async () => {
    if (simulationRef.current) {
      clearTimeout(simulationRef.current);
    }
    setIsSimulating(false);
    setSimulationProgress(1);
    setSimulationCompleted(true); // Mark simulation as completed
    
    // Set final position to destination
    if (activeBooking?.destination) {
      setSimulatedPosition(activeBooking.destination);
      setDistanceToDestination(0);
    }

    // DEV: Finalize server-side tracking record
    if (simSyncIntervalRef.current) {
      clearInterval(simSyncIntervalRef.current);
      simSyncIntervalRef.current = null;
    }
    // Final sync of remaining coords
    await syncSimCoordsToServer();
    // End the trip on server so it appears in history/relive
    if (simTripIdRef.current) {
      try {
        const route = simulationRouteRef.current || [];
        const finalCoords = route.map((pt, i) => ({
          latitude: pt.latitude,
          longitude: pt.longitude,
          altitude: 0,
          accuracy: 5,
          speed: 6.9,
          heading: 0,
          timestamp: Date.now() - ((route.length - i) * 2000),
        }));
        await axios.post(`${BACKEND_URL}/api/tracking/${simTripIdRef.current}/end`, {
          finalCoordinates: finalCoords,
          name: `Simulated Trip ${new Date().toLocaleDateString()} (DEV)`,
        });
        console.log('[DEV SIM] Trip ended on server:', simTripIdRef.current);
      } catch (err) {
        console.warn('[DEV SIM] Failed to end trip:', err.message);
      }
      simTripIdRef.current = null;
    }

    // DEV: Sync odometer to server
    try {
      const trikeId = await AsyncStorage.getItem('active_tricycle_id');
      if (trikeId) {
        const currentKmStr = await AsyncStorage.getItem('vehicle_current_km_v1');
        const currentKm = currentKmStr ? parseFloat(currentKmStr) : 0;
        if (currentKm > 0) {
          await axios.put(`${BACKEND_URL}/api/tricycles/${trikeId}/odometer`, {
            odometer: Math.round(currentKm),
          });
          console.log('[DEV SIM] Odometer synced to server:', Math.round(currentKm));
        }
      }
    } catch (syncErr) {
      console.warn('[DEV SIM] Failed to sync odometer:', syncErr.message);
    }

    // DEV: Clear broadcast
    await clearSimBroadcast();
    
    const finalDistance = simulatedDistanceRef.current;
    Alert.alert(
      '✅ Simulation Complete!',
      `Trip simulated successfully!\n\nDistance: ${(finalDistance / 1000).toFixed(2)} km\nOdometer updated.\nTrip recorded for relive.\n\nYou can now complete the trip.`,
      [{ text: 'OK' }]
    );
  }, [activeBooking, syncSimCoordsToServer, clearSimBroadcast]);

  // Pause simulation
  const pauseSimulation = useCallback(() => {
    simulationPausedRef.current = true;
    setSimulationPaused(true);
    if (simulationRef.current) {
      clearTimeout(simulationRef.current);
    }
  }, []);

  // Resume simulation
  const resumeSimulation = useCallback(() => {
    simulationPausedRef.current = false;
    setSimulationPaused(false);
    runSimulationStep();
  }, [runSimulationStep]);

  // Stop simulation
  const stopSimulation = useCallback(async () => {
    if (simulationRef.current) {
      clearTimeout(simulationRef.current);
    }
    simulationPausedRef.current = false;
    simulatedDistanceRef.current = 0;
    setIsSimulating(false);
    setSimulationPaused(false);
    setSimulatedPosition(null);
    setSimulationProgress(0);
    setSimulatedDistance(0);
    setSimulatedPath([]);
    simulationIndexRef.current = 0;

    // DEV: Cancel server-side tracking record
    if (simSyncIntervalRef.current) {
      clearInterval(simSyncIntervalRef.current);
      simSyncIntervalRef.current = null;
    }
    if (simTripIdRef.current) {
      try {
        await axios.post(`${BACKEND_URL}/api/tracking/${simTripIdRef.current}/cancel`);
        console.log('[DEV SIM] Cancelled tracking record:', simTripIdRef.current);
      } catch (_) {}
      simTripIdRef.current = null;
    }
    simCoordsBufferRef.current = [];
    await clearSimBroadcast();
  }, [clearSimBroadcast]);

  // Change simulation speed
  const changeSimulationSpeed = useCallback((speed) => {
    simulationSpeedRef.current = speed;
    setSimulationSpeed(speed);
  }, []);

  // Cleanup simulation on unmount
  useEffect(() => {
    return () => {
      if (simulationRef.current) {
        clearTimeout(simulationRef.current);
      }
      // DEV: cleanup server sync interval and broadcast
      if (simSyncIntervalRef.current) {
        clearInterval(simSyncIntervalRef.current);
      }
      AsyncStorage.setItem(SIM_BROADCAST_KEY, JSON.stringify({ isActive: false })).catch(() => {});
    };
  }, []);

  // ==================== UI HANDLERS ====================

  const toggleOnlineStatus = () => {
    // Check if driver has an assigned tricycle
    if (!assignedTricycle && !isOnline) {
      Alert.alert(
        'No Tricycle Assigned',
        'You cannot go online without a tricycle assigned to you. Please contact your operator to assign a tricycle.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Check coding day restriction before going online
    if (codingDayStatus?.isCodingDay && !isOnline) {
      Alert.alert(
        'Coding Day Restriction',
        `Today is ${getCodingDayName(assignedTricycle?.codingDay)}. You cannot go online or accept trips on your coding day.`,
        [{ text: 'OK' }]
      );
      return;
    }

    if (isOnline) {
      setIsOnline(false);
      setNearbyBookings([]);
      stopPolling();
    } else {
      if (!hasLocationPermission) {
        Alert.alert('Location Required', 'Please enable location to go online.');
        return;
      }
      setIsOnline(true);
      getCurrentLocation();
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await fetchNearbyBookings();
    setIsRefreshing(false);
  };

  const openOfferModal = (booking) => {
    setSelectedBooking(booking);
    setCounterOffer(booking.preferredFare?.toString() || '');
    setOfferMessage('');
    setShowOfferModal(true);
  };

  const openRoutePreview = async (booking) => {
    if (!booking?.pickup || !booking?.destination) {
      Alert.alert('Error', 'Invalid booking data');
      return;
    }
    
    setPreviewBooking(booking);
    setPreviewRouteCoordinates([]);
    setPreviewPickupRoute([]);
    setShowRoutePreviewModal(true);
    
    // Calculate routes for preview
    setIsCalculatingRoute(true);
    try {
      // Calculate route from pickup to destination
      const tripRouteResult = await getRoute(booking.pickup, booking.destination);
      if (tripRouteResult?.success && tripRouteResult?.route?.coordinates?.length > 1) {
        setPreviewRouteCoordinates(tripRouteResult.route.coordinates);
      } else if (tripRouteResult?.fallback?.coordinates?.length > 0) {
        setPreviewRouteCoordinates(tripRouteResult.fallback.coordinates);
      } else {
        setPreviewRouteCoordinates([booking.pickup, booking.destination]);
      }
      
      // Calculate route from driver location to pickup
      if (userLocation?.latitude && userLocation?.longitude) {
        const pickupRouteResult = await getRoute(userLocation, booking.pickup);
        if (pickupRouteResult?.success && pickupRouteResult?.route?.coordinates?.length > 1) {
          setPreviewPickupRoute(pickupRouteResult.route.coordinates);
        } else if (pickupRouteResult?.fallback?.coordinates?.length > 0) {
          setPreviewPickupRoute(pickupRouteResult.fallback.coordinates);
        } else {
          setPreviewPickupRoute([userLocation, booking.pickup]);
        }
      }
    } catch (error) {
      console.error('Error calculating preview routes:', error);
      // Set fallback straight lines
      if (booking?.pickup && booking?.destination) {
        setPreviewRouteCoordinates([booking.pickup, booking.destination]);
      }
      if (userLocation?.latitude && booking?.pickup) {
        setPreviewPickupRoute([userLocation, booking.pickup]);
      }
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  const closeRoutePreview = () => {
    setShowRoutePreviewModal(false);
    setPreviewBooking(null);
    setPreviewRouteCoordinates([]);
    setPreviewPickupRoute([]);
  };

  // Select a booking in map view and calculate its route
  const selectBookingOnMap = async (booking) => {
    if (!booking?.pickup || !booking?.destination) return;
    
    // If same booking is selected, deselect it
    if (mapSelectedBooking?._id === booking._id) {
      setMapSelectedBooking(null);
      setMapSelectedRoute([]);
      setMapSelectedPickupRoute([]);
      return;
    }
    
    setMapSelectedBooking(booking);
    setMapSelectedRoute([]);
    setMapSelectedPickupRoute([]);
    setIsLoadingMapRoute(true);
    
    try {
      // Calculate route from pickup to destination
      const tripRouteResult = await getRoute(booking.pickup, booking.destination);
      if (tripRouteResult?.success && tripRouteResult?.route?.coordinates?.length > 1) {
        setMapSelectedRoute(tripRouteResult.route.coordinates);
      } else if (tripRouteResult?.fallback?.coordinates?.length > 0) {
        setMapSelectedRoute(tripRouteResult.fallback.coordinates);
      } else {
        setMapSelectedRoute([booking.pickup, booking.destination]);
      }
      
      // Calculate route from driver location to pickup
      if (userLocation?.latitude && userLocation?.longitude) {
        const pickupRouteResult = await getRoute(userLocation, booking.pickup);
        if (pickupRouteResult?.success && pickupRouteResult?.route?.coordinates?.length > 1) {
          setMapSelectedPickupRoute(pickupRouteResult.route.coordinates);
        } else if (pickupRouteResult?.fallback?.coordinates?.length > 0) {
          setMapSelectedPickupRoute(pickupRouteResult.fallback.coordinates);
        } else {
          setMapSelectedPickupRoute([userLocation, booking.pickup]);
        }
      }
      
      // Fit map to show the entire route
      if (mapRef.current) {
        const coords = [booking.pickup, booking.destination];
        if (userLocation) coords.unshift(userLocation);
        mapRef.current.fitToCoordinates(coords, {
          edgePadding: { top: 80, right: 50, bottom: 200, left: 50 },
          animated: true,
        });
      }
    } catch (error) {
      console.error('Error calculating map route:', error);
      setMapSelectedRoute([booking.pickup, booking.destination]);
      if (userLocation?.latitude) {
        setMapSelectedPickupRoute([userLocation, booking.pickup]);
      }
    } finally {
      setIsLoadingMapRoute(false);
    }
  };
  
  // Clear map selection when switching view modes
  const handleViewModeChange = (mode) => {
    if (mode === VIEW_MODE.LIST) {
      setMapSelectedBooking(null);
      setMapSelectedRoute([]);
      setMapSelectedPickupRoute([]);
    }
    setViewMode(mode);
  };

  const openHistoryModal = async () => {
    await fetchTripHistory();
    setShowHistoryModal(true);
  };

  // ==================== KODING/BOUNDARY FUNCTIONS ====================

  const fetchKodingInfo = async () => {
    if (!authToken) return;
    try {
      setLoadingKoding(true);
      const response = await axios.get(`${BACKEND_URL}/api/boundary/driver-info`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setKodingInfo(response.data);
      if (response.data.hasTricycle && response.data.tricycle?.boundary?.amount) {
        setSettlingAmount(response.data.tricycle.boundary.amount.toString());
      }
    } catch (error) {
      console.error('Error fetching koding info:', error);
      Alert.alert('Error', 'Failed to load boundary info');
    } finally {
      setLoadingKoding(false);
    }
  };

  const openKodingModal = async () => {
    await fetchKodingInfo();
    setShowKodingModal(true);
  };

  const handleSettlePayment = async () => {
    if (!settlingAmount || parseFloat(settlingAmount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    try {
      setSubmittingSettlement(true);
      const response = await axios.post(
        `${BACKEND_URL}/api/boundary/settle`,
        {
          amount: parseFloat(settlingAmount),
          settlementType: kodingInfo?.tricycle?.boundary?.settlementType || 'daily',
          periodStart: new Date(),
          periodEnd: new Date(),
          paymentMethod,
          notes: settlementNotes
        },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      if (response.data.success) {
        Alert.alert(
          'Payment Recorded!',
          'Your payment has been recorded. Awaiting operator confirmation.',
          [{ text: 'OK', onPress: () => fetchKodingInfo() }]
        );
        setSettlementNotes('');
      }
    } catch (error) {
      console.error('Error settling payment:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to record payment');
    } finally {
      setSubmittingSettlement(false);
    }
  };

  const centerMapOnUser = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateCamera(
        { center: userLocation, zoom: 16 },
        { duration: 500 }
      );
    }
  };

  // ==================== RENDER HELPERS ====================

  const renderBookingCard = ({ item }) => {
    const distanceToPickupLocation = userLocation
      ? calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          item.pickup.latitude,
          item.pickup.longitude
        )
      : null;

    const tripDistance = calculateDistance(
      item.pickup.latitude,
      item.pickup.longitude,
      item.destination.latitude,
      item.destination.longitude
    );

    return (
      <View style={styles.bookingCard}>
        {/* Header: Passenger info & fare */}
        <View style={styles.cardHeader}>
          <View style={styles.passengerSection}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={22} color="#fff" />
            </View>
            <View style={styles.passengerDetails}>
              <Text style={styles.passengerName}>
                {item.user?.firstname || 'Passenger'} {item.user?.lastname || ''}
              </Text>
              {item.user?.rating > 0 && (
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={12} color={colors.starYellow || '#FFD700'} />
                  <Text style={styles.ratingValue}>{item.user.rating.toFixed(1)}</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.fareContainer}>
            <Text style={styles.fareLabel}>Offered</Text>
            <Text style={styles.fareAmount}>₱{item.preferredFare}</Text>
          </View>
        </View>

        {/* Trip details */}
        <View style={styles.tripDetails}>
          <View style={styles.tripDetailRow}>
            <View style={styles.iconWrapper}>
              <Ionicons name="location" size={16} color="#28a745" />
            </View>
            <Text style={styles.tripDetailText}>
              Pickup: {distanceToPickupLocation ? formatDistance(distanceToPickupLocation) + ' away' : 'Calculating...'}
            </Text>
          </View>
          <View style={styles.tripDetailRow}>
            <View style={styles.iconWrapper}>
              <Ionicons name="navigate" size={16} color={colors.primary} />
            </View>
            <Text style={styles.tripDetailText}>
              Trip Distance: {formatDistance(tripDistance)}
            </Text>
          </View>
          <View style={styles.tripDetailRow}>
            <View style={styles.iconWrapper}>
              <Ionicons name="time-outline" size={16} color="#6c757d" />
            </View>
            <Text style={styles.tripDetailText}>
              {getTimeAgo(item.createdAt)}
            </Text>
          </View>
        </View>

        {/* View Route Button */}
        <TouchableOpacity
          style={styles.viewRouteBtn}
          onPress={() => openRoutePreview(item)}
        >
          <Ionicons name="map-outline" size={18} color={colors.primary} />
          <Text style={styles.viewRouteBtnText}>View Route Details</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </TouchableOpacity>

        {/* Action buttons */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={() => handleAcceptBooking(item)}
          >
            <Ionicons name="checkmark" size={18} color="#fff" />
            <Text style={styles.acceptBtnText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.counterOfferBtn}
            onPress={() => openOfferModal(item)}
          >
            <Ionicons name="cash-outline" size={18} color={colors.primary} />
            <Text style={styles.counterOfferBtnText}>Counter Offer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderHistoryItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.historyItem}
      onPress={() => navigation.navigate('BookingHistoryDetail', { bookingId: item._id, isDriver: true })}
      activeOpacity={0.7}
    >
      <View style={styles.historyHeader}>
        <Text style={styles.historyPassenger}>
          {item.user?.firstname || 'Passenger'} {item.user?.lastname || ''}
        </Text>
        <Text style={styles.historyFare}>₱{item.agreedFare || item.preferredFare}</Text>
      </View>
      <Text style={styles.historyDate}>{formatDate(item.completedAt || item.updatedAt)}</Text>
      <View style={styles.historyStatus}>
        <Ionicons 
          name={item.status === 'completed' ? 'checkmark-circle' : 'close-circle'} 
          size={14} 
          color={item.status === 'completed' ? '#28a745' : '#dc3545'} 
        />
        <Text style={[
          styles.historyStatusText, 
          { color: item.status === 'completed' ? '#28a745' : '#dc3545' }
        ]}>
          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
        </Text>
      </View>
      <View style={styles.historyArrow}>
        <Ionicons name="chevron-forward" size={16} color="#999" />
      </View>
    </TouchableOpacity>
  );

  const getTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // ==================== LOADING STATE ====================

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading Driver Mode...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ==================== ACTIVE TRIP VIEW ====================

  if (activeBooking) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.activeTripHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.tripStatusBadge}>
              <View style={styles.tripStatusDot} />
              <Text style={styles.tripStatusText}>
                {isPickedUp 
                  ? 'In Progress' 
                  : 'Pickup Passenger'}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.cancelIcon} onPress={handleCancelTrip}>
            <Ionicons name="close" size={24} color="#dc3545" />
          </TouchableOpacity>
        </View>

        {/* Map */}
        {isFocused ? (
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          mapType="standard"
          style={styles.fullMap}
          region={{
            latitude: userLocation?.latitude || activeBooking.pickup.latitude,
            longitude: userLocation?.longitude || activeBooking.pickup.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
          showsUserLocation={true}
          showsMyLocationButton={false}
        >
          {/* Pickup marker */}
          <Marker
            coordinate={activeBooking.pickup}
            title="Pickup"
            description="Passenger pickup location"
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={styles.pickupMarker}>
              <Ionicons name="person" size={14} color="#fff" />
            </View>
          </Marker>

          {/* Destination marker */}
          <Marker
            coordinate={activeBooking.destination}
            title="Destination"
            description="Drop-off location"
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={styles.destinationMarker}>
              <Ionicons name="flag" size={14} color="#fff" />
            </View>
          </Marker>

          {/* Route line - Uses actual road route */}
          {activeRouteCoordinates.length > 1 ? (
            <>
              {/* Main route line */}
              <Polyline
                coordinates={isPickedUp && userLocation && !isSimulating
                  ? [userLocation, ...activeRouteCoordinates.slice(1)] 
                  : activeRouteCoordinates
                }
                strokeColor={isSimulating ? 'rgba(33, 150, 243, 0.3)' : '#2196F3'}
                strokeWidth={4}
                lineCap="round"
                lineJoin="round"
              />
              {/* Simulated progress line - shows traversed route path */}
              {isSimulating && simulatedPath.length > 1 && (
                <Polyline
                  coordinates={simulatedPath}
                  strokeColor="#6f42c1"
                  strokeWidth={6}
                  lineCap="round"
                  lineJoin="round"
                />
              )}
            </>
          ) : (
            (() => {
              const fallbackCoords = [
                isPickedUp ? userLocation : activeBooking.pickup,
                activeBooking.destination,
              ].filter(Boolean);
              return fallbackCoords.length >= 2 ? (
                <Polyline
                  coordinates={fallbackCoords}
                  strokeColor={colors.primary}
                  strokeWidth={4}
                  lineDashPattern={[10, 5]}
                />
              ) : null;
            })()
          )}

          {/* Completion zone */}
          <Circle
            center={activeBooking.destination}
            radius={COMPLETION_RADIUS_METERS}
            strokeColor="rgba(40,167,69,0.7)"
            fillColor="rgba(40,167,69,0.15)"
            strokeWidth={2}
          />

          {/* Simulation marker - shows tricycle icon moving along route */}
          {isSimulating && simulatedPosition && (
            <Marker
              coordinate={simulatedPosition}
              anchor={{ x: 0.5, y: 0.5 }}
              flat={true}
            >
              <View style={styles.simulationMarker}>
                <Ionicons name="bicycle" size={20} color="#fff" />
              </View>
            </Marker>
          )}
        </MapView>
        ) : (
          <View style={[styles.fullMap, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}

        {/* Center on user button */}
        <TouchableOpacity style={styles.centerMapBtn} onPress={centerMapOnUser}>
          <Ionicons name="locate" size={22} color={colors.primary} />
        </TouchableOpacity>

        {/* Trip info panel */}
        <View style={styles.tripPanel}>
          {/* Passenger info */}
          <View style={styles.tripPassengerRow}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={20} color="#fff" />
            </View>
            <View style={styles.tripPassengerInfo}>
              <Text style={styles.tripPassengerName}>
                {activeBooking.user?.firstname || 'Passenger'} {activeBooking.user?.lastname || ''}
              </Text>
              <Text style={styles.tripFare}>
                Fare: ₱{activeBooking.agreedFare || activeBooking.preferredFare}
              </Text>
            </View>
          </View>

          {/* Distance info */}
          <View style={styles.distanceInfoRow}>
            {!isPickedUp && distanceToPickup !== null && (
              <View style={styles.distanceItem}>
                <Ionicons name="person" size={16} color="#28a745" />
                <Text style={styles.distanceLabel}>To Pickup:</Text>
                <Text style={styles.distanceValue}>{formatDistance(distanceToPickup)}</Text>
              </View>
            )}
            {distanceToDestination !== null && (
              <View style={styles.distanceItem}>
                <Ionicons name="flag" size={16} color={colors.primary} />
                <Text style={styles.distanceLabel}>To Destination:</Text>
                <Text style={styles.distanceValue}>{formatDistance(distanceToDestination)}</Text>
              </View>
            )}
          </View>

          {/* Action buttons */}
          {!isPickedUp ? (
            <>
              <TouchableOpacity 
                style={[
                  styles.pickupBtn,
                  (distanceToPickup === null || distanceToPickup > PICKUP_RADIUS_METERS) && styles.btnDisabled,
                ]} 
                onPress={handleConfirmPickup}
                disabled={distanceToPickup === null || distanceToPickup > PICKUP_RADIUS_METERS}
              >
                <Ionicons name="enter-outline" size={20} color="#fff" />
                <Text style={styles.pickupBtnText}>Confirm Passenger Pickup</Text>
              </TouchableOpacity>
              {/* Always show distance info for debugging */}
              <Text style={[
                styles.pickupHint,
                distanceToPickup !== null && distanceToPickup <= PICKUP_RADIUS_METERS && styles.pickupHintSuccess
              ]}>
                {distanceToPickup === null 
                  ? 'Getting your location...'
                  : distanceToPickup <= PICKUP_RADIUS_METERS
                    ? `✓ Within range (${formatDistance(distanceToPickup)} from pickup)`
                    : `Get within ${PICKUP_RADIUS_METERS}m of passenger (currently ${formatDistance(distanceToPickup)} away)`
                }
              </Text>
              {/* Override Pickup - for cases where passenger pinned wrong location */}
              {distanceToPickup !== null && distanceToPickup > PICKUP_RADIUS_METERS && (
                <TouchableOpacity 
                  style={styles.overridePickupBtn}
                  onPress={() => {
                    Alert.alert(
                      '⚠️ Override Pickup Location',
                      `You are ${formatDistance(distanceToPickup)} away from the pinned pickup location. `
                      + 'This may happen if the passenger pinned an incorrect address.\n\n'
                      + 'Only proceed if the passenger is physically present with you.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { 
                          text: 'Passenger Is With Me',
                          style: 'destructive',
                          onPress: handleConfirmPickup
                        }
                      ]
                    );
                  }}
                >
                  <Ionicons name="warning-outline" size={16} color="#fff" />
                  <Text style={styles.overridePickupBtnText}>Passenger pinned wrong location?</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <TouchableOpacity
              style={[
                styles.completeBtn,
                (distanceToDestination > COMPLETION_RADIUS_METERS && !simulationCompleted) && styles.btnDisabled,
              ]}
              onPress={handleCompleteTrip}
              disabled={distanceToDestination > COMPLETION_RADIUS_METERS && !simulationCompleted}
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.completeBtnText}>
                {simulationCompleted ? '✅ Complete Trip (Simulated)' : 'Complete Trip'}
              </Text>
            </TouchableOpacity>
          )}

          {isPickedUp && distanceToDestination > COMPLETION_RADIUS_METERS && !simulationCompleted && (
            <Text style={styles.completionHint}>
              Navigate to destination to complete ({formatDistance(COMPLETION_RADIUS_METERS)} range)
            </Text>
          )}

          {/* Simulation Button - For Testing Only */}
          {isPickedUp && __DEV__ && !isSimulating && (
            <TouchableOpacity
              style={styles.simulateBtn}
              onPress={() => setShowSimulator(true)}
            >
              <Ionicons name="flask" size={18} color="#fff" />
              <Text style={styles.simulateBtnText}>🧪 Simulate Trip (Testing)</Text>
            </TouchableOpacity>
          )}

          {/* Simulation Controls - Shows when simulation is running */}
          {isSimulating && __DEV__ && (
            <View style={styles.simulationControlPanel}>
              <View style={styles.simControlHeader}>
                <Ionicons name="flask" size={16} color="#6f42c1" />
                <Text style={styles.simControlTitle}>Simulation Running</Text>
                <Text style={styles.simControlProgress}>{Math.round(simulationProgress * 100)}%</Text>
              </View>
              <View style={styles.simProgressBar}>
                <View style={[styles.simProgressFill, { width: `${simulationProgress * 100}%` }]} />
              </View>
              <Text style={styles.simDistanceText}>
                Distance: {(simulatedDistance / 1000).toFixed(2)} km
              </Text>
              <View style={styles.simControlButtons}>
                {simulationPaused ? (
                  <TouchableOpacity style={styles.simResumeBtn} onPress={resumeSimulation}>
                    <Ionicons name="play" size={16} color="#fff" />
                    <Text style={styles.simBtnText}>Resume</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.simPauseBtn} onPress={pauseSimulation}>
                    <Ionicons name="pause" size={16} color="#fff" />
                    <Text style={styles.simBtnText}>Pause</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.simStopBtn} onPress={stopSimulation}>
                  <Ionicons name="stop" size={16} color="#fff" />
                  <Text style={styles.simBtnText}>Stop</Text>
                </TouchableOpacity>
                <View style={styles.simSpeedButtons}>
                  {[1, 2, 4, 8].map((speed) => (
                    <TouchableOpacity
                      key={speed}
                      style={[styles.simSpeedBtn, simulationSpeed === speed && styles.simSpeedBtnActive]}
                      onPress={() => changeSimulationSpeed(speed)}
                    >
                      <Text style={[styles.simSpeedBtnText, simulationSpeed === speed && styles.simSpeedBtnTextActive]}>
                        {speed}x
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Trip Simulator Modal - For starting simulation */}
        <Modal
          visible={showSimulator}
          animationType="slide"
          transparent
          onRequestClose={() => setShowSimulator(false)}
        >
          <View style={styles.simModalOverlay}>
            <View style={styles.simModalContent}>
              <View style={styles.simModalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="flask" size={24} color="#6f42c1" />
                  <Text style={styles.simModalTitle}>Trip Simulator</Text>
                </View>
                <TouchableOpacity onPress={() => setShowSimulator(false)}>
                  <Ionicons name="close" size={24} color={colors.orangeShade6} />
                </TouchableOpacity>
              </View>

              <View style={styles.simModalInfo}>
                <Text style={styles.simModalInfoText}>
                  This will simulate the trip from pickup to destination.
                </Text>
                <Text style={styles.simModalInfoText}>
                  • The tricycle icon will follow the actual route
                </Text>
                <Text style={styles.simModalInfoText}>
                  • Moves on both Booking &amp; Maps tab maps
                </Text>
                <Text style={styles.simModalInfoText}>
                  • Trip recorded for relive playback in History
                </Text>
                <Text style={styles.simModalInfoText}>
                  • Odometer updated (local + server)
                </Text>
                <Text style={styles.simModalInfoText}>
                  • Close this modal to see the map
                </Text>
              </View>

              <View style={styles.simModalSpeedSection}>
                <Text style={styles.simModalSpeedLabel}>Simulation Speed:</Text>
                <View style={styles.simModalSpeedButtons}>
                  {[1, 2, 4, 8].map((speed) => (
                    <TouchableOpacity
                      key={speed}
                      style={[styles.simModalSpeedBtn, simulationSpeed === speed && styles.simModalSpeedBtnActive]}
                      onPress={() => setSimulationSpeed(speed)}
                    >
                      <Text style={[styles.simModalSpeedBtnText, simulationSpeed === speed && styles.simModalSpeedBtnTextActive]}>
                        {speed}x
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={styles.simStartBtn}
                onPress={() => {
                  startSimulation(simulationSpeed);
                  setShowSimulator(false); // Close modal to see the map
                }}
              >
                <Ionicons name="play" size={20} color="#fff" />
                <Text style={styles.simStartBtnText}>Start Simulation</Text>
              </TouchableOpacity>

              <View style={styles.simModalWarning}>
                <Ionicons name="information-circle" size={18} color="#856404" />
                <Text style={styles.simModalWarningText}>
                  DEV testing only. Trip will be recorded on server for relive, odometer synced, and marker will move on Maps tab.
                </Text>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // ==================== MAIN VIEW (BOOKING LIST) ====================

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* No Tricycle Assigned Banner */}
      {!assignedTricycle && (
        <View style={styles.noTricycleBanner}>
          <Ionicons name="warning" size={20} color="#fff" />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.noTricycleBannerTitle}>No Tricycle Assigned</Text>
            <Text style={styles.noTricycleBannerText}>
              Contact your operator to assign a tricycle before accepting trips.
            </Text>
          </View>
        </View>
      )}

      {/* Coding Day Banner */}
      {assignedTricycle && codingDayStatus?.isCodingDay && (
        <View style={styles.codingDayBanner}>
          <Ionicons name="ban" size={20} color="#fff" />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.codingDayBannerTitle}>Coding Day - Cannot Accept Trips</Text>
            <Text style={styles.codingDayBannerText}>
              Your tricycle is on coding today ({getCodingDayName(assignedTricycle?.codingDay)}).
            </Text>
          </View>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="bicycle" size={26} color={colors.primary} />
          <View style={styles.headerTitleSection}>
            <Text style={styles.headerTitle}>Driver Bookings</Text>
            <Text style={styles.headerSubtitle}>
              {!assignedTricycle
                ? 'No tricycle assigned'
                : codingDayStatus?.isCodingDay
                  ? 'Coding day - trips disabled'
                  : isOnline
                    ? nearbyBookings.length > 0
                      ? `${nearbyBookings.length} request${nearbyBookings.length > 1 ? 's' : ''} nearby`
                      : 'Searching for passengers...'
                    : 'You are offline'}
            </Text>
          </View>
        </View>

        {/* Online toggle */}
        <TouchableOpacity
          style={[
            styles.onlineToggle, 
            isOnline && styles.onlineToggleActive,
            (!assignedTricycle || codingDayStatus?.isCodingDay) && styles.onlineToggleDisabled
          ]}
          onPress={toggleOnlineStatus}
          disabled={!assignedTricycle || codingDayStatus?.isCodingDay}
        >
          <View style={[styles.toggleIndicator, isOnline && styles.toggleIndicatorActive]} />
          <Text style={[styles.toggleLabel, isOnline && styles.toggleLabelActive]}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Action buttons row */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.viewModeBtn, viewMode === VIEW_MODE.LIST && styles.viewModeBtnActive]}
          onPress={() => handleViewModeChange(VIEW_MODE.LIST)}
        >
          <Ionicons
            name="list"
            size={18}
            color={viewMode === VIEW_MODE.LIST ? '#fff' : colors.primary}
          />
          <Text
            style={[
              styles.viewModeBtnText,
              viewMode === VIEW_MODE.LIST && styles.viewModeBtnTextActive,
            ]}
          >
            List
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeBtn, viewMode === VIEW_MODE.MAP && styles.viewModeBtnActive]}
          onPress={() => handleViewModeChange(VIEW_MODE.MAP)}
        >
          <Ionicons
            name="map"
            size={18}
            color={viewMode === VIEW_MODE.MAP ? '#fff' : colors.primary}
          />
          <Text
            style={[
              styles.viewModeBtnText,
              viewMode === VIEW_MODE.MAP && styles.viewModeBtnTextActive,
            ]}
          >
            Map
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.historyBtn} onPress={openHistoryModal}>
          <Ionicons name="time-outline" size={18} color={colors.primary} />
          <Text style={styles.historyBtnText}>History</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.kodingBtn} onPress={openKodingModal}>
          <Ionicons name="cash-outline" size={18} color="#28a745" />
          <Text style={styles.kodingBtnText}>Koding</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {!isOnline ? (
        // Offline state
        <View style={styles.offlineContainer}>
          <Ionicons name="cloud-offline-outline" size={80} color={colors.orangeShade4 || '#ccc'} />
          <Text style={styles.offlineTitle}>You're Offline</Text>
          <Text style={styles.offlineSubtitle}>
            Go online to start receiving booking requests from nearby passengers.
          </Text>
          <TouchableOpacity style={styles.goOnlineBtn} onPress={toggleOnlineStatus}>
            <Text style={styles.goOnlineBtnText}>Go Online</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.contentScroll}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Pending Offers Section */}
          {pendingOffers.length > 0 && (
            <View style={styles.pendingOffersSection}>
              <View style={styles.sectionHeader}>
                <Ionicons name="hourglass-outline" size={20} color={colors.primary} />
                <Text style={styles.sectionTitle}>Your Pending Offers</Text>
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>{pendingOffers.length}</Text>
                </View>
              </View>
              {pendingOffers.map((offer) => (
                <View key={offer._id} style={styles.pendingOfferCard}>
                  <View style={styles.pendingOfferHeader}>
                    <View style={styles.pendingOfferPassenger}>
                      <View style={styles.avatarSmall}>
                        <Ionicons name="person" size={14} color="#fff" />
                      </View>
                      <Text style={styles.pendingOfferName}>
                        {offer.user?.firstname || 'Passenger'} {offer.user?.lastname || ''}
                      </Text>
                    </View>
                    <View style={styles.pendingOfferStatus}>
                      <View style={styles.waitingDot} />
                      <Text style={styles.waitingText}>Waiting</Text>
                    </View>
                  </View>
                  <View style={styles.pendingOfferDetails}>
                    <View style={styles.pendingOfferRow}>
                      <Ionicons name="cash-outline" size={16} color="#28a745" />
                      <Text style={styles.pendingOfferFare}>
                        Your offer: ₱{offer.driverOffer?.amount || offer.preferredFare}
                      </Text>
                    </View>
                    <View style={styles.pendingOfferRow}>
                      <Ionicons name="pricetag-outline" size={16} color="#6c757d" />
                      <Text style={styles.pendingOfferOriginal}>
                        Guest's fare: ₱{offer.preferredFare}
                      </Text>
                    </View>
                    <View style={styles.pendingOfferRow}>
                      <Ionicons name="location" size={16} color={colors.primary} />
                      <Text style={styles.pendingOfferLocation} numberOfLines={1}>
                        {offer.pickup?.address || 'Pickup location'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.pendingOfferActions}>
                    <TouchableOpacity
                      style={styles.withdrawOfferBtn}
                      onPress={() => handleWithdrawOffer(offer._id)}
                    >
                      <Ionicons name="close-outline" size={16} color="#dc3545" />
                      <Text style={styles.withdrawOfferBtnText}>Withdraw</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.pendingOfferHint}>
                    Waiting for passenger to accept or decline...
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Map or List View */}
          {viewMode === VIEW_MODE.MAP ? (
            // Lightweight map view - similar to user BookingScreen
            <View style={styles.mapContainer}>
              {isFocused ? (
              <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                mapType="standard"
                style={styles.fullMap}
                region={mapRegion}
                showsUserLocation={true}
                showsMyLocationButton={false}
                onPress={() => {
                  // Deselect booking when tapping empty map area
                  if (mapSelectedBooking) {
                    setMapSelectedBooking(null);
                    setMapSelectedRoute([]);
                    setMapSelectedPickupRoute([]);
                  }
                }}
              >
                {/* Pickup markers with fare badges - lightweight */}
                {nearbyBookings.map((booking) => (
                  <Marker
                    key={booking._id}
                    coordinate={booking.pickup}
                    onPress={() => selectBookingOnMap(booking)}
                    anchor={{ x: 0.5, y: 1 }}
                    zIndex={mapSelectedBooking?._id === booking._id ? 100 : 10}
                  >
                    <View style={[
                      styles.fareMarker,
                      mapSelectedBooking?._id === booking._id && styles.fareMarkerSelected
                    ]}>
                      <Text style={styles.fareMarkerText}>₱{booking.preferredFare}</Text>
                    </View>
                  </Marker>
                ))}
                
                {/* Selected booking destination marker */}
                {mapSelectedBooking && (
                  <Marker
                    coordinate={mapSelectedBooking.destination}
                    anchor={{ x: 0.5, y: 0.5 }}
                    zIndex={101}
                  >
                    <View style={styles.destMarkerSimple}>
                      <Text style={styles.destMarkerIcon}>◆</Text>
                    </View>
                  </Marker>
                )}
                
                {/* Route from driver to pickup (selected) */}
                {mapSelectedPickupRoute.length > 1 && (
                  <Polyline
                    coordinates={mapSelectedPickupRoute}
                    strokeColor="#6c757d"
                    strokeWidth={3}
                    lineDashPattern={[8, 6]}
                  />
                )}
                
                {/* Route from pickup to destination (selected) */}
                {mapSelectedRoute.length > 1 && (
                  <Polyline
                    coordinates={mapSelectedRoute}
                    strokeColor="#2196F3"
                    strokeWidth={4}
                  />
                )}
              </MapView>
              ) : (
                <View style={[styles.fullMap, { justifyContent: 'center', alignItems: 'center' }]}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              )}
              
              {/* Map controls */}
              <TouchableOpacity style={styles.centerMapBtn} onPress={centerMapOnUser}>
                <Ionicons name="locate" size={22} color={colors.primary} />
              </TouchableOpacity>
              
              {/* Route loading indicator */}
              {isLoadingMapRoute && (
                <View style={styles.mapRouteLoading}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.mapRouteLoadingText}>Loading route...</Text>
                </View>
              )}
              
              {/* Selected booking card - compact */}
              {mapSelectedBooking && (
                <View style={styles.mapBookingCard}>
                  <View style={styles.mapBookingHeader}>
                    <View style={styles.mapBookingPassenger}>
                      <View style={styles.avatarCircleSmall}>
                        <Ionicons name="person" size={16} color="#fff" />
                      </View>
                      <View>
                        <Text style={styles.mapBookingName}>
                          {mapSelectedBooking.user?.firstname || 'Passenger'}
                        </Text>
                        {mapSelectedBooking.user?.rating > 0 && (
                          <View style={styles.ratingBadge}>
                            <Ionicons name="star" size={10} color={colors.starYellow || '#FFD700'} />
                            <Text style={styles.ratingValueSmall}>{mapSelectedBooking.user.rating.toFixed(1)}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={styles.mapBookingFare}>
                      <Text style={styles.mapBookingFareLabel}>Offered</Text>
                      <Text style={styles.mapBookingFareAmount}>₱{mapSelectedBooking.preferredFare}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.mapBookingDetails}>
                    <View style={styles.mapBookingDetailRow}>
                      <Ionicons name="location" size={14} color="#28a745" />
                      <Text style={styles.mapBookingDetailText} numberOfLines={1}>
                        {userLocation ? formatDistance(calculateDistance(
                          userLocation.latitude, userLocation.longitude,
                          mapSelectedBooking.pickup.latitude, mapSelectedBooking.pickup.longitude
                        )) + ' to pickup' : 'Calculating...'}
                      </Text>
                    </View>
                    <View style={styles.mapBookingDetailRow}>
                      <Ionicons name="navigate" size={14} color={colors.primary} />
                      <Text style={styles.mapBookingDetailText} numberOfLines={1}>
                        {formatDistance(calculateDistance(
                          mapSelectedBooking.pickup.latitude, mapSelectedBooking.pickup.longitude,
                          mapSelectedBooking.destination.latitude, mapSelectedBooking.destination.longitude
                        ))} trip
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.mapBookingActions}>
                    <TouchableOpacity
                      style={styles.mapAcceptBtn}
                      onPress={() => handleAcceptBooking(mapSelectedBooking)}
                    >
                      <Text style={styles.mapAcceptBtnText}>Accept ₱{mapSelectedBooking.preferredFare}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.mapCounterBtn}
                      onPress={() => openOfferModal(mapSelectedBooking)}
                    >
                      <Text style={styles.mapCounterBtnText}>Counter</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              
              {/* Hint when no booking selected */}
              {!mapSelectedBooking && nearbyBookings.length > 0 && (
                <View style={styles.mapHint}>
                  <Text style={styles.mapHintText}>Tap a fare to view details</Text>
                </View>
              )}
            </View>
          ) : nearbyBookings.length === 0 && pendingOffers.length === 0 ? (
            // Empty state
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={70} color={colors.orangeShade4 || '#ccc'} />
              <Text style={styles.emptyTitle}>No Bookings Nearby</Text>
              <Text style={styles.emptySubtitle}>
                We'll notify you when passengers request trips in your area.
              </Text>
              <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
                <Ionicons name="refresh" size={18} color="#fff" />
                <Text style={styles.refreshBtnText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          ) : nearbyBookings.length > 0 ? (
            // Nearby Bookings Section
            <View style={styles.nearbyBookingsSection}>
              <View style={styles.sectionHeader}>
                <Ionicons name="locate-outline" size={20} color={colors.primary} />
                <Text style={styles.sectionTitle}>Nearby Requests</Text>
                <View style={styles.nearbyBadge}>
                  <Text style={styles.nearbyBadgeText}>{nearbyBookings.length}</Text>
                </View>
              </View>
              {nearbyBookings.map((booking) => (
                <View key={booking._id}>
                  {renderBookingCard({ item: booking })}
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* Counter Offer Modal */}
      <Modal
        visible={showOfferModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOfferModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Make Counter Offer</Text>
              <TouchableOpacity onPress={() => setShowOfferModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {selectedBooking && (
              <>
                <View style={styles.originalOfferRow}>
                  <Text style={styles.originalOfferLabel}>Passenger's offer:</Text>
                  <Text style={styles.originalOfferValue}>₱{selectedBooking.preferredFare}</Text>
                </View>

                <View style={styles.counterOfferInput}>
                  <Text style={styles.currencyPrefix}>₱</Text>
                  <TextInput
                    style={styles.offerTextInput}
                    placeholder="Enter your fare"
                    keyboardType="numeric"
                    value={counterOffer}
                    onChangeText={setCounterOffer}
                  />
                </View>

                <TextInput
                  style={styles.messageTextInput}
                  placeholder="Add a message (optional)"
                  value={offerMessage}
                  onChangeText={setOfferMessage}
                  multiline
                  numberOfLines={2}
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.acceptDirectBtn}
                    onPress={() => {
                      setShowOfferModal(false);
                      handleAcceptBooking(selectedBooking);
                    }}
                  >
                    <Text style={styles.acceptDirectBtnText}>Accept ₱{selectedBooking.preferredFare}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.sendOfferBtn} onPress={handleSendCounterOffer}>
                    <Text style={styles.sendOfferBtnText}>Send Offer</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Route Preview Modal */}
      <Modal
        visible={showRoutePreviewModal}
        transparent={false}
        animationType="slide"
        onRequestClose={closeRoutePreview}
      >
        <SafeAreaView style={styles.routePreviewContainer} edges={['top', 'bottom']}>
          {previewBooking && (
            <>
              {/* Header */}
              <View style={styles.routePreviewHeader}>
                <TouchableOpacity onPress={closeRoutePreview} style={styles.routeBackBtn}>
                  <Ionicons name="arrow-back" size={24} color={colors.orangeShade7 || '#333'} />
                </TouchableOpacity>
                <Text style={styles.routePreviewTitle}>Route Preview</Text>
                <View style={{ width: 40 }} />
              </View>

              {/* Loading State */}
              {isCalculatingRoute && (
                <View style={styles.routeLoadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.routeLoadingText}>Calculating best route...</Text>
                </View>
              )}

              {/* Map showing route - Only render when not calculating */}
              {!isCalculatingRoute && isFocused && (
                <View style={styles.routeMapContainer}>
                  <MapView
                    provider={PROVIDER_GOOGLE}
                    mapType="standard"
                    style={styles.routePreviewMap}
                    initialRegion={{
                      latitude: (previewBooking.pickup.latitude + previewBooking.destination.latitude) / 2,
                      longitude: (previewBooking.pickup.longitude + previewBooking.destination.longitude) / 2,
                      latitudeDelta: Math.abs(previewBooking.pickup.latitude - previewBooking.destination.latitude) * 1.5 + 0.01,
                      longitudeDelta: Math.abs(previewBooking.pickup.longitude - previewBooking.destination.longitude) * 1.5 + 0.01,
                    }}
                    showsUserLocation={true}
                  >
                    {/* Driver's current location marker */}
                    {userLocation && (
                      <Marker
                        coordinate={userLocation}
                        title="Your Location"
                      >
                        <View style={styles.driverMarker}>
                          <Ionicons name="bicycle" size={16} color="#fff" />
                        </View>
                      </Marker>
                    )}

                    {/* Pickup marker */}
                    <Marker
                      coordinate={previewBooking.pickup}
                      title="Pickup Location"
                      description={previewBooking.pickup.address || 'Passenger pickup point'}
                      anchor={{ x: 0.5, y: 0.5 }}
                      tracksViewChanges={false}
                    >
                      <View style={styles.pickupMarkerLarge}>
                        <Ionicons name="person" size={18} color="#fff" />
                      </View>
                    </Marker>

                    {/* Destination marker */}
                    <Marker
                      coordinate={previewBooking.destination}
                      title="Destination"
                      description={previewBooking.destination.address || 'Drop-off point'}
                      anchor={{ x: 0.5, y: 0.5 }}
                      tracksViewChanges={false}
                    >
                      <View style={styles.destinationMarkerLarge}>
                        <Ionicons name="flag" size={18} color="#fff" />
                      </View>
                    </Marker>

                    {/* Route line from driver to pickup */}
                    {previewPickupRoute.length > 1 && (
                      <Polyline
                        key="pickup-route"
                        coordinates={previewPickupRoute}
                        strokeColor="#6c757d"
                        strokeWidth={3}
                        lineCap="round"
                        lineJoin="round"
                      />
                    )}

                    {/* Route line from pickup to destination */}
                    {previewRouteCoordinates.length > 1 && (
                      <Polyline
                        key="trip-route"
                        coordinates={previewRouteCoordinates}
                        strokeColor="#2196F3"
                        strokeWidth={4}
                        lineCap="round"
                        lineJoin="round"
                      />
                    )}
                  </MapView>

                  {/* Map Legend */}
                  <View style={styles.mapLegend}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#6c757d' }]} />
                      <Text style={styles.legendText}>To Pickup</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#2196F3' }]} />
                      <Text style={styles.legendText}>Trip Route</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Trip Details Panel */}
              <View style={styles.routeDetailsPanel}>
                {/* Passenger Info */}
                <View style={styles.routePassengerRow}>
                  <View style={styles.avatarCircle}>
                    <Ionicons name="person" size={22} color="#fff" />
                  </View>
                  <View style={styles.routePassengerInfo}>
                    <Text style={styles.routePassengerName}>
                      {previewBooking.user?.firstname || 'Passenger'} {previewBooking.user?.lastname || ''}
                    </Text>
                    {previewBooking.user?.rating > 0 && (
                      <View style={styles.ratingBadge}>
                        <Ionicons name="star" size={12} color={colors.starYellow || '#FFD700'} />
                        <Text style={styles.ratingValue}>{previewBooking.user.rating.toFixed(1)}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.routeFareBox}>
                    <Text style={styles.routeFareLabel}>Offered Fare</Text>
                    <Text style={styles.routeFareAmount}>₱{previewBooking.preferredFare}</Text>
                  </View>
                </View>

                {/* Location Details */}
                <View style={styles.routeLocationDetails}>
                  <View style={styles.routeLocationRow}>
                    <View style={styles.routeLocationIcon}>
                      <View style={[styles.locationDot, { backgroundColor: '#28a745' }]} />
                      <View style={styles.locationLine} />
                    </View>
                    <View style={styles.routeLocationInfo}>
                      <Text style={styles.routeLocationLabel}>PICKUP</Text>
                      <Text style={styles.routeLocationAddress} numberOfLines={2}>
                        {previewBooking.pickup.address || `${previewBooking.pickup.latitude.toFixed(5)}, ${previewBooking.pickup.longitude.toFixed(5)}`}
                      </Text>
                      {userLocation && (
                        <Text style={styles.routeLocationDistance}>
                          {formatDistance(calculateDistance(
                            userLocation.latitude,
                            userLocation.longitude,
                            previewBooking.pickup.latitude,
                            previewBooking.pickup.longitude
                          ))} from you
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.routeLocationRow}>
                    <View style={styles.routeLocationIcon}>
                      <View style={[styles.locationDot, { backgroundColor: colors.primary }]} />
                    </View>
                    <View style={styles.routeLocationInfo}>
                      <Text style={styles.routeLocationLabel}>DESTINATION</Text>
                      <Text style={styles.routeLocationAddress} numberOfLines={2}>
                        {previewBooking.destination.address || `${previewBooking.destination.latitude.toFixed(5)}, ${previewBooking.destination.longitude.toFixed(5)}`}
                      </Text>
                      <Text style={styles.routeLocationDistance}>
                        {formatDistance(calculateDistance(
                          previewBooking.pickup.latitude,
                          previewBooking.pickup.longitude,
                          previewBooking.destination.latitude,
                          previewBooking.destination.longitude
                        ))} trip
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.routeActions}>
                  <TouchableOpacity
                    style={styles.routeAcceptBtn}
                    onPress={() => {
                      closeRoutePreview();
                      handleAcceptBooking(previewBooking);
                    }}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.routeAcceptBtnText}>Accept Booking</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.routeCounterBtn}
                    onPress={() => {
                      closeRoutePreview();
                      openOfferModal(previewBooking);
                    }}
                  >
                    <Ionicons name="cash-outline" size={20} color={colors.primary} />
                    <Text style={styles.routeCounterBtnText}>Counter Offer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </SafeAreaView>
      </Modal>

      {/* Trip History Modal */}
      <Modal
        visible={showHistoryModal}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <SafeAreaView style={styles.historyModalContainer} edges={['top', 'bottom']}>
          <View style={styles.historyModalHeader}>
            <Text style={styles.historyModalTitle}>Trip History</Text>
            <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {tripHistory.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Ionicons name="document-text-outline" size={50} color="#ccc" />
              <Text style={styles.emptyHistoryText}>No completed trips yet</Text>
            </View>
          ) : (
            <FlatList
              data={tripHistory}
              renderItem={renderHistoryItem}
              keyExtractor={(item) => item._id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.historyList}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* Koding/Boundary Settlement Modal */}
      <Modal
        visible={showKodingModal}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowKodingModal(false)}
      >
        <SafeAreaView style={styles.kodingModalContainer} edges={['top', 'bottom']}>
          <View style={styles.kodingModalHeader}>
            <Text style={styles.kodingModalTitle}>Boundary</Text>
            <TouchableOpacity onPress={() => setShowKodingModal(false)}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {loadingKoding ? (
            <View style={styles.kodingLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ marginTop: 10 }}>Loading...</Text>
            </View>
          ) : !kodingInfo?.hasTricycle ? (
            <View style={styles.kodingEmpty}>
              <Ionicons name="bicycle-outline" size={60} color="#ccc" />
              <Text style={styles.kodingEmptyText}>No tricycle assigned</Text>
              <Text style={styles.kodingEmptySubtext}>
                Contact your operator to get assigned to a tricycle
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.kodingContent} showsVerticalScrollIndicator={false}>
              {/* Tricycle & Operator Info */}
              <View style={styles.kodingInfoCard}>
                <View style={styles.kodingInfoRow}>
                  <Ionicons name="bicycle" size={20} color={colors.primary} />
                  <Text style={styles.kodingInfoLabel}>Tricycle:</Text>
                  <Text style={styles.kodingInfoValue}>
                    {kodingInfo.tricycle.plateNumber} {kodingInfo.tricycle.bodyNumber ? `(${kodingInfo.tricycle.bodyNumber})` : ''}
                  </Text>
                </View>
                <View style={styles.kodingInfoRow}>
                  <Ionicons name="person" size={20} color={colors.primary} />
                  <Text style={styles.kodingInfoLabel}>Operator:</Text>
                  <Text style={styles.kodingInfoValue}>{kodingInfo.operator?.name || 'N/A'}</Text>
                </View>
                <View style={styles.kodingInfoRow}>
                  <Ionicons name="cash" size={20} color="#28a745" />
                  <Text style={styles.kodingInfoLabel}>Rate:</Text>
                  <Text style={[styles.kodingInfoValue, { color: '#28a745', fontWeight: '700' }]}>
                    ₱{kodingInfo.tricycle.boundary?.amount || 0} / {kodingInfo.tricycle.boundary?.settlementType || 'daily'}
                  </Text>
                </View>
              </View>

              {/* Summary Cards */}
              <View style={styles.kodingSummaryRow}>
                <View style={[styles.kodingSummaryCard, { backgroundColor: '#fff3cd' }]}>
                  <Text style={styles.kodingSummaryLabel}>Pending</Text>
                  <Text style={[styles.kodingSummaryValue, { color: '#856404' }]}>
                    ₱{kodingInfo.summary?.totalPending || 0}
                  </Text>
                  <Text style={styles.kodingSummaryCount}>
                    {kodingInfo.summary?.pendingCount || 0} unsettled
                  </Text>
                </View>
                <View style={[styles.kodingSummaryCard, { backgroundColor: '#cce5ff' }]}>
                  <Text style={styles.kodingSummaryLabel}>Awaiting Confirm</Text>
                  <Text style={[styles.kodingSummaryValue, { color: '#004085' }]}>
                    ₱{kodingInfo.summary?.totalAwaitingConfirmation || 0}
                  </Text>
                  <Text style={styles.kodingSummaryCount}>
                    {kodingInfo.summary?.awaitingConfirmationCount || 0} pending
                  </Text>
                </View>
              </View>

              {/* Settle Payment Section */}
              <View style={styles.kodingSettleSection}>
                <Text style={styles.kodingSectionTitle}>Settle Payment</Text>
                
                <Text style={styles.kodingInputLabel}>Amount (₱)</Text>
                <TextInput
                  style={styles.kodingInput}
                  value={settlingAmount}
                  onChangeText={setSettlingAmount}
                  keyboardType="numeric"
                  placeholder="Enter amount"
                />

                <Text style={styles.kodingInputLabel}>Payment Method</Text>
                <View style={styles.paymentMethodRow}>
                  {['cash', 'gcash', 'bank_transfer'].map((method) => (
                    <TouchableOpacity
                      key={method}
                      style={[
                        styles.paymentMethodBtn,
                        paymentMethod === method && styles.paymentMethodBtnActive
                      ]}
                      onPress={() => setPaymentMethod(method)}
                    >
                      <Ionicons
                        name={method === 'cash' ? 'cash-outline' : method === 'gcash' ? 'phone-portrait-outline' : 'card-outline'}
                        size={16}
                        color={paymentMethod === method ? '#fff' : '#666'}
                      />
                      <Text style={[
                        styles.paymentMethodText,
                        paymentMethod === method && styles.paymentMethodTextActive
                      ]}>
                        {method === 'cash' ? 'Cash' : method === 'gcash' ? 'GCash' : 'Bank'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.kodingInputLabel}>Notes (Optional)</Text>
                <TextInput
                  style={[styles.kodingInput, { height: 60, textAlignVertical: 'top' }]}
                  value={settlementNotes}
                  onChangeText={setSettlementNotes}
                  placeholder="Add notes..."
                  multiline
                />

                <TouchableOpacity
                  style={[styles.settleBtn, submittingSettlement && { opacity: 0.7 }]}
                  onPress={handleSettlePayment}
                  disabled={submittingSettlement}
                >
                  {submittingSettlement ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={styles.settleBtnText}>Record Payment</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Recent Settlements */}
              {kodingInfo.pendingSettlements?.length > 0 && (
                <View style={styles.kodingRecentSection}>
                  <Text style={styles.kodingSectionTitle}>Pending Settlements</Text>
                  {kodingInfo.pendingSettlements.map((settlement) => (
                    <View key={settlement._id} style={styles.settlementItem}>
                      <View style={styles.settlementRow}>
                        <Text style={styles.settlementAmount}>₱{settlement.amount}</Text>
                        <View style={[
                          styles.settlementStatus,
                          { backgroundColor: settlement.status === 'paid' ? '#cce5ff' : '#fff3cd' }
                        ]}>
                          <Text style={{
                            fontSize: 10,
                            color: settlement.status === 'paid' ? '#004085' : '#856404'
                          }}>
                            {settlement.status === 'paid' ? 'Awaiting Confirmation' : 'Pending'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.settlementDate}>
                        {new Date(settlement.paidAt || settlement.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

// ==================== STYLES ====================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ivory1 || '#FFFEF7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.orangeShade5 || '#666',
  },

  // No Tricycle Assigned Banner
  noTricycleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  noTricycleBannerTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  noTricycleBannerText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 2,
  },

  // Coding Day Banner
  codingDayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc3545',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  codingDayBannerTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  codingDayBannerText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 2,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.medium || 16,
    paddingVertical: spacing.medium || 16,
    backgroundColor: colors.ivory1 || '#FFFEF7',
    borderBottomWidth: 1,
    borderBottomColor: colors.ivory3 || '#E8E8E8',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitleSection: {
    marginLeft: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.orangeShade7 || '#333',
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.orangeShade5 || '#666',
    marginTop: 2,
  },
  onlineToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.ivory4 || '#F5F5F5',
    borderWidth: 1,
    borderColor: colors.ivory3 || '#E8E8E8',
  },
  onlineToggleActive: {
    backgroundColor: '#d4edda',
    borderColor: '#28a745',
  },
  onlineToggleDisabled: {
    opacity: 0.5,
  },
  toggleIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#999',
    marginRight: 8,
  },
  toggleIndicatorActive: {
    backgroundColor: '#28a745',
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
  },
  toggleLabelActive: {
    color: '#28a745',
  },

  // Action row
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.medium || 16,
    paddingVertical: spacing.small || 8,
    gap: 8,
  },
  viewModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  viewModeBtnActive: {
    backgroundColor: colors.primary,
  },
  viewModeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 4,
  },
  viewModeBtnTextActive: {
    color: '#fff',
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    marginLeft: 'auto',
  },
  historyBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 4,
  },

  // Booking card
  listContent: {
    padding: spacing.medium || 16,
  },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: spacing.medium || 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.ivory3 || '#E8E8E8',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  passengerSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passengerDetails: {
    marginLeft: 10,
  },
  passengerName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.orangeShade7 || '#333',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  ratingValue: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  fareContainer: {
    alignItems: 'flex-end',
  },
  fareLabel: {
    fontSize: 11,
    color: '#999',
    textTransform: 'uppercase',
  },
  fareAmount: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
  },
  tripDetails: {
    marginBottom: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.ivory3 || '#E8E8E8',
  },
  tripDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  iconWrapper: {
    width: 24,
    alignItems: 'center',
  },
  tripDetailText: {
    fontSize: 13,
    color: colors.orangeShade6 || '#555',
    marginLeft: 6,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
  },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28a745',
    paddingVertical: 12,
    borderRadius: 10,
  },
  acceptBtnText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
  },
  counterOfferBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  counterOfferBtnText: {
    color: colors.primary,
    fontWeight: '600',
    marginLeft: 6,
  },

  // Offline / Empty states
  offlineContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.large || 24,
  },
  offlineTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.orangeShade7 || '#333',
    marginTop: 16,
  },
  offlineSubtitle: {
    fontSize: 14,
    color: colors.orangeShade5 || '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  goOnlineBtn: {
    marginTop: 24,
    backgroundColor: '#28a745',
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 12,
  },
  goOnlineBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.large || 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.orangeShade7 || '#333',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.orangeShade5 || '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  refreshBtn: {
    marginTop: 24,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  refreshBtnText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
  },

  // Map
  mapContainer: {
    flex: 1,
  },
  fullMap: {
    flex: 1,
  },
  centerMapBtn: {
    position: 'absolute',
    right: 16,
    bottom: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  bookingMarker: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#fff',
  },
  bookingMarkerText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  
  // Lightweight fare-based markers (no Ionicons for better performance)
  fareMarker: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  fareMarkerSelected: {
    backgroundColor: '#28a745',
    borderWidth: 3,
    transform: [{ scale: 1.1 }],
  },
  fareMarkerText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  destMarkerSimple: {
    width: 28,
    height: 28,
    backgroundColor: colors.primary,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  destMarkerIcon: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  mapRouteLoading: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mapRouteLoadingText: {
    fontSize: 12,
    color: colors.orangeShade5,
  },
  mapBookingCard: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  mapBookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  mapBookingPassenger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarCircleSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapBookingName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.orangeShade7 || '#333',
  },
  ratingValueSmall: {
    fontSize: 11,
    color: colors.orangeShade5,
    marginLeft: 2,
  },
  mapBookingFare: {
    alignItems: 'flex-end',
  },
  mapBookingFareLabel: {
    fontSize: 10,
    color: colors.orangeShade4,
  },
  mapBookingFareAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  mapBookingDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.ivory3 || '#eee',
  },
  mapBookingDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mapBookingDetailText: {
    fontSize: 12,
    color: colors.orangeShade6 || '#666',
  },
  mapBookingActions: {
    flexDirection: 'row',
    gap: 10,
  },
  mapAcceptBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28a745',
    paddingVertical: 12,
    borderRadius: 10,
  },
  mapAcceptBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  mapCounterBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ivory3 || '#f0f0f0',
    paddingVertical: 12,
    borderRadius: 10,
  },
  mapCounterBtnText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  mapHint: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mapHintText: {
    fontSize: 13,
    color: '#666',
  },

  // Active trip
  activeTripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.medium || 16,
    paddingVertical: 12,
    backgroundColor: colors.ivory1 || '#FFFEF7',
    borderBottomWidth: 1,
    borderBottomColor: colors.ivory3 || '#E8E8E8',
  },
  tripStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d4edda',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  tripStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#28a745',
    marginRight: 8,
  },
  tripStatusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#155724',
  },
  // Awaiting confirmation styles
  awaitingBadge: {
    backgroundColor: '#fff3cd',
  },
  awaitingDot: {
    backgroundColor: '#856404',
  },
  awaitingText: {
    color: '#856404',
  },
  awaitingSection: {
    alignItems: 'center',
    paddingVertical: spacing.medium || 16,
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    marginTop: 8,
  },
  awaitingIcon: {
    marginBottom: 8,
  },
  awaitingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#856404',
    marginBottom: 4,
  },
  awaitingMessage: {
    fontSize: 13,
    color: '#856404',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  cancelIcon: {
    padding: 8,
  },
  pickupMarker: {
    backgroundColor: '#28a745',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destinationMarker: {
    backgroundColor: colors.primary,
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simulationMarker: {
    backgroundColor: '#6f42c1',
    padding: 10,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#6f42c1',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
  },
  tripPanel: {
    backgroundColor: '#fff',
    paddingHorizontal: spacing.medium || 16,
    paddingVertical: spacing.medium || 16,
    borderTopWidth: 1,
    borderTopColor: colors.ivory3 || '#E8E8E8',
  },
  tripPassengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tripPassengerInfo: {
    marginLeft: 12,
  },
  tripPassengerName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.orangeShade7 || '#333',
  },
  tripFare: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  distanceInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.ivory4 || '#F5F5F5',
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  distanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceLabel: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  distanceValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.orangeShade7 || '#333',
    marginLeft: 4,
  },
  pickupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007bff',
    paddingVertical: 14,
    borderRadius: 12,
  },
  pickupBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    marginLeft: 8,
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28a745',
    paddingVertical: 14,
    borderRadius: 12,
  },
  completeBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    marginLeft: 8,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  completionHint: {
    fontSize: 12,
    color: colors.orangeShade5 || '#666',
    textAlign: 'center',
    marginTop: 10,
  },
  pickupHint: {
    fontSize: 12,
    color: '#dc3545',
    textAlign: 'center',
    marginTop: 10,
    fontWeight: '500',
  },
  pickupHintSuccess: {
    color: '#28a745',
  },
  // Simulation button (testing only)
  simulateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6f42c1',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 2,
    borderColor: '#5a32a3',
    borderStyle: 'dashed',
  },
  simulateBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 8,
  },
  overridePickupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e67e22',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  overridePickupBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 6,
  },

  // Simulation Control Panel (inline)
  simulationControlPanel: {
    backgroundColor: '#f3e8ff',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 2,
    borderColor: '#6f42c1',
  },
  simControlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  simControlTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6f42c1',
    marginLeft: 6,
    flex: 1,
  },
  simControlProgress: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6f42c1',
  },
  simProgressBar: {
    height: 8,
    backgroundColor: '#e0d4f7',
    borderRadius: 4,
    marginBottom: 8,
  },
  simProgressFill: {
    height: '100%',
    backgroundColor: '#6f42c1',
    borderRadius: 4,
  },
  simDistanceText: {
    fontSize: 12,
    color: '#6f42c1',
    marginBottom: 8,
  },
  simControlButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  simPauseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffc107',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  simResumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#28a745',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  simStopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc3545',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  simBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
    marginLeft: 4,
  },
  simSpeedButtons: {
    flexDirection: 'row',
    marginLeft: 'auto',
    gap: 4,
  },
  simSpeedBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: '#e0d4f7',
  },
  simSpeedBtnActive: {
    backgroundColor: '#6f42c1',
  },
  simSpeedBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6f42c1',
  },
  simSpeedBtnTextActive: {
    color: '#fff',
  },

  // Simulation Modal
  simModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  simModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 20,
  },
  simModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  simModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#6f42c1',
    marginLeft: 8,
  },
  simModalInfo: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  simModalInfoText: {
    fontSize: 14,
    color: '#495057',
    marginBottom: 4,
  },
  simModalSpeedSection: {
    marginBottom: 16,
  },
  simModalSpeedLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  simModalSpeedButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  simModalSpeedBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
  },
  simModalSpeedBtnActive: {
    backgroundColor: '#6f42c1',
  },
  simModalSpeedBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6f42c1',
  },
  simModalSpeedBtnTextActive: {
    color: '#fff',
  },
  simStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28a745',
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 16,
  },
  simStartBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  simModalWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  simModalWarningText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    color: '#856404',
    lineHeight: 18,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.large || 24,
    paddingBottom: 24,
  },
  historyModalContent: {
    maxHeight: SCREEN_HEIGHT * 0.7,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.orangeShade7 || '#333',
  },
  originalOfferRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.ivory3 || '#E8E8E8',
  },
  originalOfferLabel: {
    fontSize: 14,
    color: '#666',
  },
  originalOfferValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.orangeShade7 || '#333',
  },
  counterOfferInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ivory4 || '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  currencyPrefix: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
  },
  offerTextInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: colors.orangeShade7 || '#333',
    paddingVertical: 14,
    marginLeft: 8,
  },
  messageTextInput: {
    backgroundColor: colors.ivory4 || '#F5F5F5',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  acceptDirectBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.ivory4 || '#F5F5F5',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#28a745',
  },
  acceptDirectBtnText: {
    color: '#28a745',
    fontWeight: '600',
  },
  sendOfferBtn: {
    flex: 1.5,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  sendOfferBtnText: {
    color: '#fff',
    fontWeight: '700',
  },

  // History Modal
  historyModalContainer: {
    flex: 1,
    backgroundColor: colors.ivory1 || '#FFFEF7',
    padding: spacing.medium || 16,
  },
  historyModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.medium || 16,
    paddingBottom: spacing.medium || 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.ivory3 || '#E8E8E8',
  },
  historyModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.orangeShade7 || '#333',
  },
  historyList: {
    paddingBottom: spacing.medium || 16,
  },
  emptyHistory: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHistoryText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
  historyItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.ivory3 || '#E8E8E8',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyPassenger: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.orangeShade7 || '#333',
  },
  historyFare: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  historyDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  historyStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  historyStatusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  historyArrow: {
    position: 'absolute',
    right: 0,
    top: '50%',
    marginTop: -8,
  },

  // Content scroll
  contentScroll: {
    flex: 1,
  },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.orangeShade7 || '#333',
    marginLeft: 8,
  },

  // Pending offers section
  pendingOffersSection: {
    padding: spacing.medium || 16,
    paddingBottom: 8,
  },
  pendingBadge: {
    backgroundColor: '#ffc107',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  pendingBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#333',
  },
  pendingOfferCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ffc107',
    borderLeftWidth: 4,
  },
  pendingOfferHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  pendingOfferPassenger: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingOfferName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.orangeShade7 || '#333',
    marginLeft: 8,
  },
  pendingOfferStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  waitingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffc107',
    marginRight: 6,
  },
  waitingText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#856404',
  },
  pendingOfferDetails: {
    marginBottom: 8,
  },
  pendingOfferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  pendingOfferFare: {
    fontSize: 14,
    fontWeight: '600',
    color: '#28a745',
    marginLeft: 8,
  },
  pendingOfferOriginal: {
    fontSize: 13,
    color: '#6c757d',
    marginLeft: 8,
  },
  pendingOfferLocation: {
    fontSize: 13,
    color: colors.orangeShade6 || '#555',
    marginLeft: 8,
    flex: 1,
  },
  pendingOfferActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    marginBottom: 8,
  },
  withdrawOfferBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dc3545',
  },
  withdrawOfferBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc3545',
    marginLeft: 4,
  },
  pendingOfferHint: {
    fontSize: 12,
    color: '#856404',
    fontStyle: 'italic',
  },

  // Nearby bookings section
  nearbyBookingsSection: {
    padding: spacing.medium || 16,
    paddingTop: 8,
  },
  nearbyBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  nearbyBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },

  // Route Preview Modal Styles
  routePreviewContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  routePreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.medium || 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  routeBackBtn: {
    padding: 8,
  },
  routePreviewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.orangeShade7 || '#333',
  },
  routeMapContainer: {
    flex: 1,
    position: 'relative',
  },
  routePreviewMap: {
    flex: 1,
  },
  driverMarker: {
    backgroundColor: '#007bff',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
  },
  pickupMarkerLarge: {
    backgroundColor: '#28a745',
    padding: 10,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destinationMarkerLarge: {
    backgroundColor: colors.primary,
    padding: 10,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapLegend: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 8,
    padding: 8,
    flexDirection: 'row',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 12,
    height: 4,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 11,
    color: '#666',
  },
  routeDetailsPanel: {
    backgroundColor: '#fff',
    paddingHorizontal: spacing.medium || 16,
    paddingVertical: spacing.medium || 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10,
  },
  routePassengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  routePassengerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  routePassengerName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.orangeShade7 || '#333',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  ratingValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  routeFareBox: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  routeFareLabel: {
    fontSize: 10,
    color: '#388e3c',
    fontWeight: '500',
  },
  routeFareAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#28a745',
  },
  routeLocationDetails: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
    marginBottom: 16,
  },
  routeLocationRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  routeLocationIcon: {
    width: 24,
    alignItems: 'center',
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  locationLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#ddd',
    marginTop: 4,
    marginBottom: -8,
  },
  routeLocationInfo: {
    flex: 1,
    marginLeft: 12,
  },
  routeLocationLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  routeLocationAddress: {
    fontSize: 14,
    color: colors.orangeShade7 || '#333',
    lineHeight: 20,
  },
  routeLocationDistance: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 2,
  },
  routeActions: {
    flexDirection: 'row',
    gap: 12,
  },
  routeAcceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28a745',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  routeAcceptBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  routeCounterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    gap: 8,
  },
  routeCounterBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  viewRouteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f4f8',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
    gap: 6,
  },
  viewRouteBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007bff',
  },

  // Koding Button
  kodingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#d4edda',
    marginLeft: 8,
    gap: 6,
  },
  kodingBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#28a745',
  },

  // Koding Modal Styles
  kodingModalContainer: {
    flex: 1,
    backgroundColor: colors.ivory1 || '#FFFEF7',
  },
  kodingModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  kodingModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.orangeShade7 || '#333',
  },
  kodingLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kodingEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  kodingEmptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  kodingEmptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  kodingContent: {
    flex: 1,
    padding: 16,
  },
  kodingInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  kodingInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  kodingInfoLabel: {
    fontSize: 14,
    color: '#666',
    width: 70,
  },
  kodingInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  kodingSummaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  kodingSummaryCard: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  kodingSummaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  kodingSummaryValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  kodingSummaryCount: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  kodingSettleSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  kodingSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  kodingInputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  kodingInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 12,
    backgroundColor: '#fafafa',
  },
  paymentMethodRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  paymentMethodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    gap: 6,
  },
  paymentMethodBtnActive: {
    backgroundColor: colors.primary,
  },
  paymentMethodText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  paymentMethodTextActive: {
    color: '#fff',
  },
  settleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28a745',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 8,
    gap: 8,
  },
  settleBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  kodingRecentSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  settlementItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settlementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settlementAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  settlementStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  settlementDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  
  // Route Loading Overlay
  routeLoadingOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  // Route Loading Container
  routeLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  routeLoadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
});

export default DriverBookingScreen;
