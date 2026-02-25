/**
 * ActiveTripOverlay.jsx - Floating card overlay for active trip on Maps tab
 * 
 * Shows passenger info, pickup/complete buttons, no-show handling, and trip status
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors, spacing } from '../common/theme';
import { formatDistance } from '../../utils/routeService';

const PICKUP_RADIUS_METERS = 50;
const COMPLETION_RADIUS_METERS = 300;
const ARRIVAL_RADIUS_METERS = 100; // Driver must be within 100m to mark arrival

const ActiveTripOverlay = ({
  booking,
  isPickedUp,
  distanceToPickup,
  distanceToDestination,
  driverArrivedAt,
  noShowWaitMinutes = 5,
  onConfirmPickup,
  onCompleteTrip,
  onCancelTrip,
  onMarkArrived,
  onMarkNoShow,
  onBackToBookings,
}) => {
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [canMarkNoShow, setCanMarkNoShow] = useState(false);

  // Countdown timer for no-show
  useEffect(() => {
    if (!driverArrivedAt || isPickedUp) {
      setTimeRemaining(null);
      setCanMarkNoShow(false);
      return;
    }

    const calculateRemaining = () => {
      const arrivedTime = new Date(driverArrivedAt).getTime();
      const waitMs = noShowWaitMinutes * 60 * 1000;
      const noShowTime = arrivedTime + waitMs;
      const now = Date.now();
      const remaining = noShowTime - now;

      if (remaining <= 0) {
        setTimeRemaining(0);
        setCanMarkNoShow(true);
      } else {
        setTimeRemaining(remaining);
        setCanMarkNoShow(false);
      }
    };

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 1000);
    
    return () => clearInterval(interval);
  }, [driverArrivedAt, noShowWaitMinutes, isPickedUp]);

  const formatTimeRemaining = (ms) => {
    if (ms === null || ms <= 0) return '0:00';
    const totalSecs = Math.ceil(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!booking) return null;

  const passengerName = booking.user?.firstname 
    ? `${booking.user.firstname} ${booking.user.lastname || ''}`.trim()
    : 'Passenger';

  const canPickup = distanceToPickup !== null && distanceToPickup <= PICKUP_RADIUS_METERS;
  const canComplete = distanceToDestination !== null && distanceToDestination <= COMPLETION_RADIUS_METERS;
  const canMarkArrival = distanceToPickup !== null && distanceToPickup <= ARRIVAL_RADIUS_METERS;
  const hasArrived = !!driverArrivedAt;

  const handlePickup = () => {
    if (!canPickup) {
      Alert.alert(
        'Too Far from Pickup',
        `You must be within ${PICKUP_RADIUS_METERS}m of the pickup location.\n\nCurrent distance: ${formatDistance(distanceToPickup)}`,
      );
      return;
    }
    onConfirmPickup();
  };

  const handleComplete = () => {
    if (!canComplete) {
      Alert.alert(
        'Not at Destination',
        `You must be within ${COMPLETION_RADIUS_METERS}m of the destination.\n\nCurrent distance: ${formatDistance(distanceToDestination)}`,
      );
      return;
    }
    onCompleteTrip();
  };

  const handleMarkArrived = () => {
    if (!canMarkArrival) {
      Alert.alert(
        'Too Far from Pickup',
        `You must be within ${ARRIVAL_RADIUS_METERS}m of the pickup location to mark arrival.\n\nCurrent distance: ${formatDistance(distanceToPickup)}`,
      );
      return;
    }
    Alert.alert(
      'Confirm Arrival',
      'Mark that you have arrived at the pickup location? The passenger will be notified.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, I\'ve Arrived', onPress: onMarkArrived },
      ]
    );
  };

  const handleMarkNoShow = () => {
    if (!canMarkNoShow) {
      Alert.alert(
        'Wait Required',
        `You must wait ${noShowWaitMinutes} minutes after arrival before marking as no-show.`,
      );
      return;
    }
    Alert.alert(
      'Mark as No-Show?',
      `The passenger will be charged a no-show fee (50% of fare: ₱${Math.round((booking.agreedFare || booking.preferredFare) * 0.5)}). This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark No-Show', style: 'destructive', onPress: onMarkNoShow },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Status badge */}
      <View style={styles.statusRow}>
        <View style={[styles.statusBadge, isPickedUp ? styles.statusInProgress : styles.statusPickup]}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>
            {isPickedUp ? 'Trip In Progress' : 'Go to Pickup'}
          </Text>
        </View>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancelTrip}>
          <Ionicons name="close" size={20} color="#dc3545" />
        </TouchableOpacity>
      </View>

      {/* Passenger info */}
      <View style={styles.passengerRow}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={18} color="#fff" />
        </View>
        <View style={styles.passengerInfo}>
          <Text style={styles.passengerName}>{passengerName}</Text>
          <Text style={styles.fare}>
            Fare: ₱{booking.agreedFare || booking.preferredFare}
          </Text>
        </View>
      </View>

      {/* Distance info */}
      <View style={styles.distanceRow}>
        {!isPickedUp && distanceToPickup !== null && (
          <View style={styles.distanceItem}>
            <Ionicons name="person" size={14} color="#28a745" />
            <Text style={styles.distanceLabel}>To Pickup:</Text>
            <Text style={[styles.distanceValue, canPickup && styles.distanceNear]}>
              {formatDistance(distanceToPickup)}
            </Text>
          </View>
        )}
        {distanceToDestination !== null && (
          <View style={styles.distanceItem}>
            <Ionicons name="flag" size={14} color={colors.primary} />
            <Text style={styles.distanceLabel}>To Destination:</Text>
            <Text style={[styles.distanceValue, isPickedUp && canComplete && styles.distanceNear]}>
              {formatDistance(distanceToDestination)}
            </Text>
          </View>
        )}
      </View>

      {/* Action buttons */}
      <View style={styles.actionsRow}>
        {!isPickedUp ? (
          <>
            {/* Show "I've Arrived" button if not yet arrived and near pickup */}
            {!hasArrived && (
              <TouchableOpacity
                style={[styles.primaryBtn, styles.arrivedBtn, !canMarkArrival && styles.btnDisabled]}
                onPress={handleMarkArrived}
              >
                <Ionicons name="location" size={20} color="#fff" />
                <Text style={styles.primaryBtnText}>I've Arrived</Text>
              </TouchableOpacity>
            )}

            {/* Show waiting status with countdown if arrived but passenger not picked up */}
            {hasArrived && !canMarkNoShow && (
              <View style={styles.waitingContainer}>
                <View style={styles.waitingInfo}>
                  <Ionicons name="time" size={24} color="#f57c00" />
                  <View style={styles.waitingTextContainer}>
                    <Text style={styles.waitingTitle}>Waiting for Passenger</Text>
                    <Text style={styles.waitingCountdown}>
                      No-show available in: {formatTimeRemaining(timeRemaining)}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.primaryBtn, styles.pickupBtn, !canPickup && styles.btnDisabled]}
                  onPress={handlePickup}
                >
                  <Ionicons name="enter-outline" size={20} color="#fff" />
                  <Text style={styles.primaryBtnText}>Confirm Pickup</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Show both pickup and no-show buttons when timer expires */}
            {hasArrived && canMarkNoShow && (
              <View style={styles.noShowContainer}>
                <Text style={styles.noShowExpiredText}>
                  Wait time expired. Passenger did not show up?
                </Text>
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.secondaryBtn, styles.noShowBtn]}
                    onPress={handleMarkNoShow}
                  >
                    <Ionicons name="person-remove" size={18} color="#dc3545" />
                    <Text style={styles.noShowBtnText}>No-Show</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.primaryBtn, styles.pickupBtn, styles.flexBtn, !canPickup && styles.btnDisabled]}
                    onPress={handlePickup}
                  >
                    <Ionicons name="enter-outline" size={20} color="#fff" />
                    <Text style={styles.primaryBtnText}>Pickup</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        ) : (
          <TouchableOpacity
            style={[styles.primaryBtn, styles.completeBtn, !canComplete && styles.btnDisabled]}
            onPress={handleComplete}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.primaryBtnText}>Complete Trip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Helper text */}
      {!isPickedUp && !hasArrived && !canMarkArrival && (
        <Text style={styles.helperText}>
          Get within {ARRIVAL_RADIUS_METERS}m of pickup location to mark arrival
        </Text>
      )}
      {!isPickedUp && hasArrived && !canPickup && (
        <Text style={styles.helperText}>
          Get within {PICKUP_RADIUS_METERS}m to confirm pickup
        </Text>
      )}
      {isPickedUp && !canComplete && (
        <Text style={styles.helperText}>
          You must be within {COMPLETION_RADIUS_METERS}m of destination to complete
        </Text>
      )}

      {/* Back to bookings button */}
      <TouchableOpacity style={styles.backBtn} onPress={onBackToBookings}>
        <Ionicons name="list-outline" size={16} color={colors.primary} />
        <Text style={styles.backBtnText}>Back to Booking List</Text>
      </TouchableOpacity>
    </View>
  );
};

