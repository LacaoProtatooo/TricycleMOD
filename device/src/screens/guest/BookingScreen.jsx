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
} from 'react-native';
import MapView, { Marker, Circle, Polyline, Polygon, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import axios from 'axios';
import Constants from 'expo-constants';

import { colors, spacing } from '../../components/common/theme';
import { useAsyncSQLiteContext } from '../../utils/asyncSQliteProvider';
import { getToken } from '../../utils/jwtStorage';
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
} from '../../redux/actions/bookingAction';

const BACKEND_URL = Constants.expoConfig?.extra?.BACKEND_URL || 'http://192.168.254.105:5000';
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
  const mapRef = useRef(null);
  const db = useAsyncSQLiteContext();
  
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

  // Initialize region with WEBTODA service area
  const [region, setRegion] = useState(getServiceAreaRegion());

  useEffect(() => {
    requestPermissions();
    // Fetch active booking on mount
    if (db && user) {
      dispatch(getActiveBooking(db));
    }
    return () => {
      if (watchRef.current) {
        watchRef.current.remove();
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [db, user]);

  // Polling for booking status updates when waiting or in active trip
  useEffect(() => {
    const shouldPoll = [
      BOOKING_STATUS.WAITING_FOR_DRIVER,
      BOOKING_STATUS.OFFER_RECEIVED,
      BOOKING_STATUS.TRIP_ACTIVE,
      BOOKING_STATUS.AWAITING_CONFIRMATION,
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
          setBookingStatus(BOOKING_STATUS.AWAITING_CONFIRMATION);
          setShowCompletionModal(true);
          break;
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
              reason: currentBooking.cancellationReason || 'No reason provided',
              bookingId: currentBooking._id,
              cancelledAt: currentBooking.cancelledAt,
            });
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
      // Validate pickup is within WEBTODA GPX route area
      const pickupValidation = validatePickupLocation(latitude, longitude);
      
      if (!pickupValidation.valid) {
        Alert.alert(
          'Outside WEBTODA Service Area',
          pickupValidation.message + '\n\nThe highlighted route shows the WEBTODA coverage area.',
          [{ text: 'OK' }]
        );
        return;
      }
      
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

  const handleStartBooking = () => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to book a special trip.');
      return;
    }
    setBookingStatus(BOOKING_STATUS.SELECTING_LOCATIONS);
    setSelectingLocationType('pickup');
    
    // Set pickup to current location by default
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

  const handleSubmitRating = () => {
    if (selectedRating === 0) {
      Alert.alert('Rating Required', 'Please select a rating before submitting.');
      return;
    }

    if (currentBooking) {
      dispatch(rateDriver({
        bookingId: currentBooking._id,
        driverId: currentBooking.driver._id,
        rating: selectedRating,
        comment: ratingComment,
        db,
      }));
    }

    setShowRatingModal(false);
    resetBooking();
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
        Alert.alert('Trip Confirmed', 'Thank you for confirming! Please rate your driver.');
        // The polling will pick up the completed status and show rating modal
        dispatch(getActiveBooking(db));
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
    resetBooking();
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

      {/* Map */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
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
        <Polyline
          coordinates={WEBTODA_ROUTE_COORDINATES}
          strokeColor={colors.primary}
          strokeWidth={4}
          lineCap="round"
          lineJoin="round"
        />

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
              const validation = validatePickupLocation(latitude, longitude);
              if (!validation.valid) {
                Alert.alert(
                  'Outside WEBTODA Service Area',
                  validation.message,
                  [{ text: 'OK' }]
                );
                // Reset to previous location by not updating
                return;
              }
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
        {pickupLocation && destinationLocation && routeCoordinates.length > 0 && (
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
            <TouchableOpacity
              style={[
                styles.locationButton,
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
                    ? 'Within WEBTODA area ✓' 
                    : 'Tap on WEBTODA route to set'}
                </Text>
              </View>
              {pickupLocation && (
                <Ionicons name="checkmark-circle" size={20} color="#28a745" />
              )}
            </TouchableOpacity>

            {/* Destination Location */}
            <TouchableOpacity
              style={[
                styles.locationButton,
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
                        ? 'Outside area - Extra charges apply' 
                        : 'Location set (tap to change)')
                    : 'Tap to set on map'}
                </Text>
              </View>
              {destinationLocation && !destinationWarning && (
                <Ionicons name="checkmark-circle" size={20} color="#28a745" />
              )}
              {destinationWarning && (
                <Ionicons name="alert-circle" size={20} color="#dc3545" />
              )}
            </TouchableOpacity>

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
              <Text style={styles.panelTitle}>
                {driverOffers.length} Driver{driverOffers.length > 1 ? 's' : ''} Interested!
              </Text>
              <Text style={styles.panelDescription}>
                Choose the best offer for your trip
              </Text>
            </View>
            
            <Text style={styles.yourFareLabel}>
              Your offer: ₱{currentBooking?.preferredFare || preferredFare}
            </Text>

            <ScrollView 
              style={styles.offersScrollView}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
              {driverOffers.map((offer, index) => (
                <View key={offer._id || index} style={styles.offerCard}>
                  <View style={styles.offerDriverInfo}>
                    <View style={styles.driverAvatarSmall}>
                      <Ionicons name="person" size={20} color="#fff" />
                    </View>
                    <View style={styles.offerDriverDetails}>
                      <Text style={styles.offerDriverName}>
                        {offer.driver?.firstname || 'Driver'} {offer.driver?.lastname || ''}
                      </Text>
                      <View style={styles.ratingDisplaySmall}>
                        <Ionicons name="star" size={12} color={colors.starYellow} />
                        <Text style={styles.ratingTextSmall}>
                          {offer.driver?.rating?.toFixed(1) || 'N/A'}
                        </Text>
                        {offer.tricycle?.plateNumber && (
                          <Text style={styles.plateNumber}>
                            • {offer.tricycle.plateNumber}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.offerAmountContainer}>
                      <Text style={styles.offerAmountLabel}>Fare</Text>
                      <Text style={[
                        styles.offerAmount,
                        offer.amount <= (currentBooking?.preferredFare || 0) && styles.offerAmountGood
                      ]}>
                        ₱{offer.amount}
                      </Text>
                    </View>
                  </View>
                  
                  {offer.message ? (
                    <View style={styles.offerMessageContainer}>
                      <Ionicons name="chatbubble-outline" size={12} color="#666" />
                      <Text style={styles.offerMessage} numberOfLines={2}>
                        {offer.message}
                      </Text>
                    </View>
                  ) : null}
                  
                  <View style={styles.offerActions}>
                    <TouchableOpacity
                      style={styles.declineOfferButton}
                      onPress={() => handleDeclineSpecificOffer(offer)}
                    >
                      <Ionicons name="close-outline" size={18} color="#dc3545" />
                      <Text style={styles.declineOfferText}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.acceptOfferButton}
                      onPress={() => handleAcceptSpecificOffer(offer)}
                    >
                      <Ionicons name="checkmark-outline" size={18} color="#fff" />
                      <Text style={styles.acceptOfferText}>Accept</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

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

            <View style={styles.reportSection}>
              <Text style={styles.reportSectionTitle}>
                Was there an issue? Report this incident
              </Text>
              <TextInput
                style={styles.reportInput}
                placeholder="Describe the issue (optional)"
                placeholderTextColor={colors.orangeShade4}
                multiline
                numberOfLines={4}
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
              <TouchableOpacity
                style={[
                  styles.reportButton,
                  (!reportReason.trim() || isReporting) && styles.buttonDisabled,
                ]}
                onPress={handleSubmitCancellationReport}
                disabled={!reportReason.trim() || isReporting}
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
            </View>
          </View>
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
});

export default BookingScreen;
