/**
 * DriverBookingScreen.jsx - Driver's Booking Request Screen
 *
 * Allows drivers to:
 * - View nearby booking requests
 * - Accept bookings or make counter offers
 * - Track active trips
 * - Complete trips within destination radius
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
  Platform,
} from 'react-native';
import MapView, { Marker, Circle, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import axios from 'axios';

import { colors, spacing } from '../../components/common/theme';
import { getToken } from '../../utils/jwtStorage';
import { useAsyncSQLiteContext } from '../../utils/asyncSQliteProvider';
import { getCodingDayStatus, getCodingDayName } from '../../utils/codingDayUtils';
import { API_URL } from '../../utils/config';

const BACKEND = API_URL;
const COMPLETION_RADIUS_METERS = 300;

const DriverBookingScreen = () => {
  const dispatch = useDispatch();
  const db = useAsyncSQLiteContext();
  const mapRef = useRef(null);
  
  const { user } = useSelector((state) => state.auth);
  
  // State
  const [authToken, setAuthToken] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [nearbyBookings, setNearbyBookings] = useState([]);
  const [activeBooking, setActiveBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assignedTricycle, setAssignedTricycle] = useState(null);
  
  // Calculate coding day status
  const codingDayStatus = useMemo(() => {
    if (!assignedTricycle) return null;
    return getCodingDayStatus(assignedTricycle.codingDay);
  }, [assignedTricycle]);
  
  // Modal states
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [counterOffer, setCounterOffer] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  
  // Trip tracking
  const [distanceToDestination, setDistanceToDestination] = useState(null);
  const watchRef = useRef(null);

  const [region, setRegion] = useState({
    latitude: 14.5176,
    longitude: 121.0509,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  useEffect(() => {
    initializeDriver();
    return () => {
      if (watchRef.current) {
        watchRef.current.remove();
      }
    };
  }, [db]);

  useEffect(() => {
    let interval;
    if (isOnline && !activeBooking) {
      // Poll for nearby bookings every 10 seconds when online
      interval = setInterval(fetchNearbyBookings, 10000);
    }
    return () => clearInterval(interval);
  }, [isOnline, activeBooking, userLocation]);

  const initializeDriver = async () => {
    try {
      setLoading(true);
      
      // Get auth token
      let token = null;
      if (db) {
        token = await getToken(db);
        setAuthToken(token);
      }
      
      // Fetch assigned tricycle for coding day check
      if (token) {
        try {
          const trikeRes = await axios.get(`${BACKEND}/api/tricycles`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (trikeRes.data.success && trikeRes.data.data?.length > 0) {
            setAssignedTricycle(trikeRes.data.data[0]);
          }
        } catch (trikeError) {
          console.warn('Error fetching tricycle:', trikeError);
        }
      }
      
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        const { latitude, longitude } = location.coords;
        setUserLocation({ latitude, longitude });
        setRegion({
          latitude,
          longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      }
      
      // Check for active booking
      await checkActiveBooking();
      
    } catch (error) {
      console.error('Error initializing driver:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkActiveBooking = async () => {
    if (!authToken) return;
    
    try {
      const response = await axios.get(`${BACKEND}/api/booking/driver?status=accepted`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      
      if (response.data.success && response.data.bookings.length > 0) {
        setActiveBooking(response.data.bookings[0]);
        startLocationTracking();
      }
    } catch (error) {
      console.error('Error checking active booking:', error);
    }
  };

  const fetchNearbyBookings = async () => {
    if (!userLocation || !authToken) return;
    
    try {
      const response = await axios.get(
        `${BACKEND}/api/booking/nearby?lat=${userLocation.latitude}&lon=${userLocation.longitude}&radius=5`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      
      if (response.data.success) {
        setNearbyBookings(response.data.bookings);
      }
    } catch (error) {
      console.error('Error fetching nearby bookings:', error);
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
          
          // Calculate distance to destination if active booking
          if (activeBooking) {
            const distance = calculateDistance(
              latitude,
              longitude,
              activeBooking.destination.latitude,
              activeBooking.destination.longitude
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
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const toggleOnlineStatus = async () => {
    // Check coding day restriction
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
    } else {
      setIsOnline(true);
      fetchNearbyBookings();
    }
  };

  const handleAcceptBooking = async (booking, withCounterOffer = false) => {
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
      const payload = withCounterOffer
        ? { accept: false, counterOffer: parseFloat(counterOffer), message: offerMessage }
        : { accept: true };

      const response = await axios.post(
        `${BACKEND}/api/booking/${booking._id}/driver-respond`,
        payload,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      if (response.data.success) {
        if (withCounterOffer) {
          Alert.alert('Success', 'Counter offer sent! Waiting for passenger response.');
          setShowOfferModal(false);
          setCounterOffer('');
          setOfferMessage('');
        } else {
          Alert.alert('Success', 'Booking accepted!');
          setActiveBooking(response.data.booking);
          startLocationTracking();
        }
        
        // Refresh nearby bookings
        fetchNearbyBookings();
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to respond to booking');
    }
  };

  const handleCompleteTrip = async () => {
    if (!activeBooking || !userLocation) return;

    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      activeBooking.destination.latitude,
      activeBooking.destination.longitude
    );

    if (distance > COMPLETION_RADIUS_METERS) {
      Alert.alert(
        'Not at Destination',
        `You must be within ${COMPLETION_RADIUS_METERS}m of the destination. Current distance: ${Math.round(distance)}m`
      );
      return;
    }

    try {
      const response = await axios.post(
        `${BACKEND}/api/booking/${activeBooking._id}/complete`,
        { userLat: userLocation.latitude, userLon: userLocation.longitude },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      if (response.data.success) {
        Alert.alert('Trip Completed', 'The trip has been marked as completed.');
        setActiveBooking(null);
        setDistanceToDestination(null);
        
        if (watchRef.current) {
          watchRef.current.remove();
          watchRef.current = null;
        }
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to complete trip');
    }
  };

  const handleCancelTrip = () => {
    Alert.alert(
      'Cancel Trip',
      'Are you sure you want to cancel this trip?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          onPress: async () => {
            try {
              await axios.post(
                `${BACKEND}/api/booking/${activeBooking._id}/cancel`,
                { reason: 'Driver cancelled' },
                { headers: { Authorization: `Bearer ${authToken}` } }
              );
              setActiveBooking(null);
              setDistanceToDestination(null);
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel trip');
            }
          },
        },
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNearbyBookings();
    setRefreshing(false);
  };

  const centerOnUser = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateCamera({
        center: userLocation,
        zoom: 16,
      }, { duration: 500 });
    }
  };

  const renderBookingItem = ({ item }) => {
    const distance = userLocation
      ? calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          item.pickup.latitude,
          item.pickup.longitude
        )
      : null;

    return (
      <View style={styles.bookingCard}>
        <View style={styles.bookingHeader}>
          <View style={styles.passengerInfo}>
            <View style={styles.passengerAvatar}>
              <Ionicons name="person" size={20} color="#fff" />
            </View>
            <View>
              <Text style={styles.passengerName}>
                {item.user?.firstname} {item.user?.lastname}
              </Text>
              {item.user?.rating > 0 && (
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={12} color={colors.starYellow} />
                  <Text style={styles.ratingText}>{item.user?.rating.toFixed(1)}</Text>
                </View>
              )}
            </View>
          </View>
          <Text style={styles.fareAmount}>₱{item.preferredFare}</Text>
        </View>

        <View style={styles.bookingDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="location" size={16} color="#28a745" />
            <Text style={styles.detailText} numberOfLines={1}>
              Pickup: {distance ? `${(distance / 1000).toFixed(1)}km away` : 'Calculating...'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="flag" size={16} color={colors.primary} />
            <Text style={styles.detailText} numberOfLines={1}>
              Est. Distance: {item.estimatedDistance ? `${(item.estimatedDistance / 1000).toFixed(1)}km` : 'N/A'}
            </Text>
          </View>
        </View>

        <View style={styles.bookingActions}>
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => handleAcceptBooking(item)}
          >
            <Ionicons name="checkmark" size={18} color="#fff" />
            <Text style={styles.acceptButtonText}>Accept</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.offerButton}
            onPress={() => {
              setSelectedBooking(item);
              setCounterOffer(item.preferredFare.toString());
              setShowOfferModal(true);
            }}
          >
            <Ionicons name="cash-outline" size={18} color={colors.primary} />
            <Text style={styles.offerButtonText}>Counter Offer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Coding Day Warning Banner */}
      {codingDayStatus && codingDayStatus.isCodingDay && (
        <View style={styles.codingDayBanner}>
          <View style={styles.codingDayContent}>
            <Ionicons name="warning" size={22} color="#fff" />
            <View style={styles.codingDayTextContainer}>
              <Text style={styles.codingDayTitle}>🚫 Coding Day - Cannot Accept Trips</Text>
              <Text style={styles.codingDayMessage}>
                Today is {getCodingDayName(assignedTricycle?.codingDay)}. You cannot accept bookings today.
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Ionicons name="bicycle-outline" size={24} color={colors.primary} />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Driver Mode</Text>
            <Text style={styles.headerSubtitle}>
              {activeBooking ? 'Trip Active' : isOnline ? 'Looking for passengers' : 'Offline'}
            </Text>
          </View>
        </View>
        
        {!activeBooking && (
          <TouchableOpacity
            style={[styles.onlineToggle, isOnline && styles.onlineToggleActive]}
            onPress={toggleOnlineStatus}
          >
            <View style={[styles.toggleDot, isOnline && styles.toggleDotActive]} />
            <Text style={[styles.toggleText, isOnline && styles.toggleTextActive]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Active Trip View */}
      {activeBooking ? (
        <View style={styles.activeTrip}>
          {/* Map */}
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
            style={styles.map}
            region={{
              latitude: userLocation?.latitude || activeBooking.pickup.latitude,
              longitude: userLocation?.longitude || activeBooking.pickup.longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
            showsUserLocation={true}
          >
            {/* Pickup Marker */}
            <Marker coordinate={activeBooking.pickup} title="Pickup">
              <View style={styles.pickupMarker}>
                <Ionicons name="locate" size={16} color="#fff" />
              </View>
            </Marker>
            
            {/* Destination Marker */}
            <Marker coordinate={activeBooking.destination} title="Destination">
              <View style={styles.destinationMarker}>
                <Ionicons name="flag" size={16} color="#fff" />
              </View>
            </Marker>
            
            {/* Route Line */}
            <Polyline
              coordinates={[activeBooking.pickup, activeBooking.destination]}
              strokeColor={colors.primary}
              strokeWidth={3}
              lineDashPattern={[10, 5]}
            />
            
            {/* Completion Zone */}
            <Circle
              center={activeBooking.destination}
              radius={COMPLETION_RADIUS_METERS}
              strokeColor="rgba(40,167,69,0.6)"
              fillColor="rgba(40,167,69,0.15)"
            />
          </MapView>

          {/* Trip Info Panel */}
          <View style={styles.tripPanel}>
            <View style={styles.passengerInfo}>
              <View style={styles.passengerAvatar}>
                <Ionicons name="person" size={24} color="#fff" />
              </View>
              <View>
                <Text style={styles.passengerName}>
                  {activeBooking.user?.firstname} {activeBooking.user?.lastname}
                </Text>
                <Text style={styles.tripFare}>Fare: ₱{activeBooking.agreedFare}</Text>
              </View>
            </View>

            {distanceToDestination !== null && (
              <View style={styles.distanceInfo}>
                <Ionicons name="navigate-outline" size={20} color={colors.primary} />
                <Text style={styles.distanceText}>
                  {distanceToDestination < 1000
                    ? `${Math.round(distanceToDestination)}m`
                    : `${(distanceToDestination / 1000).toFixed(1)}km`} to destination
                </Text>
              </View>
            )}

            <View style={styles.tripActions}>
              <TouchableOpacity
                style={[
                  styles.completeButton,
                  distanceToDestination > COMPLETION_RADIUS_METERS && styles.buttonDisabled,
                ]}
                onPress={handleCompleteTrip}
                disabled={distanceToDestination > COMPLETION_RADIUS_METERS}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.completeButtonText}>Complete Trip</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.cancelTripButton} onPress={handleCancelTrip}>
                <Ionicons name="close-circle-outline" size={20} color="#dc3545" />
              </TouchableOpacity>
            </View>
            
            {distanceToDestination > COMPLETION_RADIUS_METERS && (
              <Text style={styles.completionHint}>
                Must be within {COMPLETION_RADIUS_METERS}m to complete
              </Text>
            )}
          </View>
        </View>
      ) : (
        /* Booking List View */
        <View style={styles.bookingListContainer}>
          {!isOnline ? (
            <View style={styles.offlineView}>
              <Ionicons name="cloud-offline-outline" size={60} color={colors.orangeShade4} />
              <Text style={styles.offlineTitle}>You're Offline</Text>
              <Text style={styles.offlineText}>
                Go online to start receiving booking requests from nearby passengers.
              </Text>
              <TouchableOpacity style={styles.goOnlineButton} onPress={toggleOnlineStatus}>
                <Text style={styles.goOnlineButtonText}>Go Online</Text>
              </TouchableOpacity>
            </View>
          ) : nearbyBookings.length === 0 ? (
            <View style={styles.emptyView}>
              <Ionicons name="search-outline" size={60} color={colors.orangeShade4} />
              <Text style={styles.emptyTitle}>No Bookings Nearby</Text>
              <Text style={styles.emptyText}>
                We'll notify you when passengers request trips nearby.
              </Text>
              <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={nearbyBookings}
              renderItem={renderBookingItem}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.bookingList}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              ListHeaderComponent={
                <Text style={styles.listHeader}>
                  {nearbyBookings.length} booking{nearbyBookings.length > 1 ? 's' : ''} nearby
                </Text>
              }
            />
          )}
        </View>
      )}

      {/* Counter Offer Modal */}
      <Modal
        visible={showOfferModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowOfferModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.offerModal}>
            <Text style={styles.modalTitle}>Make Counter Offer</Text>
            
            <Text style={styles.modalLabel}>Passenger's Offer: ₱{selectedBooking?.preferredFare}</Text>
            
            <View style={styles.offerInputContainer}>
              <Text style={styles.currencySymbol}>₱</Text>
              <TextInput
                style={styles.offerInput}
                placeholder="Your offer"
                keyboardType="numeric"
                value={counterOffer}
                onChangeText={setCounterOffer}
              />
            </View>
            
            <TextInput
              style={styles.messageInput}
              placeholder="Message (optional)"
              value={offerMessage}
              onChangeText={setOfferMessage}
              multiline
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelModalButton}
                onPress={() => setShowOfferModal(false)}
              >
                <Text style={styles.cancelModalText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sendOfferButton}
                onPress={() => handleAcceptBooking(selectedBooking, true)}
              >
                <Text style={styles.sendOfferText}>Send Offer</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.medium,
    color: colors.orangeShade5,
  },

  // Coding Day Banner
  codingDayBanner: {
    backgroundColor: '#dc3545',
    padding: spacing.medium,
  },
  codingDayContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  codingDayTextContainer: {
    marginLeft: spacing.medium,
    flex: 1,
  },
  codingDayTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  codingDayMessage: {
    color: '#fff',
    fontSize: 12,
    marginTop: 2,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.large,
    paddingVertical: spacing.medium,
    backgroundColor: colors.ivory1,
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
  onlineToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ivory4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  onlineToggleActive: {
    backgroundColor: '#d4edda',
    borderColor: '#28a745',
  },
  toggleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6c757d',
    marginRight: 6,
  },
  toggleDotActive: {
    backgroundColor: '#28a745',
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6c757d',
  },
  toggleTextActive: {
    color: '#28a745',
  },

  // Booking List
  bookingListContainer: {
    flex: 1,
  },
  bookingList: {
    padding: spacing.medium,
  },
  listHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.orangeShade6,
    marginBottom: spacing.medium,
  },
  bookingCard: {
    backgroundColor: colors.ivory1,
    borderRadius: 12,
    padding: spacing.medium,
    marginBottom: spacing.medium,
    borderWidth: 1,
    borderColor: colors.ivory3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.small,
  },
  passengerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passengerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.small,
  },
  passengerName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.orangeShade7,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  ratingText: {
    fontSize: 12,
    color: colors.orangeShade5,
    marginLeft: 4,
  },
  fareAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  bookingDetails: {
    marginBottom: spacing.medium,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  detailText: {
    fontSize: 13,
    color: colors.orangeShade6,
    marginLeft: spacing.small,
    flex: 1,
  },
  bookingActions: {
    flexDirection: 'row',
    gap: spacing.small,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28a745',
    paddingVertical: 10,
    borderRadius: 8,
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 4,
  },
  offerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ivory4,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  offerButtonText: {
    color: colors.primary,
    fontWeight: '600',
    marginLeft: 4,
  },

  // Empty / Offline states
  offlineView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.large,
  },
  offlineTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.orangeShade7,
    marginTop: spacing.medium,
  },
  offlineText: {
    fontSize: 14,
    color: colors.orangeShade5,
    textAlign: 'center',
    marginTop: spacing.small,
  },
  goOnlineButton: {
    marginTop: spacing.large,
    backgroundColor: '#28a745',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
  },
  goOnlineButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  emptyView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.large,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.orangeShade7,
    marginTop: spacing.medium,
  },
  emptyText: {
    fontSize: 14,
    color: colors.orangeShade5,
    textAlign: 'center',
    marginTop: spacing.small,
  },
  refreshButton: {
    marginTop: spacing.large,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: '#fff',
    fontWeight: '600',
  },

  // Active Trip
  activeTrip: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  pickupMarker: {
    backgroundColor: '#28a745',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
  },
  destinationMarker: {
    backgroundColor: colors.primary,
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
  },
  tripPanel: {
    backgroundColor: colors.ivory1,
    padding: spacing.medium,
    borderTopWidth: 1,
    borderTopColor: colors.ivory3,
  },
  tripFare: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  distanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ivory4,
    padding: spacing.small,
    borderRadius: 8,
    marginVertical: spacing.small,
  },
  distanceText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.orangeShade7,
    marginLeft: spacing.small,
  },
  tripActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.small,
  },
  completeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28a745',
    paddingVertical: 14,
    borderRadius: 10,
    marginRight: spacing.small,
  },
  completeButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    marginLeft: spacing.small,
  },
  cancelTripButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.ivory4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dc3545',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  completionHint: {
    fontSize: 12,
    color: colors.orangeShade5,
    textAlign: 'center',
    marginTop: spacing.small,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  offerModal: {
    backgroundColor: colors.ivory1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.large,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.orangeShade7,
    marginBottom: spacing.medium,
  },
  modalLabel: {
    fontSize: 14,
    color: colors.orangeShade5,
    marginBottom: spacing.small,
  },
  offerInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ivory4,
    borderRadius: 10,
    paddingHorizontal: spacing.medium,
    marginBottom: spacing.medium,
  },
  currencySymbol: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
  },
  offerInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '600',
    color: colors.orangeShade7,
    paddingVertical: spacing.small,
    marginLeft: spacing.small,
  },
  messageInput: {
    backgroundColor: colors.ivory4,
    borderRadius: 10,
    padding: spacing.medium,
    fontSize: 14,
    minHeight: 60,
    marginBottom: spacing.medium,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.small,
  },
  cancelModalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: colors.ivory4,
    alignItems: 'center',
  },
  cancelModalText: {
    color: colors.orangeShade6,
    fontWeight: '600',
  },
  sendOfferButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  sendOfferText: {
    color: '#fff',
    fontWeight: '700',
  },
});

export default DriverBookingScreen;
