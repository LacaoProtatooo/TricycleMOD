/**
 * BookingCard.jsx - Single booking request card for the list view
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors, spacing } from '../common/theme';
import { formatDistance, getRoute } from '../../utils/routeService';

const BookingCard = ({
  booking,
  userLocation,
  onAccept,
  onCounterOffer,
  onPreview,
  disabled = false,
}) => {
  // Calculate distance from driver to pickup
  const calculateDistanceToPickup = () => {
    if (!userLocation || !booking.pickup) return null;
    
    const R = 6371e3; // Earth radius in meters
    const φ1 = (userLocation.latitude * Math.PI) / 180;
    const φ2 = (booking.pickup.latitude * Math.PI) / 180;
    const Δφ = ((booking.pickup.latitude - userLocation.latitude) * Math.PI) / 180;
    const Δλ = ((booking.pickup.longitude - userLocation.longitude) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) ** 2 + 
              Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const distanceToPickup = calculateDistanceToPickup();
  const passengerName = booking.user?.firstname 
    ? `${booking.user.firstname} ${booking.user.lastname || ''}`.trim()
    : 'Passenger';

  // Fetch actual road route on mount
  const [routeCoords, setRouteCoords] = useState([]);
  const mapRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const fetchRoute = async () => {
      if (!booking?.pickup || !booking?.destination) return;
      try {
        const result = await getRoute(booking.pickup, booking.destination);
        if (cancelled) return;
        if (result?.success && result?.route?.coordinates?.length > 1) {
          setRouteCoords(result.route.coordinates);
        } else if (result?.fallback?.coordinates?.length > 0) {
          setRouteCoords(result.fallback.coordinates);
        } else {
          setRouteCoords([booking.pickup, booking.destination]);
        }
      } catch {
        if (!cancelled) setRouteCoords([booking.pickup, booking.destination]);
      }
    };
    fetchRoute();
    return () => { cancelled = true; };
  }, [booking?.pickup?.latitude, booking?.pickup?.longitude, booking?.destination?.latitude, booking?.destination?.longitude]);

  return (
    <View style={styles.card}>
      {/* Header row with passenger info */}
      <View style={styles.headerRow}>
        <View style={styles.passengerInfo}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={16} color="#fff" />
          </View>
          <View style={styles.passengerDetails}>
            <Text style={styles.passengerName}>{passengerName}</Text>
            {booking.user?.rating > 0 && (
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={12} color="#ffc107" />
                <Text style={styles.ratingText}>{booking.user.rating.toFixed(1)}</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={styles.fare}>₱{booking.preferredFare}</Text>
      </View>

      {/* Location details */}
      <View style={styles.detailsContainer}>
        <View style={styles.detailRow}>
          <Ionicons name="location" size={16} color="#28a745" />
          <Text style={styles.detailText} numberOfLines={1}>
            {booking.pickup?.address || 'Pickup location'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="flag" size={16} color={colors.primary} />
          <Text style={styles.detailText} numberOfLines={1}>
            {booking.destination?.address || 'Destination'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="navigate-outline" size={16} color="#6c757d" />
          <Text style={styles.detailText}>
            {distanceToPickup 
              ? `${formatDistance(distanceToPickup)} away`
              : 'Calculating distance...'}
          </Text>
        </View>
        {booking.estimatedDistance && (
          <View style={styles.detailRow}>
            <Ionicons name="car-outline" size={16} color="#6c757d" />
            <Text style={styles.detailText}>
              Est. trip: {formatDistance(booking.estimatedDistance)}
            </Text>
          </View>
        )}
      </View>

      {/* Inline Route Map */}
      {booking.pickup && booking.destination && (
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.inlineMap}
            initialRegion={{
              latitude: (booking.pickup.latitude + booking.destination.latitude) / 2,
              longitude: (booking.pickup.longitude + booking.destination.longitude) / 2,
              latitudeDelta: Math.max(Math.abs(booking.pickup.latitude - booking.destination.latitude) * 2.2, 0.015),
              longitudeDelta: Math.max(Math.abs(booking.pickup.longitude - booking.destination.longitude) * 2.2, 0.015),
            }}
            onMapReady={() => {
              if (routeCoords.length > 1 && mapRef.current) {
                mapRef.current.fitToCoordinates(routeCoords, {
                  edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
                  animated: false,
                });
              }
            }}
            scrollEnabled={true}
            zoomEnabled={true}
            rotateEnabled={false}
            pitchEnabled={false}
            toolbarEnabled={false}
          >
            <Marker
              coordinate={booking.pickup}
              title="Pickup"
              pinColor="green"
            />
            <Marker
              coordinate={booking.destination}
              title="Destination"
              pinColor="orange"
            />
            {routeCoords.length > 1 && (
              <Polyline
                coordinates={routeCoords}
                strokeColor="#2196F3"
                strokeWidth={3}
              />
            )}
          </MapView>
          {/* Labels */}
          <View style={styles.mapLabelPickup}>
            <View style={[styles.mapLabelDot, { backgroundColor: '#28a745' }]} />
            <Text style={styles.mapLabelText}>Pickup</Text>
          </View>
          <View style={styles.mapLabelDest}>
            <View style={[styles.mapLabelDot, { backgroundColor: colors.primary }]} />
            <Text style={styles.mapLabelText}>Destination</Text>
          </View>
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.acceptBtn, disabled && styles.btnDisabled]}
          onPress={() => onAccept(booking)}
          disabled={disabled}
        >
          <Ionicons name="checkmark" size={18} color="#fff" />
          <Text style={styles.acceptBtnText}>Accept</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.offerBtn, disabled && styles.btnDisabledOutline]}
          onPress={() => onCounterOffer(booking)}
          disabled={disabled}
        >
          <Ionicons name="cash-outline" size={18} color={colors.primary} />
          <Text style={styles.offerBtnText}>Counter</Text>
        </TouchableOpacity>

        {onPreview && (
          <TouchableOpacity
            style={styles.previewBtn}
            onPress={() => onPreview(booking)}
          >
            <Ionicons name="eye-outline" size={18} color="#6c757d" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default BookingCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: spacing.medium,
    marginBottom: spacing.medium,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.small,
  },
  passengerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    color: '#333',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  ratingText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 3,
  },
  fare: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#28a745',
  },
  detailsContainer: {
    marginVertical: spacing.small,
    paddingTop: spacing.small,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    fontSize: 13,
    color: '#555',
    marginLeft: 8,
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.small,
    paddingTop: spacing.small,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28a745',
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
  },
  acceptBtnText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
  },
  offerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  offerBtnText: {
    color: colors.primary,
    fontWeight: '600',
    marginLeft: 6,
  },
  previewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginLeft: 8,
  },
  btnDisabled: {
    backgroundColor: '#ccc',
  },
  btnDisabledOutline: {
    borderColor: '#ccc',
    opacity: 0.6,
  },
  // Inline map styles
  mapContainer: {
    height: 150,
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: spacing.small,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#e0e4ea',
    position: 'relative',
  },
  inlineMap: {
    flex: 1,
  },
  mapLabelPickup: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  mapLabelDest: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  mapLabelDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 5,
  },
  mapLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#333',
  },
});