export default ActiveTripOverlay;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 15,
    right: 15,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: spacing.medium,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 10,
    elevation: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.small,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPickup: {
    backgroundColor: '#e8f5e9',
  },
  statusInProgress: {
    backgroundColor: '#fff3e0',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#28a745',
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  cancelBtn: {
    padding: 6,
  },
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.small,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passengerInfo: {
    marginLeft: 12,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  fare: {
    fontSize: 14,
    color: '#28a745',
    fontWeight: '500',
    marginTop: 2,
  },
  distanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 10,
    marginBottom: spacing.small,
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
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginLeft: 4,
  },
  distanceNear: {
    color: '#28a745',
  },
  actionsRow: {
    marginTop: spacing.small,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  pickupBtn: {
    backgroundColor: '#28a745',
  },
  completeBtn: {
    backgroundColor: colors.primary,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  btnDisabled: {
    backgroundColor: '#aaa',
  },
  helperText: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    marginTop: 6,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.medium,
    paddingTop: spacing.small,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  backBtnText: {
    fontSize: 13,
    color: colors.primary,
    marginLeft: 6,
  },
  // New styles for no-show feature
  arrivedBtn: {
    backgroundColor: '#17a2b8',
  },
  waitingContainer: {
    gap: 10,
  },
  waitingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  waitingTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  waitingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e65100',
  },
  waitingCountdown: {
    fontSize: 13,
    color: '#f57c00',
    marginTop: 2,
  },
  noShowContainer: {
    gap: 10,
  },
  noShowExpiredText: {
    fontSize: 13,
    color: '#dc3545',
    textAlign: 'center',
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  noShowBtn: {
    borderColor: '#dc3545',
    backgroundColor: '#fff',
  },
  noShowBtnText: {
    color: '#dc3545',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  flexBtn: {
    flex: 1,
  },
});
