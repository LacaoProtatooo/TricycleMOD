/**
 * BookingHistoryDetail.jsx - Booking History Details Screen
 *
 * Shows detailed information about a booking for both users and drivers
 * - Trip locations and route on map
 * - Fare details
 * - Status timeline
 * - Rating information
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import axios from 'axios';

import { colors, spacing } from '../../components/common/theme';
import { getToken } from '../../utils/jwtStorage';
import { useAsyncSQLiteContext } from '../../utils/asyncSQliteProvider';
import { API_URL as BACKEND_URL } from '../../utils/config';

const API_URL = `${BACKEND_URL}/api/booking`;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const BookingHistoryDetail = ({ navigation, route }) => {
  const db = useAsyncSQLiteContext();
  const { bookingId, isDriver } = route.params || {};
  const mapRef = useRef(null);
  
  const { user } = useSelector((state) => state.auth);
  
  const [booking, setBooking] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBookingDetails();
  }, [bookingId]);

  const fetchBookingDetails = async () => {
    if (!bookingId) {
      setError('No booking ID provided');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const token = await getToken(db);
      
      if (!token) {
        setError('Authentication required');
        setIsLoading(false);
        return;
      }

      const response = await axios.get(
        `${API_URL}/${bookingId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setBooking(response.data.booking);
        // Fit map to show both markers
        setTimeout(() => fitMapToMarkers(response.data.booking), 500);
      } else {
        setError('Failed to load booking details');
      }
    } catch (err) {
      console.error('Error fetching booking details:', err);
      setError(err.response?.data?.message || 'Failed to load booking details');
    } finally {
      setIsLoading(false);
    }
  };

  const fitMapToMarkers = (bookingData) => {
    if (mapRef.current && bookingData?.pickup && bookingData?.destination) {
      mapRef.current.fitToCoordinates(
        [bookingData.pickup, bookingData.destination],
        {
          edgePadding: { top: 80, right: 50, bottom: 80, left: 50 },
          animated: true,
        }
      );
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDistance = (meters) => {
    if (!meters) return 'N/A';
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${Math.round(meters)} m`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return '#28a745';
      case 'cancelled':
      case 'expired':
        return '#dc3545';
      case 'in_progress':
      case 'accepted':
        return colors.primary;
      case 'offer_made':
        return '#ffc107';
      default:
        return '#6c757d';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return 'checkmark-circle';
      case 'cancelled':
        return 'close-circle';
      case 'expired':
        return 'time';
      case 'in_progress':
        return 'navigate';
      case 'accepted':
        return 'thumbs-up';
      case 'offer_made':
        return 'pricetag';
      default:
        return 'hourglass';
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={20}
          color={i <= rating ? '#ffc107' : '#ccc'}
          style={{ marginRight: 2 }}
        />
      );
    }
    return stars;
  };

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading booking details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error || !booking) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.orangeShade7 || '#333'} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Booking Details</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={60} color="#dc3545" />
          <Text style={styles.errorText}>{error || 'Booking not found'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchBookingDetails}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const otherParty = isDriver ? booking.user : booking.driver;
  const otherPartyLabel = isDriver ? 'Passenger' : 'Driver';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.orangeShade7 || '#333'} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Details</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Map */}
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={{
              latitude: booking.pickup?.latitude || 14.5176,
              longitude: booking.pickup?.longitude || 121.0509,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
          >
            {/* Pickup marker */}
            <Marker
              coordinate={booking.pickup}
              title="Pickup"
              description={booking.pickup?.address || 'Pickup location'}
            >
              <View style={styles.pickupMarker}>
                <Ionicons name="location" size={16} color="#fff" />
              </View>
            </Marker>

            {/* Destination marker */}
            <Marker
              coordinate={booking.destination}
              title="Destination"
              description={booking.destination?.address || 'Destination'}
            >
              <View style={styles.destinationMarker}>
                <Ionicons name="flag" size={16} color="#fff" />
              </View>
            </Marker>

            {/* Route line */}
            <Polyline
              coordinates={[booking.pickup, booking.destination]}
              strokeColor={colors.primary}
              strokeWidth={4}
              lineDashPattern={[10, 5]}
            />
          </MapView>
        </View>

        {/* Status Badge */}
        <View style={styles.statusSection}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) }]}>
            <Ionicons name={getStatusIcon(booking.status)} size={18} color="#fff" />
            <Text style={styles.statusText}>
              {(booking.status || 'unknown').replace('_', ' ').toUpperCase()}
            </Text>
          </View>
          <Text style={styles.bookingId}>ID: {booking._id?.slice(-8) || 'N/A'}</Text>
        </View>

        {/* Other Party Info */}
        {otherParty && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="person" size={20} color={colors.primary} />
              <Text style={styles.cardTitle}>{otherPartyLabel} Information</Text>
            </View>
            <View style={styles.partyInfo}>
              <View style={styles.avatarCircle}>
                <Ionicons name="person" size={24} color="#fff" />
              </View>
              <View style={styles.partyDetails}>
                <Text style={styles.partyName}>
                  {otherParty.firstname || 'Unknown'} {otherParty.lastname || ''}
                </Text>
                {otherParty.phone && (
                  <Text style={styles.partyPhone}>{otherParty.phone}</Text>
                )}
                {otherParty.rating && (
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={14} color="#ffc107" />
                    <Text style={styles.ratingValue}>{otherParty.rating.toFixed(1)}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Location Details */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="map" size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>Trip Locations</Text>
          </View>
          
          <View style={styles.locationRow}>
            <View style={styles.locationIcon}>
              <View style={[styles.locationDot, { backgroundColor: '#28a745' }]} />
            </View>
            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>Pickup</Text>
              <Text style={styles.locationAddress}>
                {booking.pickup?.address || `${booking.pickup?.latitude?.toFixed(6)}, ${booking.pickup?.longitude?.toFixed(6)}`}
              </Text>
            </View>
          </View>

          <View style={styles.locationDivider} />

          <View style={styles.locationRow}>
            <View style={styles.locationIcon}>
              <View style={[styles.locationDot, { backgroundColor: colors.primary }]} />
            </View>
            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>Destination</Text>
              <Text style={styles.locationAddress}>
                {booking.destination?.address || `${booking.destination?.latitude?.toFixed(6)}, ${booking.destination?.longitude?.toFixed(6)}`}
              </Text>
            </View>
          </View>
        </View>

        {/* Fare Details */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="cash" size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>Fare Details</Text>
          </View>
          
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Requested Fare</Text>
            <Text style={styles.fareValue}>₱{booking.preferredFare || 0}</Text>
          </View>

          {booking.driverOffer?.amount ? (
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>Driver's Offer</Text>
              <Text style={styles.fareValue}>₱{booking.driverOffer.amount}</Text>
            </View>
          ) : null}

          {booking.agreedFare ? (
            <View style={[styles.fareRow, styles.totalFareRow]}>
              <Text style={styles.totalFareLabel}>Final Fare</Text>
              <Text style={styles.totalFareValue}>₱{booking.agreedFare}</Text>
            </View>
          ) : null}
        </View>

        {/* Distance Info */}
        {(booking.estimatedDistance || booking.actualDistance) && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="speedometer" size={20} color={colors.primary} />
              <Text style={styles.cardTitle}>Distance</Text>
            </View>
            
            {booking.estimatedDistance && (
              <View style={styles.fareRow}>
                <Text style={styles.fareLabel}>Estimated Distance</Text>
                <Text style={styles.fareValue}>{formatDistance(booking.estimatedDistance)}</Text>
              </View>
            )}

            {booking.actualDistance && (
              <View style={styles.fareRow}>
                <Text style={styles.fareLabel}>Actual Distance</Text>
                <Text style={styles.fareValue}>{formatDistance(booking.actualDistance)}</Text>
              </View>
            )}
          </View>
        )}

        {/* Timeline */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="time" size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>Timeline</Text>
          </View>
          
          <View style={styles.timelineItem}>
            <View style={styles.timelineDot} />
            <View style={styles.timelineContent}>
              <Text style={styles.timelineLabel}>Booking Created</Text>
              <Text style={styles.timelineDate}>{formatDate(booking.createdAt)}</Text>
            </View>
          </View>

          {booking.acceptedAt && (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: '#28a745' }]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineLabel}>Accepted</Text>
                <Text style={styles.timelineDate}>{formatDate(booking.acceptedAt)}</Text>
              </View>
            </View>
          )}

          {booking.startedAt && (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineLabel}>Trip Started</Text>
                <Text style={styles.timelineDate}>{formatDate(booking.startedAt)}</Text>
              </View>
            </View>
          )}

          {booking.completedAt && (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: '#28a745' }]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineLabel}>Trip Completed</Text>
                <Text style={styles.timelineDate}>{formatDate(booking.completedAt)}</Text>
              </View>
            </View>
          )}

          {booking.cancelledAt && (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: '#dc3545' }]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineLabel}>Cancelled</Text>
                <Text style={styles.timelineDate}>{formatDate(booking.cancelledAt)}</Text>
                {booking.cancellationReason && (
                  <Text style={styles.cancelReason}>Reason: {booking.cancellationReason}</Text>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Rating (if completed and rated) */}
        {booking.status === 'completed' && booking.rating ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="star" size={20} color={colors.primary} />
              <Text style={styles.cardTitle}>Rating</Text>
            </View>
            
            <View style={styles.ratingSection}>
              <View style={styles.starsRow}>
                {renderStars(booking.rating)}
              </View>
              <Text style={styles.ratingNumber}>{booking.rating}/5</Text>
            </View>

            {booking.ratingComment ? (
              <View style={styles.commentSection}>
                <Text style={styles.commentLabel}>Comment:</Text>
                <Text style={styles.commentText}>{booking.ratingComment}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Driver's Message (if any) */}
        {booking.driverOffer?.message ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="chatbubble" size={20} color={colors.primary} />
              <Text style={styles.cardTitle}>Driver's Message</Text>
            </View>
            <Text style={styles.messageText}>{booking.driverOffer.message}</Text>
          </View>
        ) : null}

        {/* Bottom spacing */}
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#dc3545',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.medium || 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.ivory3 || '#E8E8E8',
    backgroundColor: '#fff',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.orangeShade7 || '#333',
  },
  headerRight: {
    width: 40,
  },

  // Content
  content: {
    flex: 1,
  },

  // Map
  mapContainer: {
    height: 200,
    margin: spacing.medium || 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  map: {
    flex: 1,
  },
  pickupMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#28a745',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  destinationMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },

  // Status Section
  statusSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.medium || 16,
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  statusText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  bookingId: {
    fontSize: 12,
    color: '#999',
  },

  // Card
  card: {
    backgroundColor: '#fff',
    marginHorizontal: spacing.medium || 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.orangeShade7 || '#333',
  },

  // Party Info
  partyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  partyDetails: {
    marginLeft: 14,
  },
  partyName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.orangeShade7 || '#333',
  },
  partyPhone: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingValue: {
    fontSize: 13,
    color: '#666',
    marginLeft: 4,
  },

  // Location
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationIcon: {
    width: 24,
    alignItems: 'center',
    marginTop: 4,
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  locationInfo: {
    flex: 1,
    marginLeft: 12,
  },
  locationLabel: {
    fontSize: 12,
    color: '#999',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  locationAddress: {
    fontSize: 14,
    color: colors.orangeShade7 || '#333',
    marginTop: 4,
    lineHeight: 20,
  },
  locationDivider: {
    width: 2,
    height: 24,
    backgroundColor: colors.ivory3 || '#E8E8E8',
    marginLeft: 11,
    marginVertical: 8,
  },

  // Fare
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.ivory2 || '#F5F5F5',
  },
  fareLabel: {
    fontSize: 14,
    color: '#666',
  },
  fareValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.orangeShade7 || '#333',
  },
  totalFareRow: {
    borderBottomWidth: 0,
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: colors.primary,
  },
  totalFareLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.orangeShade7 || '#333',
  },
  totalFareValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },

  // Timeline
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.orangeShade4 || '#ccc',
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    marginLeft: 12,
  },
  timelineLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.orangeShade7 || '#333',
  },
  timelineDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  cancelReason: {
    fontSize: 12,
    color: '#dc3545',
    marginTop: 4,
    fontStyle: 'italic',
  },

  // Rating
  ratingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  starsRow: {
    flexDirection: 'row',
  },
  ratingNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.orangeShade7 || '#333',
    marginLeft: 12,
  },
  commentSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.ivory2 || '#F5F5F5',
  },
  commentLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  commentText: {
    fontSize: 14,
    color: colors.orangeShade6 || '#555',
    lineHeight: 20,
    fontStyle: 'italic',
  },

  // Message
  messageText: {
    fontSize: 14,
    color: colors.orangeShade6 || '#555',
    lineHeight: 20,
    fontStyle: 'italic',
  },
});

export default BookingHistoryDetail;
