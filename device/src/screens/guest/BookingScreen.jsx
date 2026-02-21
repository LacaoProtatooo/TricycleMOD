/**
 * BookingScreen.jsx - Guest Booking/Special Trip Screen
 *
 * Allows users to book special trips:
 * - Get current location
 * - Set pickup and destination locations
 * - Set preferred fare amount
 * - Accept/Decline driver offers
 * - Complete trip and rate driver
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Dimensions,
  FlatList,
  Platform,
} from 'react-native';
import MapView, { Marker, Circle, Polyline, Polygon, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import axios from 'axios';

import { colors, spacing } from '../../components/common/theme';
import { useIsFocused } from '@react-navigation/native';
import { useAsyncSQLiteContext } from '../../utils/asyncSQliteProvider';
import { getToken } from '../../utils/jwtStorage';
import { getUserCredentials } from '../../utils/userStorage';
import { API_URL as BASE_URL } from '../../utils/config';
import {
  WEBTODA_SERVICE_AREA,
  WEBTODA_ROUTE_COORDINATES,
  validatePickupLocation,
  validateDestinationLocation,
  getServiceAreaRegion,
  getServiceAreaPolygon,
  getDistanceToRoute,
} from '../../utils/gpxParser';
import {
  getRouteWithFare,
  formatDistance,
  formatDuration,
  FARE_CONFIG,
} from '../../utils/routeService';
import {
  createBooking,
  getActiveBooking,
  respondToOffer,
  rateDriver,
  cancelBooking,
  clearBookingError,
  resetBookingState,
  updateBookingStatus,
} from '../../redux/actions/bookingAction';

const BACKEND_URL = BASE_URL;
const API_URL = `${BACKEND_URL}/api/booking`;

// Use WEBTODA GPX-based service area instead of generic circle
// The service area is defined by the GPX route with buffer zones
const SERVICE_AREA = {
  ...WEBTODA_SERVICE_AREA,
  // Keep backward compatibility
  center: WEBTODA_SERVICE_AREA.center,
  radiusKm: 2, // Approximate coverage (actual area is polygon-based)
};

// Trip completion radius (300 meters)
const COMPLETION_RADIUS_METERS = 300;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Booking status constants
const BOOKING_STATUS = {
  IDLE: 'idle',
  SELECTING_LOCATIONS: 'selecting_locations',
  SETTING_FARE: 'setting_fare',
  WAITING_FOR_DRIVER: 'waiting_for_driver',
  OFFERS_RECEIVED: 'offers_received',  // New: multiple offers available
  OFFER_RECEIVED: 'offer_received',    // Kept for backward compatibility
  TRIP_ACTIVE: 'trip_active',
  AWAITING_CONFIRMATION: 'awaiting_confirmation',
  TRIP_COMPLETED: 'trip_completed',
  RATING: 'rating',
};

const BookingScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const isFocused = useIsFocused();
  const mapRef = useRef(null);
  const db = useAsyncSQLiteContext();
  
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  
  // Redux state
  const { user } = useSelector((state) => state.auth);
  const {
    currentBooking,
    driverOffer,
    loading,
    error,
  } = useSelector((state) => state.booking || {});

  // History state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [tripHistory, setTripHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Local state
  const [hasPermission, setHasPermission] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [bookingStatus, setBookingStatus] = useState(BOOKING_STATUS.IDLE);
  
  // Location selection
  const [pickupLocation, setPickupLocation] = useState(null);
  const [destinationLocation, setDestinationLocation] = useState(null);
  const [selectingLocationType, setSelectingLocationType] = useState(null); // 'pickup' or 'destination'
  
  // Fare
  const [preferredFare, setPreferredFare] = useState('');
  const [offeredFare, setOfferedFare] = useState(null);
  
  // Rating
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  
  // Completion confirmation modal
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  
  // WEBTODA area warning state
  const [destinationWarning, setDestinationWarning] = useState(null);
  const [showAreaWarningModal, setShowAreaWarningModal] = useState(false);
  const [pendingDestination, setPendingDestination] = useState(null);
  
  // Cancellation report modal
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [cancellationDetails, setCancellationDetails] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [cancellationRating, setCancellationRating] = useState(0);
  const [cancellationRatingComment, setCancellationRatingComment] = useState('');
  const [isSubmittingCancellationRating, setIsSubmittingCancellationRating] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  
  // Multi-offer state
  const [driverOffers, setDriverOffers] = useState([]);
  const [showOffersModal, setShowOffersModal] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState(null);
  
  // Trip tracking
  const [distanceToDestination, setDistanceToDestination] = useState(null);
  const watchRef = useRef(null);
  const pollingRef = useRef(null);
  
  // Route calculation state
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [suggestedFare, setSuggestedFare] = useState(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [routeError, setRouteError] = useState(null);

  // Location search state
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchType, setSearchType] = useState(null); // 'pickup' or 'destination'
  const searchTimeoutRef = useRef(null);

  // Initialize region with WEBTODA service area
  const [region, setRegion] = useState(getServiceAreaRegion());

  // Check authentication on mount
  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      const credentials = await getUserCredentials();
      if (credentials && (credentials._id || credentials.id)) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Error checking authentication:', error);
      setIsAuthenticated(false);
    } finally {
      setCheckingAuth(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      requestPermissions();
      // Fetch active booking on mount
      if (db && user) {
        dispatch(getActiveBooking(db));
      }
    }
    return () => {
      if (watchRef.current) {
        watchRef.current.remove();
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [db, user, isAuthenticated]);

  // Polling for booking status updates when waiting or in active trip
  useEffect(() => {
    const shouldPoll = [
      BOOKING_STATUS.WAITING_FOR_DRIVER,
      BOOKING_STATUS.OFFERS_RECEIVED,  // Include OFFERS_RECEIVED to get new offers
      BOOKING_STATUS.OFFER_RECEIVED,
      BOOKING_STATUS.TRIP_ACTIVE,
    ].includes(bookingStatus);

    if (shouldPoll && db && user) {
      // Start polling every 5 seconds
      pollingRef.current = setInterval(() => {
        dispatch(getActiveBooking(db));
      }, 5000);
    } else {
      // Stop polling when not needed
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [bookingStatus, db, user, dispatch]);

  // Handle errors
  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [
        { text: 'OK', onPress: () => dispatch(clearBookingError()) }
      ]);
    }
  }, [error, dispatch]);

  // Update booking status based on currentBooking
  useEffect(() => {
    if (currentBooking) {
      // Also restore the preferredFare from active booking
      if (currentBooking.preferredFare) {
        setPreferredFare(currentBooking.preferredFare.toString());
      }
      // Restore pickup and destination locations
      if (currentBooking.pickup) {
        setPickupLocation(currentBooking.pickup);
      }
      if (currentBooking.destination) {
        setDestinationLocation(currentBooking.destination);
      }
      
      // Update driver offers state for multi-offer support
      if (currentBooking.driverOffers && currentBooking.driverOffers.length > 0) {
        const pendingOffers = currentBooking.driverOffers.filter(offer => offer.status === 'pending');
        setDriverOffers(pendingOffers);
        // Auto-show offers modal when there are pending offers
        if (pendingOffers.length > 0 && currentBooking.status === 'pending') {
          setShowOffersModal(true);
        }
      } else {
        setDriverOffers([]);
      }
      
      switch (currentBooking.status) {
        case 'pending':
          // Check if there are pending driver offers
          const pendingOffers = currentBooking.driverOffers?.filter(offer => offer.status === 'pending') || [];
          if (pendingOffers.length > 0) {
            setBookingStatus(BOOKING_STATUS.OFFERS_RECEIVED);
          } else {
            setBookingStatus(BOOKING_STATUS.WAITING_FOR_DRIVER);
            setShowOffersModal(false);
          }
          break;
        case 'offer_made':
          // Backward compatibility for single offer
          setBookingStatus(BOOKING_STATUS.OFFER_RECEIVED);
          setOfferedFare(currentBooking.driverOffer?.amount);
          break;
        case 'accepted':
        case 'in_progress':
          setBookingStatus(BOOKING_STATUS.TRIP_ACTIVE);
          startLocationTracking();
          break;
        case 'awaiting_confirmation':
        case 'completed':
          setBookingStatus(BOOKING_STATUS.TRIP_COMPLETED);
          setShowCompletionModal(false);
          setShowRatingModal(true);
          break;
        case 'cancelled':
          // Show cancellation modal if booking was cancelled by driver (not by user)
          if (currentBooking.cancelledBy === 'driver') {
            setCancellationDetails({
              driverName: currentBooking.driver 
                ? `${currentBooking.driver.firstname} ${currentBooking.driver.lastname}`
                : 'Driver',
              driverId: currentBooking.driver?._id,
              reason: currentBooking.cancellationReason || 'No reason provided',
              bookingId: currentBooking._id,
              cancelledAt: currentBooking.cancelledAt,
            });
            setCancellationRating(0);
            setCancellationRatingComment('');
            setShowCancellationModal(true);
          } else {
            resetBooking();
          }
          break;
        case 'expired':
          Alert.alert(
            'Booking Expired',
            'Your booking has expired. No drivers responded in time.',
            [{ text: 'OK', onPress: resetBooking }]
          );
          break;
        default:
          break;
      }
    }
  }, [currentBooking]);

  const requestPermissions = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setHasPermission(true);
        getCurrentLocation();
      } else {
        Alert.alert(
          'Location Permission',
          'Location permission is required to use booking features.'
        );
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      setIsOnline(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = location.coords;
      setUserLocation({ latitude, longitude });
      setRegion({
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } catch (error) {
      console.warn('Error getting location:', error);
      setIsOnline(false);
    }
  };

  const startLocationTracking = async () => {
    if (watchRef.current) return;

    try {
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (location) => {
          const { latitude, longitude } = location.coords;
          setUserLocation({ latitude, longitude });
          
          // Calculate distance to destination
          if (destinationLocation) {
            const distance = calculateDistance(
              latitude,
              longitude,
              destinationLocation.latitude,
              destinationLocation.longitude
            );
            setDistanceToDestination(distance);
          }
        }
      );
      watchRef.current = subscription;
    } catch (error) {
      console.error('Error starting location tracking:', error);
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

  // Check if pickup location is within WEBTODA service area (based on GPX route)
  const isWithinServiceArea = (latitude, longitude) => {
    const validation = validatePickupLocation(latitude, longitude);
    return validation.valid;
  };

  // Handle map press for selecting pickup/destination
  const handleMapPress = (event) => {
    if (!selectingLocationType) return;

    const { latitude, longitude } = event.nativeEvent.coordinate;

    if (selectingLocationType === 'pickup') {
      // Allow pickup anywhere - no area restriction
      setPickupLocation({ latitude, longitude });
      setSelectingLocationType(null);
    } else if (selectingLocationType === 'destination') {
      // Validate destination - allow but warn if outside area
      const destValidation = validateDestinationLocation(latitude, longitude);
      
      if (destValidation.additionalChargeExpected) {
        // Store pending destination and show warning modal
        setPendingDestination({ latitude, longitude });
        setDestinationWarning(destValidation);
        setShowAreaWarningModal(true);
      } else {
        setDestinationLocation({ latitude, longitude });
        setDestinationWarning(null);
        setSelectingLocationType(null);
      }
    }
  };

  // Confirm destination that is outside service area
  const handleConfirmOutsideDestination = () => {
    if (pendingDestination) {
      setDestinationLocation(pendingDestination);
      setPendingDestination(null);
      setShowAreaWarningModal(false);
      setSelectingLocationType(null);
    }
  };

  // Cancel destination selection when outside area
  const handleCancelOutsideDestination = () => {
    setPendingDestination(null);
    setShowAreaWarningModal(false);
    setDestinationWarning(null);
  };

  // Location search functions
  const openLocationSearch = (type) => {
    setSearchType(type);
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchModal(true);
  };

  const searchLocation = async (query) => {
    if (!query || query.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Use Nominatim OpenStreetMap API for geocoding (free, no API key required)
      // Bias search results to Philippines/Calamba area
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/search`,
        {
          params: {
            q: query,
            format: 'json',
            addressdetails: 1,
            limit: 10,
            countrycodes: 'ph', // Limit to Philippines
            viewbox: '121.0,14.0,121.3,14.3', // Bounding box around Calamba/Laguna area
            bounded: 0, // Don't strictly bound, but prefer results in viewbox
          },
          headers: {
            'User-Agent': 'TricycleMOD-App', // Required by Nominatim
          },
        }
      );

      const results = response.data.map((item) => ({
        id: item.place_id,
        name: item.display_name.split(',')[0],
        address: item.display_name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        type: item.type,
      }));

      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      // Fallback: try using expo-location reverse geocoding for the query
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchQueryChange = (text) => {
    setSearchQuery(text);
    
    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      searchLocation(text);
    }, 500);
  };

  const handleSelectSearchResult = (result) => {
    const location = {
      latitude: result.latitude,
      longitude: result.longitude,
    };

    if (searchType === 'pickup') {
      setPickupLocation(location);
      if (!selectingLocationType) {
        setSelectingLocationType('destination');
      } else {
        setSelectingLocationType(null);
      }
    } else if (searchType === 'destination') {
      // Check if destination is outside service area
      const destValidation = validateDestinationLocation(location.latitude, location.longitude);
      
      if (destValidation.additionalChargeExpected) {
        setPendingDestination(location);
        setDestinationWarning(destValidation);
        setShowSearchModal(false);
        setShowAreaWarningModal(true);
        return;
      }
      
      setDestinationLocation(location);
      setDestinationWarning(null);
      setSelectingLocationType(null);
    }

    setShowSearchModal(false);
    setSearchQuery('');
    setSearchResults([]);

    // Center map on selected location
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        ...location,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    }
  };

  const handleStartBooking = () => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to book a special trip.');
      return;
    }
    setBookingStatus(BOOKING_STATUS.SELECTING_LOCATIONS);
    setSelectingLocationType('pickup');
    
    // Set pickup to current location by default - allow anywhere
    if (userLocation) {
      setPickupLocation(userLocation);
    }
  };

  // Calculate route when both locations are set
  const calculateRoute = async () => {
    if (!pickupLocation || !destinationLocation) return;
    
    setIsCalculatingRoute(true);
    setRouteError(null);
    
    try {
      const result = await getRouteWithFare(
        pickupLocation,
        destinationLocation
      );
      
      if (result.success) {
        setRouteCoordinates(result.route.coordinates);
        setRouteInfo(result.route);
        setSuggestedFare(result.fare);
        // Pre-fill the suggested fare
        setPreferredFare(result.fare.suggestedFare.toString());
        
        if (result.route.isStraightLine) {
          setRouteError('Using estimated distance (routing service unavailable)');
        }
      } else {
        setRouteError(result.error || 'Failed to calculate route');
        // Fallback to straight line
        setRouteCoordinates([pickupLocation, destinationLocation]);
      }
    } catch (error) {
      console.error('Error calculating route:', error);
      setRouteError('Failed to calculate route');
      setRouteCoordinates([pickupLocation, destinationLocation]);
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  // Calculate route when locations change
  useEffect(() => {
    if (pickupLocation && destinationLocation) {
      calculateRoute();
    } else {
      setRouteCoordinates([]);
      setRouteInfo(null);
      setSuggestedFare(null);
    }
  }, [pickupLocation, destinationLocation]);

  const handleConfirmLocations = () => {
    if (!pickupLocation || !destinationLocation) {
      Alert.alert('Missing Location', 'Please set both pickup and destination locations.');
      return;
    }
    setBookingStatus(BOOKING_STATUS.SETTING_FARE);
  };

  const handleRequestBooking = () => {
    const fareAmount = parseFloat(preferredFare);
    if (isNaN(fareAmount) || fareAmount <= 0) {
      Alert.alert('Invalid Fare', 'Please enter a valid fare amount.');
      return;
    }

    dispatch(createBooking({
      userId: user._id,
      pickup: pickupLocation,
      destination: destinationLocation,
      preferredFare: fareAmount,
      userLocation,
    }, db));
  };

  const handleAcceptOffer = () => {
    if (currentBooking) {
      // For backward compatibility with single offer
      dispatch(respondToOffer({
        bookingId: currentBooking._id,
        accepted: true,
        db,
      }));
    }
  };

  // Accept a specific offer from multiple offers
  const handleAcceptSpecificOffer = (offer) => {
    if (currentBooking && offer) {
      Alert.alert(
        'Accept Offer',
        `Accept ₱${offer.amount} from ${offer.driver?.firstname || 'Driver'}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Accept',
            onPress: () => {
              dispatch(respondToOffer({
                bookingId: currentBooking._id,
                accepted: true,
                offerId: offer._id,
                db,
              }));
              setShowOffersModal(false);
              setSelectedOffer(null);
            },
          },
        ]
      );
    }
  };

  // Decline a specific offer
  const handleDeclineSpecificOffer = (offer) => {
    if (currentBooking && offer) {
      Alert.alert(
        'Decline Offer',
        `Decline offer from ${offer.driver?.firstname || 'Driver'}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Decline',
            style: 'destructive',
            onPress: () => {
              // Optimistically update local state to remove declined offer
              const remainingOffers = driverOffers.filter(o => o._id !== offer._id);
              setDriverOffers(remainingOffers);
              
              // If no more offers, close the modal
              if (remainingOffers.length === 0) {
                setShowOffersModal(false);
              }
              
              // Dispatch the decline action to server
              dispatch(respondToOffer({
                bookingId: currentBooking._id,
                accepted: false,
                offerId: offer._id,
                db,
              }));
            },
          },
        ]
      );
    }
  };

  const handleDeclineOffer = () => {
    if (currentBooking) {
      dispatch(respondToOffer({
        bookingId: currentBooking._id,
        accepted: false,
        db,
      }));
      // Go back to setting fare
      setBookingStatus(BOOKING_STATUS.SETTING_FARE);
    }
  };

  const handleSubmitRating = async () => {
    if (selectedRating === 0) {
      Alert.alert('Rating Required', 'Please select a rating before submitting.');
      return;
    }

    if (!currentBooking) {
      Alert.alert('Error', 'No active booking found.');
      setShowRatingModal(false);
      return;
    }

    // Handle both cases: driver as object or driver as string ID
    const driverId = typeof currentBooking.driver === 'object' 
      ? currentBooking.driver?._id 
      : currentBooking.driver;
    
    if (!driverId) {
      Alert.alert('Error', 'Unable to find driver information for rating.');
      setShowRatingModal(false);
      resetBooking();
      return;
    }

    // Store booking ID before potentially losing the reference
    const bookingId = currentBooking._id;

    try {
      const result = await dispatch(rateDriver({
        bookingId: bookingId,
        driverId: driverId,
        rating: selectedRating,
        comment: ratingComment,
        db,
      }));
      
      console.log('Rating submitted successfully:', result);
      
      setShowRatingModal(false);
      resetBooking();
      
      Alert.alert(
        'Thank You!', 
        'Your rating has been submitted successfully.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Rating submission error:', error);
      
      setShowRatingModal(false);
      resetBooking();
      
      Alert.alert(
        'Rating Error', 
        error?.message || error?.response?.data?.message || 'Failed to submit rating. Please try again.'
      );
    }
  };

  const handleCancelBooking = () => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          onPress: () => {
            if (currentBooking) {
              dispatch(cancelBooking({ bookingId: currentBooking._id, db }));
            }
            resetBooking();
          },
        },
      ]
    );
  };

  const resetBooking = () => {
    setBookingStatus(BOOKING_STATUS.IDLE);
    setPickupLocation(null);
    setDestinationLocation(null);
    setSelectingLocationType(null);
    setPreferredFare('');
    setOfferedFare(null);
    setSelectedRating(0);
    setRatingComment('');
    setDistanceToDestination(null);
    setCancellationDetails(null);
    setReportReason('');
    setDisputeReason('');
    setShowCompletionModal(false);
    // Reset cancellation rating states
    setCancellationRating(0);
    setCancellationRatingComment('');
    // Reset multi-offer states
    setDriverOffers([]);
    setShowOffersModal(false);
    setSelectedOffer(null);
    // Reset WEBTODA area warning states
    setDestinationWarning(null);
    setShowAreaWarningModal(false);
    setPendingDestination(null);
    // Reset route calculation states
    setRouteCoordinates([]);
    setRouteInfo(null);
    setSuggestedFare(null);
    setRouteError(null);
    dispatch(resetBookingState());
    
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }
  };

  // Handle trip completion confirmation
  const handleConfirmCompletion = async () => {
    if (!currentBooking) return;

    setIsConfirming(true);
    try {
      const token = await getToken(db);
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await axios.post(
        `${API_URL}/${currentBooking._id}/confirm-completion`,
        { confirmed: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setShowCompletionModal(false);
        
        // Update the local booking state with the completed booking
        // This preserves the driver info for rating
        if (response.data.booking) {
          dispatch(updateBookingStatus(response.data.booking));
        }
        
        // Show rating modal directly
        setBookingStatus(BOOKING_STATUS.TRIP_COMPLETED);
        setShowRatingModal(true);
        
        Alert.alert('Trip Confirmed', 'Thank you for confirming! Please rate your driver.');
      }
    } catch (error) {
      console.error('Error confirming completion:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to confirm completion');
    } finally {
      setIsConfirming(false);
    }
  };

  // Handle trip completion dispute
  const handleDisputeCompletion = async () => {
    if (!currentBooking) return;
    
    if (!disputeReason.trim()) {
      Alert.alert('Reason Required', 'Please provide a reason for disputing the completion.');
      return;
    }

    setIsConfirming(true);
    try {
      const token = await getToken(db);
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await axios.post(
        `${API_URL}/${currentBooking._id}/confirm-completion`,
        { confirmed: false, disputeReason: disputeReason.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setShowCompletionModal(false);
        setDisputeReason('');
        Alert.alert(
          'Dispute Submitted',
          'Your dispute has been submitted and will be reviewed by our team.',
          [{ text: 'OK', onPress: resetBooking }]
        );
      }
    } catch (error) {
      console.error('Error disputing completion:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to submit dispute');
    } finally {
      setIsConfirming(false);
    }
  };

  // Handle cancellation report submission
  const handleSubmitCancellationReport = async () => {
    if (!reportReason.trim()) {
      Alert.alert('Report Required', 'Please provide a reason for your report.');
      return;
    }

    setIsReporting(true);
    try {
      const token = await getToken(db);
      if (!token) {
        throw new Error('No authentication token');
      }

      await axios.post(
        `${API_URL}/${cancellationDetails.bookingId}/report`,
        {
          reason: reportReason.trim(),
          reportType: 'driver_cancelled',
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      Alert.alert(
        'Report Submitted',
        'Thank you for your feedback. We will review this incident.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert(
        'Report Failed',
        'Unable to submit your report. Please try again later.'
      );
    } finally {
      setIsReporting(false);
      setShowCancellationModal(false);
      resetBooking();
    }
  };

  // Dismiss cancellation modal without reporting
  const handleDismissCancellation = () => {
    setShowCancellationModal(false);
    setCancellationRating(0);
    setCancellationRatingComment('');
    resetBooking();
  };

  // Submit rating for cancelled trip
  const handleSubmitCancellationRating = async () => {
    if (cancellationRating === 0 || !cancellationDetails?.driverId) {
      handleDismissCancellation();
      return;
    }

    try {
      setIsSubmittingCancellationRating(true);
      const token = await getToken(db);
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      const response = await axios.post(
        `${API_URL}/${cancellationDetails.bookingId}/rate`,
        {
          driverId: cancellationDetails.driverId,
          rating: cancellationRating,
          comment: cancellationRatingComment || 'Trip cancelled by driver',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        Alert.alert('Thank You', 'Your rating has been submitted.');
      }
    } catch (error) {
      console.error('Error submitting cancellation rating:', error);
      // Still dismiss even if rating fails
    } finally {
      setIsSubmittingCancellationRating(false);
      setShowCancellationModal(false);
      setCancellationRating(0);
      setCancellationRatingComment('');
      resetBooking();
    }
  };

  // ==================== HISTORY FUNCTIONS ====================

  const fetchTripHistory = async () => {
    try {
      setLoadingHistory(true);
      const token = await getToken(db);
      if (!token) return;

      const response = await axios.get(
        `${API_URL}/user?status=completed,cancelled`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setTripHistory(response.data.bookings || []);
      }
    } catch (err) {
      console.error('Error fetching trip history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const openHistoryModal = async () => {
    setShowHistoryModal(true);
    await fetchTripHistory();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const renderHistoryItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.historyItem}
      onPress={() => {
        setShowHistoryModal(false);
        navigation.navigate('BookingHistoryDetail', { bookingId: item._id, isDriver: false });
      }}
      activeOpacity={0.7}
    >
      <View style={styles.historyHeader}>
        <Text style={styles.historyDriver}>
          {item.driver?.firstname || 'Driver'} {item.driver?.lastname || ''}
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

  const centerOnUser = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateCamera({
        center: userLocation,
        zoom: 16,
      }, { duration: 500 });
    }
  };

  // Show loading while checking authentication
  if (checkingAuth) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.authContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.authText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show login prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.authContainer}>
          <Ionicons name="lock-closed-outline" size={80} color={colors.primary} />
          <Text style={styles.authTitle}>Login Required</Text>
          <Text style={styles.authText}>
            Please log in to access the Booking feature
          </Text>
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Render offline notice
  if (!isOnline || !hasPermission) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.offlineContainer}>
          <Ionicons name="cloud-offline-outline" size={80} color={colors.orangeShade5} />
          <Text style={styles.offlineTitle}>You are Offline</Text>
          <Text style={styles.offlineText}>
            {!hasPermission 
              ? 'Location permission is required to use booking features.'
              : 'Unable to connect to location services. Please check your internet connection.'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={requestPermissions}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Ionicons name="bicycle-outline" size={24} color={colors.primary} />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Special Trip Booking</Text>
            <Text style={styles.headerSubtitle}>
              {bookingStatus === BOOKING_STATUS.IDLE && 'Request a special trip'}
              {bookingStatus === BOOKING_STATUS.SELECTING_LOCATIONS && 'Select locations'}
              {bookingStatus === BOOKING_STATUS.SETTING_FARE && 'Set your fare'}
              {bookingStatus === BOOKING_STATUS.WAITING_FOR_DRIVER && 'Finding drivers...'}
              {bookingStatus === BOOKING_STATUS.OFFERS_RECEIVED && `${driverOffers.length} driver offer${driverOffers.length > 1 ? 's' : ''} available`}
              {bookingStatus === BOOKING_STATUS.OFFER_RECEIVED && 'Driver offer received'}
              {bookingStatus === BOOKING_STATUS.TRIP_ACTIVE && 'Trip in progress'}
              {bookingStatus === BOOKING_STATUS.TRIP_COMPLETED && 'Trip completed'}
            </Text>
          </View>
        </View>
        
        {/* History and status */}
        <View style={styles.headerRight}>
          {/* Offers badge button - only show when offers are available */}
          {driverOffers.length > 0 && bookingStatus === BOOKING_STATUS.OFFERS_RECEIVED && (
            <TouchableOpacity 
              style={styles.offersHeaderButton} 
              onPress={() => setShowOffersModal(true)}
            >
              <View style={styles.offersHeaderBadge}>
                <Text style={styles.offersHeaderBadgeText}>{driverOffers.length}</Text>
              </View>
              <Ionicons name="car-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.historyButton} onPress={openHistoryModal}>
            <Ionicons name="time-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
          <View style={styles.statusBadge}>
            <View style={[
              styles.statusDot,
              { backgroundColor: bookingStatus === BOOKING_STATUS.TRIP_ACTIVE ? '#28a745' : colors.primary }
            ]} />
          </View>
        </View>
      </View>

      {/* Map - only render when tab is focused to prevent multiple MapView crashes */}
      {isFocused ? (
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
          style={styles.map}
          region={region}
          onRegionChangeComplete={setRegion}
          onPress={handleMapPress}
          showsUserLocation={true}
          showsMyLocationButton={false}
        >
        {/* WEBTODA Service Area Polygon Boundary */}
        <Polygon
          coordinates={getServiceAreaPolygon()}
          strokeColor="rgba(255,140,0,0.6)"
          fillColor="rgba(255,140,0,0.08)"
          strokeWidth={2}
        />

        {/* WEBTODA GPX Route - Main service route reference */}
        {WEBTODA_ROUTE_COORDINATES.length > 1 && (
          <Polyline
            coordinates={WEBTODA_ROUTE_COORDINATES}
            strokeColor={colors.primary}
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {/* Route buffer visualization (150m pickup zone) */}
        {bookingStatus === BOOKING_STATUS.SELECTING_LOCATIONS && selectingLocationType === 'pickup' && (
          WEBTODA_ROUTE_COORDINATES.filter((_, index) => index % 5 === 0).map((coord, index) => (
            <Circle
              key={`buffer-${index}`}
              center={coord}
              radius={WEBTODA_SERVICE_AREA.maxPickupDistance}
              strokeColor="rgba(40,167,69,0.2)"
              fillColor="rgba(40,167,69,0.05)"
              strokeWidth={1}
            />
          ))
        )}

        {/* Pickup marker */}
        {pickupLocation && (
          <Marker
            coordinate={pickupLocation}
            title="Pickup Location"
            draggable={bookingStatus === BOOKING_STATUS.SELECTING_LOCATIONS}
            onDragEnd={(e) => {
              const { latitude, longitude } = e.nativeEvent.coordinate;
              // Allow dragging pickup marker anywhere - no area restriction
              setPickupLocation({ latitude, longitude });
            }}
          >
            <View style={styles.pickupMarker}>
              <Ionicons name="locate" size={20} color="#fff" />
            </View>
          </Marker>
        )}

        {/* Destination marker */}
        {destinationLocation && (
          <Marker
            coordinate={destinationLocation}
            title={destinationWarning ? "Destination (Outside Area)" : "Destination"}
            draggable={bookingStatus === BOOKING_STATUS.SELECTING_LOCATIONS}
            onDragEnd={(e) => {
              const { latitude, longitude } = e.nativeEvent.coordinate;
              const validation = validateDestinationLocation(latitude, longitude);
              if (validation.additionalChargeExpected) {
                setDestinationWarning(validation);
              } else {
                setDestinationWarning(null);
              }
              setDestinationLocation({ latitude, longitude });
            }}
          >
            <View style={[
              styles.destinationMarker,
              destinationWarning && styles.destinationMarkerWarning
            ]}>
              <Ionicons 
                name={destinationWarning ? "warning" : "flag"} 
                size={20} 
                color="#fff" 
              />
            </View>
          </Marker>
        )}

        {/* Route line from pickup to destination - Uses actual road route */}
        {pickupLocation && destinationLocation && routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={destinationWarning ? '#dc3545' : '#2196F3'}
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        )}
        
        {/* Loading route indicator - shows straight dashed line while calculating */}
        {pickupLocation && destinationLocation && isCalculatingRoute && (
          <Polyline
            coordinates={[pickupLocation, destinationLocation]}
            strokeColor={colors.orangeShade4}
            strokeWidth={2}
            lineDashPattern={[10, 5]}
          />
        )}

        {/* Destination completion radius */}
        {destinationLocation && bookingStatus === BOOKING_STATUS.TRIP_ACTIVE && (
          <Circle
            center={destinationLocation}
            radius={COMPLETION_RADIUS_METERS}
            strokeColor="rgba(40,167,69,0.6)"
            fillColor="rgba(40,167,69,0.15)"
          />
        )}
      </MapView>
      ) : (
        <View style={[styles.map, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {/* Location selection hint */}
      {selectingLocationType && (
        <View style={[
          styles.selectionHint,
          selectingLocationType === 'pickup' && styles.selectionHintPickup
        ]}>
          <Ionicons 
            name={selectingLocationType === 'pickup' ? "navigate-circle-outline" : "flag-outline"} 
            size={20} 
            color="#fff" 
          />
          <Text style={styles.selectionHintText}>
            {selectingLocationType === 'pickup' 
              ? 'Tap within the WEBTODA route (orange line) to set pickup'
              : 'Tap anywhere to set destination (charges may apply outside area)'}
          </Text>
        </View>
      )}

      {/* WEBTODA Route Legend */}
      {bookingStatus === BOOKING_STATUS.SELECTING_LOCATIONS && (
        <View style={styles.routeLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendLine, { backgroundColor: colors.primary }]} />
            <Text style={styles.legendText}>WEBTODA Route</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: 'rgba(255,140,0,0.6)' }]} />
            <Text style={styles.legendText}>Service Area</Text>
          </View>
        </View>
      )}

      {/* Map Controls */}
      <View style={styles.mapControls}>
        <TouchableOpacity style={styles.controlButton} onPress={centerOnUser}>
          <Ionicons name="locate-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Bottom Panel */}
      <View style={styles.bottomPanel}>
        {/* IDLE State - Start Booking */}
        {bookingStatus === BOOKING_STATUS.IDLE && (
          <View style={styles.panelContent}>
            <Text style={styles.panelTitle}>Book a Special Trip</Text>
            <Text style={styles.panelDescription}>
              Request a private tricycle trip within the WEBTODA service area (shown on map). 
              Pickup must be along the route. Additional charges apply for destinations outside the area.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleStartBooking}
            >
              <Ionicons name="add-circle-outline" size={22} color="#fff" />
              <Text style={styles.primaryButtonText}>Request Special Trip</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* SELECTING_LOCATIONS State */}
        {bookingStatus === BOOKING_STATUS.SELECTING_LOCATIONS && (
          <View style={styles.panelContent}>
            <Text style={styles.panelTitle}>Set Trip Locations</Text>
            
            {/* Pickup Location */}
            <View style={styles.locationRow}>
              <TouchableOpacity
                style={[
                  styles.locationButton,
                  styles.locationButtonFlex,
                  selectingLocationType === 'pickup' && styles.locationButtonActive,
                  pickupLocation && styles.locationButtonSet,
                ]}
                onPress={() => setSelectingLocationType('pickup')}
              >
                <View style={[styles.locationIcon, { backgroundColor: '#28a745' }]}>
                  <Ionicons name="locate" size={16} color="#fff" />
                </View>
                <View style={styles.locationInfo}>
                  <Text style={styles.locationLabel}>Pickup Location</Text>
                  <Text style={styles.locationValue}>
                    {pickupLocation 
                      ? 'Location set ✓' 
                      : 'Tap map or search'}
                  </Text>
                </View>
                {pickupLocation && (
                  <Ionicons name="checkmark-circle" size={20} color="#28a745" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.searchLocationButton}
                onPress={() => openLocationSearch('pickup')}
              >
                <Ionicons name="search" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Destination Location */}
            <View style={styles.locationRow}>
              <TouchableOpacity
                style={[
                  styles.locationButton,
                  styles.locationButtonFlex,
                  selectingLocationType === 'destination' && styles.locationButtonActive,
                  destinationLocation && styles.locationButtonSet,
                  destinationWarning && styles.locationButtonWarning,
                ]}
                onPress={() => setSelectingLocationType('destination')}
              >
                <View style={[
                  styles.locationIcon, 
                  { backgroundColor: destinationWarning ? '#dc3545' : colors.primary }
                ]}>
                  <Ionicons 
                    name={destinationWarning ? "warning" : "flag"} 
                    size={16} 
                    color="#fff" 
                  />
                </View>
                <View style={styles.locationInfo}>
                  <Text style={styles.locationLabel}>Destination</Text>
                  <Text style={[
                    styles.locationValue,
                    destinationWarning && styles.locationValueWarning
                  ]}>
                    {destinationLocation 
                      ? (destinationWarning 
                          ? 'Outside area - Extra charges' 
                          : 'Location set ✓')
                      : 'Tap map or search'}
                  </Text>
                </View>
                {destinationLocation && !destinationWarning && (
                  <Ionicons name="checkmark-circle" size={20} color="#28a745" />
                )}
                {destinationWarning && (
                  <Ionicons name="alert-circle" size={20} color="#dc3545" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.searchLocationButton,
                  destinationWarning && styles.searchLocationButtonWarning
                ]}
                onPress={() => openLocationSearch('destination')}
              >
                <Ionicons name="search" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Warning banner if destination is outside area */}
            {destinationWarning && (
              <View style={styles.areaWarningBanner}>
                <Ionicons name="information-circle" size={18} color="#856404" />
                <Text style={styles.areaWarningText}>
                  Destination is {Math.round(destinationWarning.distance)}m outside WEBTODA area. 
                  Additional charges expected.
                </Text>
              </View>
            )}

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={resetBooking}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  styles.buttonFlex,
                  (!pickupLocation || !destinationLocation) && styles.buttonDisabled,
                ]}
                onPress={handleConfirmLocations}
                disabled={!pickupLocation || !destinationLocation}
              >
                <Text style={styles.primaryButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* SETTING_FARE State */}
        {bookingStatus === BOOKING_STATUS.SETTING_FARE && (
          <View style={styles.panelContent}>
            <Text style={styles.panelTitle}>Set Your Fare</Text>
            
            {/* Route Info Display */}
            {routeInfo && suggestedFare && (
              <View style={styles.routeInfoContainer}>
                <View style={styles.routeInfoRow}>
                  <View style={styles.routeInfoItem}>
                    <Ionicons name="navigate-outline" size={18} color={colors.primary} />
                    <Text style={styles.routeInfoLabel}>Distance</Text>
                    <Text style={styles.routeInfoValue}>{formatDistance(routeInfo.distanceMeters)}</Text>
                  </View>
                  <View style={styles.routeInfoDivider} />
                  <View style={styles.routeInfoItem}>
                    <Ionicons name="time-outline" size={18} color={colors.primary} />
                    <Text style={styles.routeInfoLabel}>Est. Time</Text>
                    <Text style={styles.routeInfoValue}>{formatDuration(routeInfo.durationMinutes)}</Text>
                  </View>
                </View>
                
                {/* Fare Breakdown */}
                <View style={styles.fareBreakdownContainer}>
                  <Text style={styles.fareBreakdownTitle}>Suggested Fare Breakdown</Text>
                  {suggestedFare.breakdown.map((item, index) => (
                    <View key={index} style={styles.fareBreakdownRow}>
                      <Text style={styles.fareBreakdownLabel}>{item.label}</Text>
                      <Text style={styles.fareBreakdownAmount}>₱{item.amount}</Text>
                    </View>
                  ))}
                  <View style={styles.fareBreakdownTotal}>
                    <Text style={styles.fareBreakdownTotalLabel}>Suggested Fare</Text>
                    <Text style={styles.fareBreakdownTotalAmount}>₱{suggestedFare.suggestedFare}</Text>
                  </View>
                </View>
                
                {routeError && (
                  <View style={styles.routeWarningBanner}>
                    <Ionicons name="information-circle-outline" size={16} color="#856404" />
                    <Text style={styles.routeWarningText}>{routeError}</Text>
                  </View>
                )}
              </View>
            )}
            
            {isCalculatingRoute && (
              <View style={styles.calculatingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.calculatingText}>Calculating best route...</Text>
              </View>
            )}
            
            <Text style={styles.panelDescription}>
              You can adjust the fare below. Nearby drivers will be notified.
            </Text>
            
            <View style={styles.fareInputContainer}>
              <Text style={styles.currencySymbol}>₱</Text>
              <TextInput
                style={styles.fareInput}
                placeholder="Enter amount"
                placeholderTextColor={colors.orangeShade4}
                keyboardType="numeric"
                value={preferredFare}
                onChangeText={setPreferredFare}
              />
            </View>
            
            {suggestedFare && preferredFare && (
              <View style={styles.fareComparisonBanner}>
                {parseFloat(preferredFare) < suggestedFare.fareRange.min ? (
                  <View style={styles.fareLowWarning}>
                    <Ionicons name="warning-outline" size={16} color="#dc3545" />
                    <Text style={styles.fareLowText}>
                      Fare is below suggested minimum (₱{suggestedFare.fareRange.min})
                    </Text>
                  </View>
                ) : parseFloat(preferredFare) >= suggestedFare.fareRange.min && parseFloat(preferredFare) <= suggestedFare.fareRange.max ? (
                  <View style={styles.fareGoodBanner}>
                    <Ionicons name="checkmark-circle-outline" size={16} color="#28a745" />
                    <Text style={styles.fareGoodText}>
                      Fare is within suggested range
                    </Text>
                  </View>
                ) : null}
              </View>
            )}

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setBookingStatus(BOOKING_STATUS.SELECTING_LOCATIONS)}
              >
                <Text style={styles.secondaryButtonText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  styles.buttonFlex,
                  loading && styles.buttonDisabled,
                ]}
                onPress={handleRequestBooking}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send-outline" size={20} color="#fff" />
                    <Text style={styles.primaryButtonText}>Request Trip</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* WAITING_FOR_DRIVER State */}
        {bookingStatus === BOOKING_STATUS.WAITING_FOR_DRIVER && (
          <View style={styles.panelContent}>
            <View style={styles.waitingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.waitingTitle}>Finding Nearby Drivers</Text>
              <Text style={styles.waitingText}>
                Notifying active drivers in your area...
              </Text>
              <Text style={styles.fareDisplay}>
                Your offer: ₱{currentBooking?.preferredFare || preferredFare}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelBooking}
            >
              <Text style={styles.cancelButtonText}>Cancel Request</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* OFFERS_RECEIVED State - Multiple driver offers */}
        {bookingStatus === BOOKING_STATUS.OFFERS_RECEIVED && (
          <View style={styles.panelContent}>
            <View style={styles.offersHeader}>
              <View style={styles.offersBadgeContainer}>
                <View style={styles.offersBadge}>
                  <Text style={styles.offersBadgeText}>{driverOffers.length}</Text>
                </View>
                <Text style={styles.panelTitle}>
                  Driver{driverOffers.length > 1 ? 's' : ''} Interested!
                </Text>
              </View>
              <Text style={styles.panelDescription}>
                {driverOffers.length > 1 
                  ? 'Multiple drivers have made offers. Compare and choose the best one!'
                  : 'A driver has made an offer for your trip'}
              </Text>
            </View>
            
            <View style={styles.yourFareContainer}>
              <Text style={styles.yourFareLabel}>Your requested fare:</Text>
              <Text style={styles.yourFareAmount}>₱{currentBooking?.preferredFare || preferredFare}</Text>
            </View>

            {/* Preview of first offer in panel */}
            {driverOffers.length > 0 && (
              <View style={styles.offerPreview}>
                <View style={styles.offerPreviewInfo}>
                  <View style={styles.driverAvatarSmall}>
                    <Ionicons name="person" size={20} color="#fff" />
                  </View>
                  <View style={styles.offerDriverDetails}>
                    <Text style={styles.offerDriverName}>
                      {driverOffers[0].driver?.firstname || 'Driver'} {driverOffers[0].driver?.lastname || ''}
                    </Text>
                    <View style={styles.ratingDisplaySmall}>
                      <Ionicons name="star" size={12} color={colors.starYellow} />
                      <Text style={styles.ratingTextSmall}>
                        {driverOffers[0].driver?.rating?.toFixed(1) || 'N/A'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[
                    styles.offerPreviewAmount,
                    driverOffers[0].amount <= (currentBooking?.preferredFare || 0) && styles.offerAmountGood
                  ]}>
                    ₱{driverOffers[0].amount}
                  </Text>
                </View>
                {driverOffers.length > 1 && (
                  <Text style={styles.moreOffersText}>
                    +{driverOffers.length - 1} more offer{driverOffers.length > 2 ? 's' : ''} available
                  </Text>
                )}
              </View>
            )}

            <TouchableOpacity
              style={styles.viewAllOffersButton}
              onPress={() => setShowOffersModal(true)}
            >
              <Ionicons name="list-outline" size={20} color="#fff" />
              <Text style={styles.viewAllOffersText}>
                {driverOffers.length > 1 ? 'View All Offers' : 'View Offer Details'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelBooking}
            >
              <Text style={styles.cancelButtonText}>Cancel Request</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* OFFER_RECEIVED State */}
        {bookingStatus === BOOKING_STATUS.OFFER_RECEIVED && (
          <View style={styles.panelContent}>
            <Text style={styles.panelTitle}>Driver Offer Received!</Text>
            
            {currentBooking?.driver && (
              <View style={styles.driverInfo}>
                <View style={styles.driverAvatar}>
                  <Ionicons name="person" size={24} color="#fff" />
                </View>
                <View style={styles.driverDetails}>
                  <Text style={styles.driverName}>
                    {currentBooking.driver.firstname} {currentBooking.driver.lastname}
                  </Text>
                  <View style={styles.ratingDisplay}>
                    <Ionicons name="star" size={14} color={colors.starYellow} />
                    <Text style={styles.ratingText}>
                      {currentBooking.driver.rating?.toFixed(1) || 'N/A'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.offerComparison}>
              <View style={styles.offerItem}>
                <Text style={styles.offerLabel}>Your Offer</Text>
                <Text style={styles.offerAmount}>₱{currentBooking?.preferredFare || preferredFare}</Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color={colors.orangeShade5} />
              <View style={styles.offerItem}>
                <Text style={styles.offerLabel}>Driver's Offer</Text>
                <Text style={[styles.offerAmount, styles.driverOfferAmount]}>
                  ₱{offeredFare}
                </Text>
              </View>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.declineButton}
                onPress={handleDeclineOffer}
              >
                <Ionicons name="close-outline" size={20} color="#dc3545" />
                <Text style={styles.declineButtonText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.acceptButton, styles.buttonFlex]}
                onPress={handleAcceptOffer}
              >
                <Ionicons name="checkmark-outline" size={20} color="#fff" />
                <Text style={styles.acceptButtonText}>Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* TRIP_ACTIVE State */}
        {bookingStatus === BOOKING_STATUS.TRIP_ACTIVE && (
          <View style={styles.panelContent}>
            <Text style={styles.panelTitle}>Trip in Progress</Text>
            
            {currentBooking?.driver && (
              <View style={styles.driverInfo}>
                <View style={styles.driverAvatar}>
                  <Ionicons name="person" size={24} color="#fff" />
                </View>
                <View style={styles.driverDetails}>
                  <Text style={styles.driverName}>
                    {currentBooking.driver.firstname} {currentBooking.driver.lastname}
                  </Text>
                  <Text style={styles.tripFare}>
                    Fare: ₱{currentBooking.agreedFare}
                  </Text>
                </View>
              </View>
            )}

            {distanceToDestination !== null && (
              <View style={styles.distanceInfo}>
                <Ionicons name="navigate-outline" size={20} color={colors.primary} />
                <Text style={styles.distanceText}>
                  {distanceToDestination < 1000
                    ? `${Math.round(distanceToDestination)}m to destination`
                    : `${(distanceToDestination / 1000).toFixed(1)}km to destination`}
                </Text>
              </View>
            )}

            <View style={styles.tripProgressInfo}>
              <Ionicons name="car-outline" size={20} color={colors.orangeShade5} />
              <Text style={styles.tripProgressText}>
                Enjoy your ride! The driver will mark the trip complete when you arrive.
              </Text>
            </View>
            
            <TouchableOpacity
              style={styles.cancelTripButton}
              onPress={handleCancelBooking}
            >
              <Ionicons name="close-circle-outline" size={20} color="#dc3545" />
              <Text style={styles.cancelTripButtonText}>Cancel Trip</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Completion Confirmation Modal */}
      <Modal
        visible={showCompletionModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.completionModal}>
            <View style={styles.completionHeader}>
              <Ionicons name="flag-outline" size={50} color={colors.primary} />
              <Text style={styles.completionTitle}>Trip Completed</Text>
              <Text style={styles.completionSubtitle}>
                Your driver has marked the trip as complete
              </Text>
            </View>

            {currentBooking?.driver && (
              <View style={styles.completionDriverInfo}>
                <View style={styles.driverAvatar}>
                  <Ionicons name="person" size={24} color="#fff" />
                </View>
                <View style={styles.driverDetails}>
                  <Text style={styles.driverName}>
                    {currentBooking.driver.firstname} {currentBooking.driver.lastname}
                  </Text>
                  <Text style={styles.fareInfo}>
                    Fare: ₱{currentBooking.agreedFare || currentBooking.preferredFare}
                  </Text>
                </View>
              </View>
            )}

            <Text style={styles.completionQuestion}>
              Have you arrived at your destination?
            </Text>

            <View style={styles.completionActions}>
              <TouchableOpacity
                style={[styles.confirmButton, isConfirming && styles.buttonDisabled]}
                onPress={handleConfirmCompletion}
                disabled={isConfirming}
              >
                {isConfirming ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.confirmButtonText}>Yes, Confirm</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.disputeToggleButton}
                onPress={() => {
                  if (disputeReason) {
                    setDisputeReason('');
                  } else {
                    setDisputeReason(' '); // Enable dispute input
                  }
                }}
              >
                <Ionicons name="alert-circle-outline" size={18} color="#dc3545" />
                <Text style={styles.disputeToggleText}>I have not arrived</Text>
              </TouchableOpacity>
            </View>

            {disputeReason !== '' && (
              <View style={styles.disputeSection}>
                <Text style={styles.disputeLabel}>Please describe the issue:</Text>
                <TextInput
                  style={styles.disputeInput}
                  placeholder="e.g., Driver dropped me off at wrong location"
                  placeholderTextColor={colors.orangeShade4}
                  multiline
                  numberOfLines={3}
                  value={disputeReason.trim() ? disputeReason : ''}
                  onChangeText={setDisputeReason}
                />
                <TouchableOpacity
                  style={[styles.submitDisputeButton, isConfirming && styles.buttonDisabled]}
                  onPress={handleDisputeCompletion}
                  disabled={isConfirming || !disputeReason.trim()}
                >
                  {isConfirming ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitDisputeText}>Submit Dispute</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Location Search Modal */}
      <Modal
        visible={showSearchModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowSearchModal(false)}
      >
        <SafeAreaView style={styles.searchModalContainer} edges={['top']}>
          <View style={styles.searchModalHeader}>
            <TouchableOpacity 
              style={styles.searchBackButton}
              onPress={() => {
                setShowSearchModal(false);
                setSearchQuery('');
                setSearchResults([]);
              }}
            >
              <Ionicons name="arrow-back" size={24} color={colors.orangeShade5} />
            </TouchableOpacity>
            <Text style={styles.searchModalTitle}>
              {searchType === 'pickup' ? 'Search Pickup Location' : 'Search Destination'}
            </Text>
          </View>

          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color={colors.orangeShade4} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={searchType === 'pickup' ? 'Enter pickup address...' : 'Enter destination address...'}
              placeholderTextColor={colors.orangeShade4}
              value={searchQuery}
              onChangeText={handleSearchQueryChange}
              autoFocus={true}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                style={styles.clearSearchButton}
              >
                <Ionicons name="close-circle" size={20} color={colors.orangeShade4} />
              </TouchableOpacity>
            )}
          </View>

          {isSearching ? (
            <View style={styles.searchLoadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.searchLoadingText}>Searching...</Text>
            </View>
          ) : searchResults.length > 0 ? (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.searchResultItem}
                  onPress={() => handleSelectSearchResult(item)}
                >
                  <View style={styles.searchResultIcon}>
                    <Ionicons 
                      name={item.type === 'house' ? 'home' : 'location'} 
                      size={20} 
                      color={colors.primary} 
                    />
                  </View>
                  <View style={styles.searchResultInfo}>
                    <Text style={styles.searchResultName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.searchResultAddress} numberOfLines={2}>
                      {item.address}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.searchResultsList}
              showsVerticalScrollIndicator={false}
            />
          ) : searchQuery.length >= 3 ? (
            <View style={styles.noResultsContainer}>
              <Ionicons name="search-outline" size={50} color={colors.orangeShade4} />
              <Text style={styles.noResultsText}>No locations found</Text>
              <Text style={styles.noResultsSubtext}>Try a different search term</Text>
            </View>
          ) : (
            <View style={styles.searchHintContainer}>
              <Ionicons name="location-outline" size={50} color={colors.orangeShade4} />
              <Text style={styles.searchHintText}>Search for a location</Text>
              <Text style={styles.searchHintSubtext}>
                Enter at least 3 characters to search
              </Text>
              
              {/* Quick suggestions */}
              <View style={styles.quickSuggestions}>
                <Text style={styles.quickSuggestionsTitle}>Popular Areas</Text>
                {['Calamba City', 'Crossing Calamba', 'Real Calamba', 'Parian Calamba'].map((place, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.quickSuggestionItem}
                    onPress={() => {
                      setSearchQuery(place);
                      searchLocation(place);
                    }}
                  >
                    <Ionicons name="trending-up" size={16} color={colors.orangeShade4} />
                    <Text style={styles.quickSuggestionText}>{place}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* Rating Modal */}
      <Modal
        visible={showRatingModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.ratingModal}>
            <Text style={styles.ratingModalTitle}>Rate Your Driver</Text>
            <Text style={styles.ratingModalSubtitle}>
              How was your trip experience?
            </Text>

            {/* Star Rating */}
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setSelectedRating(star)}
                  style={styles.starButton}
                >
                  <Ionicons
                    name={star <= selectedRating ? 'star' : 'star-outline'}
                    size={40}
                    color={star <= selectedRating ? colors.starYellow : colors.orangeShade4}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Comment Input */}
            <TextInput
              style={styles.commentInput}
              placeholder="Add a comment (optional)"
              placeholderTextColor={colors.orangeShade4}
              multiline
              numberOfLines={3}
              value={ratingComment}
              onChangeText={setRatingComment}
            />

            <TouchableOpacity
              style={[
                styles.submitRatingButton,
                selectedRating === 0 && styles.buttonDisabled,
              ]}
              onPress={handleSubmitRating}
              disabled={selectedRating === 0}
            >
              <Text style={styles.submitRatingText}>Submit Rating</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* History Modal */}
      <Modal
        visible={showHistoryModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <SafeAreaView style={styles.historyModalContainer} edges={['top', 'bottom']}>
          <View style={styles.historyModalHeader}>
            <Text style={styles.historyModalTitle}>Trip History</Text>
            <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {loadingHistory ? (
            <View style={styles.historyLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.historyLoadingText}>Loading history...</Text>
            </View>
          ) : tripHistory.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Ionicons name="document-text-outline" size={50} color="#ccc" />
              <Text style={styles.emptyHistoryText}>No trip history yet</Text>
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

      {/* Cancellation Report Modal */}
      <Modal
        visible={showCancellationModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleDismissCancellation}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.cancellationScrollContent}>
            <View style={styles.cancellationModal}>
              <View style={styles.cancellationHeader}>
                <Ionicons name="close-circle" size={50} color="#dc3545" />
                <Text style={styles.cancellationTitle}>Booking Cancelled</Text>
                <Text style={styles.cancellationSubtitle}>
                  Your booking was cancelled by the driver
                </Text>
              </View>

              {cancellationDetails && (
                <View style={styles.cancellationDetails}>
                  <View style={styles.cancellationDetailRow}>
                    <Ionicons name="person-outline" size={18} color={colors.orangeShade5} />
                    <Text style={styles.cancellationDetailLabel}>Driver:</Text>
                    <Text style={styles.cancellationDetailValue}>
                      {cancellationDetails.driverName}
                    </Text>
                  </View>
                  <View style={styles.cancellationDetailRow}>
                    <Ionicons name="chatbubble-outline" size={18} color={colors.orangeShade5} />
                    <Text style={styles.cancellationDetailLabel}>Reason:</Text>
                    <Text style={styles.cancellationDetailValue}>
                      {cancellationDetails.reason}
                    </Text>
                  </View>
                </View>
              )}

              {/* Rating Section for Cancelled Trip */}
              {cancellationDetails?.driverId && (
                <View style={styles.cancellationRatingSection}>
                  <Text style={styles.cancellationRatingSectionTitle}>
                    Rate this driver
                  </Text>
                  <Text style={styles.cancellationRatingSubtitle}>
                    Your feedback helps improve service quality
                  </Text>
                  <View style={styles.cancellationStarsContainer}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity
                        key={star}
                        onPress={() => setCancellationRating(star)}
                        style={styles.starButton}
                      >
                        <Ionicons
                          name={star <= cancellationRating ? 'star' : 'star-outline'}
                          size={32}
                          color={star <= cancellationRating ? colors.starYellow : colors.orangeShade4}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                  {cancellationRating > 0 && (
                    <TextInput
                      style={styles.cancellationRatingInput}
                      placeholder="Add a comment about your experience (optional)"
                      placeholderTextColor={colors.orangeShade4}
                      multiline
                      numberOfLines={2}
                      value={cancellationRatingComment}
                      onChangeText={setCancellationRatingComment}
                    />
                  )}
                </View>
              )}

              <View style={styles.reportSection}>
                <Text style={styles.reportSectionTitle}>
                  Was there an issue? Report this incident
                </Text>
                <TextInput
                  style={styles.reportInput}
                  placeholder="Describe the issue (optional)"
                  placeholderTextColor={colors.orangeShade4}
                  multiline
                  numberOfLines={3}
                  value={reportReason}
                  onChangeText={setReportReason}
                />
              </View>

              <View style={styles.cancellationButtons}>
                <TouchableOpacity
                  style={styles.dismissButton}
                  onPress={handleDismissCancellation}
                >
                  <Text style={styles.dismissButtonText}>Dismiss</Text>
                </TouchableOpacity>
                
                {reportReason.trim() ? (
                  <TouchableOpacity
                    style={[
                      styles.reportButton,
                      isReporting && styles.buttonDisabled,
                    ]}
                    onPress={handleSubmitCancellationReport}
                    disabled={isReporting}
                  >
                    {isReporting ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="flag-outline" size={18} color="#fff" />
                        <Text style={styles.reportButtonText}>Submit Report</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.submitRatingBtn,
                      isSubmittingCancellationRating && styles.buttonDisabled,
                    ]}
                    onPress={handleSubmitCancellationRating}
                    disabled={isSubmittingCancellationRating}
                  >
                    {isSubmittingCancellationRating ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.submitRatingBtnText}>
                        {cancellationRating > 0 ? 'Submit Rating' : 'Done'}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* WEBTODA Area Warning Modal - Shown when destination is outside service area */}
      <Modal
        visible={showAreaWarningModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelOutsideDestination}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.areaWarningModal}>
            <View style={styles.areaWarningHeader}>
              <Ionicons name="warning" size={50} color="#f0ad4e" />
              <Text style={styles.areaWarningTitle}>Outside WEBTODA Area</Text>
              <Text style={styles.areaWarningSubtitle}>
                Your selected destination is beyond the regular WEBTODA service coverage.
              </Text>
            </View>

            {destinationWarning && (
              <View style={styles.areaWarningDetails}>
                <View style={styles.areaWarningDetailRow}>
                  <Ionicons name="navigate-outline" size={20} color={colors.orangeShade5} />
                  <Text style={styles.areaWarningDetailText}>
                    Distance from route: {Math.round(destinationWarning.distance)}m
                  </Text>
                </View>
                <View style={styles.areaWarningDetailRow}>
                  <Ionicons name="cash-outline" size={20} color="#dc3545" />
                  <Text style={[styles.areaWarningDetailText, { color: '#dc3545' }]}>
                    Additional charges expected
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.areaWarningInfo}>
              <Ionicons name="information-circle-outline" size={18} color="#856404" />
              <Text style={styles.areaWarningInfoText}>
                The orange highlighted route on the map shows the regular WEBTODA service area. 
                Destinations outside this area may incur additional fare based on distance.
              </Text>
            </View>

            <View style={styles.areaWarningButtons}>
              <TouchableOpacity
                style={styles.areaWarningCancelButton}
                onPress={handleCancelOutsideDestination}
              >
                <Text style={styles.areaWarningCancelText}>Choose Another Location</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.areaWarningConfirmButton}
                onPress={handleConfirmOutsideDestination}
              >
                <Text style={styles.areaWarningConfirmText}>Proceed Anyway</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Driver Offers Modal - Shows all available driver offers */}
      <Modal
        visible={showOffersModal && driverOffers.length > 0}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowOffersModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.offersModal}>
            <View style={styles.offersModalHeader}>
              <View style={styles.offersModalTitleRow}>
                <View style={styles.offersModalBadge}>
                  <Text style={styles.offersModalBadgeText}>{driverOffers.length}</Text>
                </View>
                <Text style={styles.offersModalTitle}>
                  Driver Offer{driverOffers.length > 1 ? 's' : ''} Available
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.offersModalCloseButton}
                onPress={() => setShowOffersModal(false)}
              >
                <Ionicons name="close" size={24} color={colors.orangeShade5} />
              </TouchableOpacity>
            </View>

            <View style={styles.offersModalYourFare}>
              <Text style={styles.offersModalYourFareLabel}>Your requested fare:</Text>
              <Text style={styles.offersModalYourFareAmount}>₱{currentBooking?.preferredFare || preferredFare}</Text>
            </View>

            {driverOffers.length > 1 && (
              <View style={styles.offersModalTip}>
                <Ionicons name="bulb-outline" size={16} color="#856404" />
                <Text style={styles.offersModalTipText}>
                  Compare offers below and choose the best one for your trip
                </Text>
              </View>
            )}

            <ScrollView 
              style={styles.offersModalScrollView}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.offersModalScrollContent}
            >
              {driverOffers.map((offer, index) => (
                <View key={offer._id || index} style={styles.offerCardModal}>
                  <View style={styles.offerCardHeader}>
                    <View style={styles.offerNumberBadge}>
                      <Text style={styles.offerNumberText}>#{index + 1}</Text>
                    </View>
                    <View style={[
                      styles.offerFareBadge,
                      offer.amount <= (currentBooking?.preferredFare || 0) && styles.offerFareBadgeGood,
                      offer.amount > (currentBooking?.preferredFare || 0) && styles.offerFareBadgeHigher
                    ]}>
                      <Text style={[
                        styles.offerFareBadgeText,
                        offer.amount <= (currentBooking?.preferredFare || 0) && styles.offerFareBadgeTextGood
                      ]}>
                        ₱{offer.amount}
                      </Text>
                      {offer.amount <= (currentBooking?.preferredFare || 0) ? (
                        <Ionicons name="checkmark-circle" size={14} color="#28a745" style={{marginLeft: 4}} />
                      ) : (
                        <Ionicons name="arrow-up" size={14} color="#dc3545" style={{marginLeft: 4}} />
                      )}
                    </View>
                  </View>
                  
                  <View style={styles.offerDriverInfoModal}>
                    <View style={styles.driverAvatarModal}>
                      <Ionicons name="person" size={28} color="#fff" />
                    </View>
                    <View style={styles.offerDriverDetailsModal}>
                      <Text style={styles.offerDriverNameModal}>
                        {offer.driver?.firstname || 'Driver'} {offer.driver?.lastname || ''}
                      </Text>
                      <View style={styles.ratingDisplayModal}>
                        <Ionicons name="star" size={14} color={colors.starYellow} />
                        <Text style={styles.ratingTextModal}>
                          {offer.driver?.rating?.toFixed(1) || 'N/A'}
                        </Text>
                        {offer.tricycle?.plateNumber && (
                          <>
                            <Text style={styles.dotSeparator}>•</Text>
                            <Ionicons name="car-outline" size={14} color={colors.orangeShade5} />
                            <Text style={styles.plateNumberModal}>
                              {offer.tricycle.plateNumber}
                            </Text>
                          </>
                        )}
                      </View>
                    </View>
                  </View>
                  
                  {offer.message ? (
                    <View style={styles.offerMessageContainerModal}>
                      <Ionicons name="chatbubble-outline" size={14} color={colors.orangeShade5} />
                      <Text style={styles.offerMessageModal}>
                        "{offer.message}"
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.offerFareComparison}>
                    {offer.amount < (currentBooking?.preferredFare || 0) && (
                      <Text style={styles.fareSavingsText}>
                        Save ₱{(currentBooking?.preferredFare || 0) - offer.amount} from your offer!
                      </Text>
                    )}
                    {offer.amount === (currentBooking?.preferredFare || 0) && (
                      <Text style={styles.fareMatchText}>
                        Matches your requested fare
                      </Text>
                    )}
                    {offer.amount > (currentBooking?.preferredFare || 0) && (
                      <Text style={styles.fareHigherText}>
                        ₱{offer.amount - (currentBooking?.preferredFare || 0)} above your offer
                      </Text>
                    )}
                  </View>
                  
                  <View style={styles.offerActionsModal}>
                    <TouchableOpacity
                      style={styles.declineOfferButtonModal}
                      onPress={() => handleDeclineSpecificOffer(offer)}
                    >
                      <Ionicons name="close-outline" size={20} color="#dc3545" />
                      <Text style={styles.declineOfferTextModal}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.acceptOfferButtonModal}
                      onPress={() => handleAcceptSpecificOffer(offer)}
                    >
                      <Ionicons name="checkmark-outline" size={20} color="#fff" />
                      <Text style={styles.acceptOfferTextModal}>Accept Offer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.offersModalFooter}>
              <TouchableOpacity
                style={styles.cancelBookingButtonModal}
                onPress={() => {
                  setShowOffersModal(false);
                  handleCancelBooking();
                }}
              >
                <Ionicons name="close-circle-outline" size={18} color="#dc3545" />
                <Text style={styles.cancelBookingTextModal}>Cancel Booking</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ivory1,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.ivory1,
    paddingHorizontal: spacing.large,
    paddingVertical: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.ivory3,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    marginLeft: spacing.small,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.orangeShade5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  // Offline
  offlineContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.large,
  },
  offlineTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.orangeShade7,
    marginTop: spacing.medium,
  },
  offlineText: {
    fontSize: 14,
    color: colors.orangeShade5,
    textAlign: 'center',
    marginTop: spacing.small,
    marginHorizontal: spacing.large,
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.large,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    marginTop: spacing.large,
    marginBottom: spacing.small,
  },
  authText: {
    fontSize: 16,
    color: colors.orangeShade5,
    textAlign: 'center',
    marginBottom: spacing.large,
  },
  loginButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.large * 2,
    paddingVertical: spacing.medium,
    borderRadius: 12,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  retryButton: {
    marginTop: spacing.large,
    backgroundColor: colors.primary,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.large,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },

  // Map
  map: {
    flex: 1,
  },
  
  // Selection hint
  selectionHint: {
    position: 'absolute',
    top: 80,
    left: spacing.medium,
    right: spacing.medium,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    borderRadius: 10,
  },
  selectionHintPickup: {
    backgroundColor: '#28a745',
  },
  selectionHintText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: spacing.small,
    fontSize: 13,
    flex: 1,
  },

  // Route Legend
  routeLegend: {
    position: 'absolute',
    top: 130,
    left: spacing.medium,
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: spacing.small,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  legendLine: {
    width: 20,
    height: 4,
    borderRadius: 2,
    marginRight: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,140,0,0.3)',
  },
  legendText: {
    fontSize: 11,
    color: colors.orangeShade6,
  },

  // Map controls
  mapControls: {
    position: 'absolute',
    right: spacing.medium,
    top: 100,
  },
  controlButton: {
    backgroundColor: colors.ivory1,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.ivory3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  // Markers
  pickupMarker: {
    backgroundColor: '#28a745',
    padding: 10,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  destinationMarker: {
    backgroundColor: colors.primary,
    padding: 10,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  destinationMarkerWarning: {
    backgroundColor: '#dc3545',
    borderColor: '#fff3cd',
  },

  // Bottom Panel
  bottomPanel: {
    backgroundColor: colors.ivory1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: colors.ivory3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  panelContent: {
    padding: spacing.medium,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.orangeShade7,
    marginBottom: spacing.small,
  },
  panelDescription: {
    fontSize: 14,
    color: colors.orangeShade5,
    marginBottom: spacing.medium,
  },

  // Buttons
  primaryButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.large,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: spacing.small,
  },
  secondaryButton: {
    backgroundColor: colors.ivory4,
    paddingVertical: 14,
    paddingHorizontal: spacing.large,
    borderRadius: 12,
    marginRight: spacing.small,
  },
  secondaryButtonText: {
    color: colors.orangeShade6,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: spacing.medium,
  },
  buttonFlex: {
    flex: 1,
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // Location row with search button
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.small,
  },

  // Location buttons
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ivory4,
    padding: spacing.medium,
    borderRadius: 12,
    marginBottom: spacing.small,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  locationButtonFlex: {
    flex: 1,
    marginBottom: 0,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  locationButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.ivory2,
  },
  locationButtonSet: {
    backgroundColor: colors.ivory3,
  },
  locationButtonWarning: {
    borderColor: '#dc3545',
    backgroundColor: '#fff5f5',
  },
  searchLocationButton: {
    backgroundColor: colors.primary,
    width: 48,
    height: '100%',
    minHeight: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  searchLocationButtonWarning: {
    backgroundColor: '#dc3545',
  },
  locationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.small,
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.orangeShade7,
  },
  locationValue: {
    fontSize: 12,
    color: colors.orangeShade5,
    marginTop: 2,
  },
  locationValueWarning: {
    color: '#dc3545',
    fontWeight: '500',
  },

  // Area warning banner
  areaWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    padding: spacing.small,
    borderRadius: 8,
    marginBottom: spacing.small,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  areaWarningText: {
    flex: 1,
    fontSize: 12,
    color: '#856404',
    marginLeft: spacing.small,
  },

  // Fare input
  fareInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ivory4,
    borderRadius: 12,
    paddingHorizontal: spacing.medium,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    marginRight: spacing.small,
  },
  fareInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: colors.orangeShade7,
    paddingVertical: spacing.medium,
  },

  // Waiting state
  waitingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.large,
  },
  waitingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.orangeShade7,
    marginTop: spacing.medium,
  },
  waitingText: {
    fontSize: 14,
    color: colors.orangeShade5,
    marginTop: spacing.small,
  },
  fareDisplay: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginTop: spacing.medium,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: spacing.small,
    marginTop: spacing.medium,
  },
  cancelButtonText: {
    color: '#dc3545',
    fontSize: 14,
    fontWeight: '600',
  },

  // Multi-offer styles
  offersHeader: {
    marginBottom: spacing.small,
  },
  yourFareLabel: {
    fontSize: 14,
    color: colors.orangeShade5,
    marginBottom: spacing.medium,
  },
  offersScrollView: {
    maxHeight: 300,
  },
  offerCard: {
    backgroundColor: colors.ivory4,
    borderRadius: 12,
    padding: spacing.medium,
    marginBottom: spacing.small,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  offerDriverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.small,
  },
  offerDriverDetails: {
    flex: 1,
  },
  offerDriverName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.orangeShade7,
  },
  ratingDisplaySmall: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  ratingTextSmall: {
    fontSize: 12,
    color: colors.orangeShade5,
    marginLeft: 3,
  },
  plateNumber: {
    fontSize: 12,
    color: colors.orangeShade4,
    marginLeft: 4,
  },
  offerAmountContainer: {
    alignItems: 'flex-end',
  },
  offerAmountLabel: {
    fontSize: 10,
    color: colors.orangeShade4,
    marginBottom: 2,
  },
  offerAmountGood: {
    color: '#28a745',
  },
  offerMessageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.ivory3,
    padding: spacing.small,
    borderRadius: 8,
    marginTop: spacing.small,
    marginBottom: spacing.small,
  },
  offerMessage: {
    flex: 1,
    fontSize: 12,
    color: colors.orangeShade6,
    marginLeft: 6,
    fontStyle: 'italic',
  },
  offerActions: {
    flexDirection: 'row',
    marginTop: spacing.small,
  },
  declineOfferButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dc3545',
    marginRight: spacing.small,
  },
  declineOfferText: {
    color: '#dc3545',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  acceptOfferButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28a745',
    paddingVertical: 10,
    borderRadius: 8,
  },
  acceptOfferText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },

  // Driver info
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ivory4,
    padding: spacing.medium,
    borderRadius: 12,
    marginBottom: spacing.medium,
  },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.medium,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.orangeShade7,
  },
  ratingDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingText: {
    fontSize: 14,
    color: colors.orangeShade6,
    marginLeft: 4,
  },
  tripFare: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },

  // Offer comparison
  offerComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.ivory4,
    padding: spacing.medium,
    borderRadius: 12,
    marginBottom: spacing.medium,
  },
  offerItem: {
    alignItems: 'center',
  },
  offerLabel: {
    fontSize: 12,
    color: colors.orangeShade5,
    marginBottom: 4,
  },
  offerAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.orangeShade6,
  },
  driverOfferAmount: {
    color: colors.primary,
  },

  // Accept/Decline buttons
  acceptButton: {
    backgroundColor: '#28a745',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.large,
    borderRadius: 12,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: spacing.small,
  },
  declineButton: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.large,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#dc3545',
    marginRight: spacing.small,
  },
  declineButtonText: {
    color: '#dc3545',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: spacing.small,
  },

  // Trip active
  distanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ivory4,
    padding: spacing.medium,
    borderRadius: 12,
    marginBottom: spacing.medium,
  },
  distanceText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.orangeShade7,
    marginLeft: spacing.small,
  },
  tripProgressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ivory3,
    padding: spacing.medium,
    borderRadius: 12,
    marginBottom: spacing.medium,
  },
  tripProgressText: {
    flex: 1,
    fontSize: 14,
    color: colors.orangeShade6,
    marginLeft: spacing.small,
    lineHeight: 20,
  },
  cancelTripButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dc3545',
    backgroundColor: 'transparent',
  },
  cancelTripButtonText: {
    color: '#dc3545',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: spacing.small,
  },
  completeButton: {
    backgroundColor: '#28a745',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: spacing.small,
  },
  completionHint: {
    fontSize: 12,
    color: colors.orangeShade5,
    textAlign: 'center',
    marginTop: spacing.small,
  },

  // Rating Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  ratingModal: {
    backgroundColor: colors.ivory1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.large,
    paddingBottom: 40,
  },
  ratingModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.orangeShade7,
    textAlign: 'center',
  },
  ratingModalSubtitle: {
    fontSize: 14,
    color: colors.orangeShade5,
    textAlign: 'center',
    marginTop: spacing.small,
    marginBottom: spacing.large,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.large,
  },
  starButton: {
    padding: spacing.small,
  },
  commentInput: {
    backgroundColor: colors.ivory4,
    borderRadius: 12,
    padding: spacing.medium,
    fontSize: 14,
    color: colors.orangeShade7,
    textAlignVertical: 'top',
    minHeight: 80,
    marginBottom: spacing.medium,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  submitRatingButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitRatingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Completion Confirmation Modal
  completionModal: {
    backgroundColor: colors.ivory1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.large,
    paddingBottom: 40,
  },
  completionHeader: {
    alignItems: 'center',
    marginBottom: spacing.large,
  },
  completionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.orangeShade7,
    marginTop: spacing.medium,
  },
  completionSubtitle: {
    fontSize: 14,
    color: colors.orangeShade5,
    textAlign: 'center',
    marginTop: spacing.small,
  },
  completionDriverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ivory4,
    padding: spacing.medium,
    borderRadius: 12,
    marginBottom: spacing.large,
  },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverDetails: {
    marginLeft: spacing.medium,
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.orangeShade7,
  },
  fareInfo: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  completionQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.orangeShade7,
    textAlign: 'center',
    marginBottom: spacing.large,
  },
  completionActions: {
    gap: spacing.medium,
  },
  confirmButton: {
    backgroundColor: '#28a745',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  disputeToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  disputeToggleText: {
    color: '#dc3545',
    fontSize: 14,
    fontWeight: '500',
  },
  disputeSection: {
    marginTop: spacing.medium,
    paddingTop: spacing.medium,
    borderTopWidth: 1,
    borderTopColor: colors.ivory3,
  },
  disputeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.orangeShade7,
    marginBottom: spacing.small,
  },
  disputeInput: {
    backgroundColor: colors.ivory4,
    borderRadius: 12,
    padding: spacing.medium,
    fontSize: 14,
    color: colors.orangeShade7,
    textAlignVertical: 'top',
    minHeight: 80,
    marginBottom: spacing.medium,
    borderWidth: 1,
    borderColor: '#dc3545',
  },
  submitDisputeButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitDisputeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Header right
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  offersHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ivory2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  offersHeaderBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  offersHeaderBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  historyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.ivory2,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // History Modal
  historyModalContainer: {
    flex: 1,
    backgroundColor: colors.ivory1,
    padding: spacing.medium,
  },
  historyModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.medium,
    paddingBottom: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.ivory3,
  },
  historyModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.orangeShade7,
  },
  historyList: {
    paddingBottom: spacing.medium,
  },
  historyLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.orangeShade5,
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
    borderBottomColor: colors.ivory3,
    position: 'relative',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 24,
  },
  historyDriver: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.orangeShade7,
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

  // Cancellation Modal
  cancellationModal: {
    backgroundColor: colors.ivory1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.large,
    paddingBottom: 40,
  },
  cancellationHeader: {
    alignItems: 'center',
    marginBottom: spacing.large,
  },
  cancellationTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#dc3545',
    marginTop: spacing.medium,
  },
  cancellationSubtitle: {
    fontSize: 14,
    color: colors.orangeShade5,
    textAlign: 'center',
    marginTop: spacing.small,
  },
  cancellationDetails: {
    backgroundColor: colors.ivory4,
    borderRadius: 12,
    padding: spacing.medium,
    marginBottom: spacing.medium,
  },
  cancellationDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.small,
  },
  cancellationDetailLabel: {
    fontSize: 14,
    color: colors.orangeShade5,
    marginLeft: spacing.small,
    marginRight: spacing.small,
  },
  cancellationDetailValue: {
    fontSize: 14,
    color: colors.orangeShade7,
    fontWeight: '600',
    flex: 1,
  },
  reportSection: {
    marginBottom: spacing.medium,
  },
  reportSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.orangeShade6,
    marginBottom: spacing.small,
  },
  reportInput: {
    backgroundColor: colors.ivory4,
    borderRadius: 12,
    padding: spacing.medium,
    fontSize: 14,
    color: colors.orangeShade7,
    textAlignVertical: 'top',
    minHeight: 100,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  cancellationButtons: {
    flexDirection: 'row',
    gap: spacing.small,
  },
  dismissButton: {
    flex: 1,
    backgroundColor: colors.ivory4,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  dismissButtonText: {
    color: colors.orangeShade6,
    fontSize: 16,
    fontWeight: '600',
  },
  reportButton: {
    flex: 1,
    backgroundColor: '#dc3545',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  reportButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: spacing.small,
  },
  cancellationScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  cancellationRatingSection: {
    backgroundColor: colors.ivory4,
    borderRadius: 12,
    padding: spacing.medium,
    marginBottom: spacing.medium,
    alignItems: 'center',
  },
  cancellationRatingSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.orangeShade7,
    marginBottom: 4,
  },
  cancellationRatingSubtitle: {
    fontSize: 12,
    color: colors.orangeShade5,
    marginBottom: spacing.medium,
  },
  cancellationStarsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.small,
    marginBottom: spacing.small,
  },
  cancellationRatingInput: {
    width: '100%',
    backgroundColor: colors.ivory1,
    borderRadius: 10,
    padding: spacing.small,
    fontSize: 14,
    color: colors.orangeShade7,
    textAlignVertical: 'top',
    minHeight: 60,
    borderWidth: 1,
    borderColor: colors.ivory3,
    marginTop: spacing.small,
  },
  submitRatingBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitRatingBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // WEBTODA Area Warning Modal
  areaWarningModal: {
    backgroundColor: colors.ivory1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.large,
    paddingBottom: 40,
    marginHorizontal: spacing.medium,
    marginTop: 'auto',
    marginBottom: 'auto',
    borderRadius: 24,
  },
  areaWarningHeader: {
    alignItems: 'center',
    marginBottom: spacing.large,
  },
  areaWarningTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f0ad4e',
    marginTop: spacing.medium,
    textAlign: 'center',
  },
  areaWarningSubtitle: {
    fontSize: 14,
    color: colors.orangeShade5,
    textAlign: 'center',
    marginTop: spacing.small,
    paddingHorizontal: spacing.medium,
  },
  areaWarningDetails: {
    backgroundColor: colors.ivory4,
    borderRadius: 12,
    padding: spacing.medium,
    marginBottom: spacing.medium,
  },
  areaWarningDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.small,
  },
  areaWarningDetailText: {
    fontSize: 14,
    color: colors.orangeShade7,
    marginLeft: spacing.small,
    fontWeight: '500',
  },
  areaWarningInfo: {
    flexDirection: 'row',
    backgroundColor: '#fff3cd',
    padding: spacing.medium,
    borderRadius: 12,
    marginBottom: spacing.large,
    alignItems: 'flex-start',
  },
  areaWarningInfoText: {
    flex: 1,
    fontSize: 13,
    color: '#856404',
    marginLeft: spacing.small,
    lineHeight: 18,
  },
  areaWarningButtons: {
    gap: spacing.small,
  },
  areaWarningCancelButton: {
    backgroundColor: colors.ivory4,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing.small,
  },
  areaWarningCancelText: {
    color: colors.orangeShade6,
    fontSize: 16,
    fontWeight: '600',
  },
  areaWarningConfirmButton: {
    backgroundColor: '#f0ad4e',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  areaWarningConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Route Info Styles
  routeInfoContainer: {
    backgroundColor: colors.ivory4,
    borderRadius: 12,
    padding: spacing.medium,
    marginBottom: spacing.medium,
  },
  routeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: spacing.medium,
  },
  routeInfoItem: {
    alignItems: 'center',
    flex: 1,
  },
  routeInfoLabel: {
    fontSize: 12,
    color: colors.orangeShade5,
    marginTop: 4,
  },
  routeInfoValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.orangeShade7,
    marginTop: 2,
  },
  routeInfoDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.ivory3,
  },
  
  // Fare Breakdown Styles
  fareBreakdownContainer: {
    backgroundColor: colors.ivory2,
    borderRadius: 10,
    padding: spacing.medium,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  fareBreakdownTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.orangeShade7,
    marginBottom: spacing.small,
  },
  fareBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  fareBreakdownLabel: {
    fontSize: 13,
    color: colors.orangeShade5,
    flex: 1,
  },
  fareBreakdownAmount: {
    fontSize: 13,
    color: colors.orangeShade6,
    fontWeight: '500',
  },
  fareBreakdownTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.ivory3,
    marginTop: spacing.small,
    paddingTop: spacing.small,
  },
  fareBreakdownTotalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.orangeShade7,
  },
  fareBreakdownTotalAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  
  // Route Warning Styles
  routeWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    padding: spacing.small,
    borderRadius: 8,
    marginTop: spacing.small,
  },
  routeWarningText: {
    flex: 1,
    fontSize: 12,
    color: '#856404',
    marginLeft: spacing.small,
  },
  
  // Calculating Route Styles
  calculatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.medium,
    marginBottom: spacing.small,
  },
  calculatingText: {
    fontSize: 14,
    color: colors.orangeShade5,
    marginLeft: spacing.small,
  },
  
  // Fare Comparison Styles
  fareComparisonBanner: {
    marginBottom: spacing.small,
  },
  fareLowWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5f5',
    padding: spacing.small,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dc3545',
  },
  fareLowText: {
    flex: 1,
    fontSize: 12,
    color: '#dc3545',
    marginLeft: spacing.small,
    fontWeight: '500',
  },
  fareGoodBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fff4',
    padding: spacing.small,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#28a745',
  },
  fareGoodText: {
    flex: 1,
    fontSize: 12,
    color: '#28a745',
    marginLeft: spacing.small,
    fontWeight: '500',
  },

  // Multi-offer panel styles
  offersBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.small,
  },
  offersBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.small,
  },
  offersBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  yourFareContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.ivory3,
    padding: spacing.small,
    borderRadius: 8,
    marginBottom: spacing.medium,
  },
  yourFareAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  offerPreview: {
    backgroundColor: colors.ivory4,
    padding: spacing.medium,
    borderRadius: 12,
    marginBottom: spacing.medium,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  offerPreviewInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offerPreviewAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.orangeShade7,
  },
  moreOffersText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
    marginTop: spacing.small,
    textAlign: 'center',
  },
  viewAllOffersButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: spacing.small,
  },
  viewAllOffersText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: spacing.small,
  },

  // Driver Offers Modal styles
  offersModal: {
    backgroundColor: colors.ivory1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: spacing.large,
  },
  offersModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.ivory3,
  },
  offersModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offersModalBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.small,
  },
  offersModalBadgeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  offersModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.orangeShade7,
  },
  offersModalCloseButton: {
    padding: spacing.small,
  },
  offersModalYourFare: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.ivory3,
    marginHorizontal: spacing.medium,
    marginTop: spacing.medium,
    padding: spacing.medium,
    borderRadius: 12,
  },
  offersModalYourFareLabel: {
    fontSize: 14,
    color: colors.orangeShade5,
  },
  offersModalYourFareAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  offersModalTip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    marginHorizontal: spacing.medium,
    marginTop: spacing.medium,
    padding: spacing.small,
    borderRadius: 8,
  },
  offersModalTipText: {
    flex: 1,
    fontSize: 12,
    color: '#856404',
    marginLeft: spacing.small,
  },
  offersModalScrollView: {
    marginTop: spacing.medium,
    maxHeight: 400,
  },
  offersModalScrollContent: {
    paddingHorizontal: spacing.medium,
    paddingBottom: spacing.medium,
  },
  offerCardModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: spacing.medium,
    marginBottom: spacing.medium,
    borderWidth: 1,
    borderColor: colors.ivory3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  offerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.small,
  },
  offerNumberBadge: {
    backgroundColor: colors.ivory4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  offerNumberText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.orangeShade5,
  },
  offerFareBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ivory4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  offerFareBadgeGood: {
    backgroundColor: '#e8f5e9',
  },
  offerFareBadgeHigher: {
    backgroundColor: '#ffebee',
  },
  offerFareBadgeText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.orangeShade7,
  },
  offerFareBadgeTextGood: {
    color: '#28a745',
  },
  offerDriverInfoModal: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.small,
  },
  driverAvatarModal: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.medium,
  },
  offerDriverDetailsModal: {
    flex: 1,
  },
  offerDriverNameModal: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.orangeShade7,
  },
  ratingDisplayModal: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingTextModal: {
    fontSize: 14,
    color: colors.orangeShade6,
    marginLeft: 4,
  },
  dotSeparator: {
    marginHorizontal: 6,
    color: colors.orangeShade4,
  },
  plateNumberModal: {
    fontSize: 13,
    color: colors.orangeShade5,
    marginLeft: 4,
  },
  offerMessageContainerModal: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.ivory3,
    padding: spacing.small,
    borderRadius: 10,
    marginVertical: spacing.small,
  },
  offerMessageModal: {
    flex: 1,
    fontSize: 13,
    color: colors.orangeShade6,
    marginLeft: 8,
    fontStyle: 'italic',
  },
  offerFareComparison: {
    alignItems: 'center',
    paddingVertical: spacing.small,
  },
  fareSavingsText: {
    fontSize: 13,
    color: '#28a745',
    fontWeight: '600',
  },
  fareMatchText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  fareHigherText: {
    fontSize: 13,
    color: '#dc3545',
    fontWeight: '500',
  },
  offerActionsModal: {
    flexDirection: 'row',
    marginTop: spacing.small,
  },
  declineOfferButtonModal: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dc3545',
    marginRight: spacing.small,
  },
  declineOfferTextModal: {
    color: '#dc3545',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 4,
  },
  acceptOfferButtonModal: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28a745',
    paddingVertical: 12,
    borderRadius: 10,
  },
  acceptOfferTextModal: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 4,
  },
  offersModalFooter: {
    paddingHorizontal: spacing.medium,
    paddingTop: spacing.medium,
    borderTopWidth: 1,
    borderTopColor: colors.ivory3,
  },
  cancelBookingButtonModal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  cancelBookingTextModal: {
    color: '#dc3545',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },

  // Location Search Modal Styles
  searchModalContainer: {
    flex: 1,
    backgroundColor: colors.ivory1,
  },
  searchModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.ivory3,
    backgroundColor: colors.ivory1,
  },
  searchBackButton: {
    padding: spacing.small,
    marginRight: spacing.small,
  },
  searchModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.orangeShade7,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ivory3,
    marginHorizontal: spacing.medium,
    marginVertical: spacing.medium,
    borderRadius: 12,
    paddingHorizontal: spacing.medium,
  },
  searchIcon: {
    marginRight: spacing.small,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.orangeShade7,
    paddingVertical: 14,
  },
  clearSearchButton: {
    padding: spacing.small,
  },
  searchLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchLoadingText: {
    marginTop: spacing.medium,
    fontSize: 14,
    color: colors.orangeShade5,
  },
  searchResultsList: {
    paddingHorizontal: spacing.medium,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.ivory3,
  },
  searchResultIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.ivory3,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.medium,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.orangeShade7,
  },
  searchResultAddress: {
    fontSize: 13,
    color: colors.orangeShade5,
    marginTop: 2,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.large,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.orangeShade5,
    marginTop: spacing.medium,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: colors.orangeShade4,
    marginTop: spacing.small,
  },
  searchHintContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.xlarge * 2,
    paddingHorizontal: spacing.large,
  },
  searchHintText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.orangeShade5,
    marginTop: spacing.medium,
  },
  searchHintSubtext: {
    fontSize: 14,
    color: colors.orangeShade4,
    marginTop: spacing.small,
    textAlign: 'center',
  },
  quickSuggestions: {
    marginTop: spacing.xlarge,
    width: '100%',
  },
  quickSuggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.orangeShade5,
    marginBottom: spacing.medium,
  },
  quickSuggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.ivory3,
  },
  quickSuggestionText: {
    fontSize: 15,
    color: colors.orangeShade6,
    marginLeft: spacing.small,
  },
});

export default BookingScreen;
