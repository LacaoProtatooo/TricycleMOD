/**
 * ActiveTripOverlay.jsx - Right-side drawer overlay for active trip on Maps tab
 * 
 * Slides in from the right edge. A tab handle on the left edge lets the driver
 * swipe or tap to open/close the drawer, just like a navigation drawer.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Animated, PanResponder, Dimensions, ScrollView } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors, spacing } from '../common/theme';
import { formatDistance } from '../../utils/routeService';

const { width: SCREEN_W } = Dimensions.get('window');
const DRAWER_WIDTH = 280;
// When open the drawer sits flush on the right; when closed it's off-screen
// except for a small tab handle that peeks out.
const TAB_WIDTH = 36;

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
  routeCoordinates,
}) => {
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [canMarkNoShow, setCanMarkNoShow] = useState(false);

  

  // Drawer open/close: translateX animated between 0 (open) and DRAWER_WIDTH (closed)
  const drawerOpen = useRef(false);
  const translateX = useRef(new Animated.Value(DRAWER_WIDTH)).current; // start closed

  const openDrawer = useCallback(() => {
    drawerOpen.current = true;
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
      speed: 14,
    }).start();
  }, [translateX]);

  const closeDrawer = useCallback(() => {
    drawerOpen.current = false;
    Animated.spring(translateX, {
      toValue: DRAWER_WIDTH,
      useNativeDriver: true,
      bounciness: 4,
      speed: 14,
    }).start();
  }, [translateX]);

  const toggleDrawer = useCallback(() => {
    if (drawerOpen.current) closeDrawer();
    else openDrawer();
  }, [openDrawer, closeDrawer]);

  // Swipe PanResponder on the tab handle — horizontal swipe to open/close
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8,
      onPanResponderGrant: () => {
        translateX.setOffset(translateX._value);
        translateX.setValue(0);
      },
      onPanResponderMove: (_, g) => {
        // Clamp between 0 (fully open) and DRAWER_WIDTH (fully closed)
        const newVal = Math.max(0, Math.min(DRAWER_WIDTH, g.dx));
        translateX.setValue(newVal);
      },
      onPanResponderRelease: (_, g) => {
        translateX.flattenOffset();
        // If swiped right past threshold or has rightward velocity → close
        if (g.dx > DRAWER_WIDTH * 0.3 || g.vx > 0.5) {
          closeDrawer();
        } else {
          openDrawer();
        }
      },
    })
  ).current;

  // Auto-open when booking first appears
  useEffect(() => {
    if (booking) {
      const timer = setTimeout(openDrawer, 300);
      return () => clearTimeout(timer);
    }
  }, [booking, openDrawer]);

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
    <Animated.View
      style={[
        styles.drawerWrapper,
        { transform: [{ translateX }] },
      ]}
    >
      {/* Tab handle on the left edge — always visible, swipeable */}
      <View {...panResponder.panHandlers} style={styles.tabHandle}>
        <TouchableOpacity onPress={toggleDrawer} activeOpacity={0.8} style={styles.tabTouchable}>
          <Ionicons
            name={drawerOpen.current ? 'chevron-forward' : 'chevron-back'}
            size={16}
            color="#fff"
          />
          <View style={styles.tabIconContainer}>
            <Ionicons name="car-outline" size={16} color="#fff" />
          </View>
          <Text style={styles.tabLabel}>Booking</Text>
        </TouchableOpacity>
      </View>

      {/* Drawer content panel */}
      <ScrollView style={styles.drawerPanel} contentContainerStyle={styles.drawerContent} showsVerticalScrollIndicator={false}>
        {/* Status badge + cancel */}
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, isPickedUp ? styles.statusInProgress : styles.statusPickup]}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>
              {isPickedUp ? 'Trip In Progress' : 'Go to Pickup'}
            </Text>
          </View>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancelTrip}>
            <Ionicons name="close" size={18} color="#dc3545" />
          </TouchableOpacity>
        </View>

        {/* Passenger info */}
        <View style={styles.passengerRow}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={16} color="#fff" />
          </View>
          <View style={styles.passengerInfo}>
            <Text style={styles.passengerName}>{passengerName}</Text>
            <Text style={styles.fare}>
              ₱{booking.agreedFare || booking.preferredFare}
            </Text>
          </View>
        </View>

        {/* Distance info */}
        <View style={styles.distanceRow}>
          {!isPickedUp && distanceToPickup !== null && (
            <View style={styles.distanceItem}>
              <Ionicons name="person" size={14} color="#28a745" />
              <Text style={styles.distanceLabel}>Pickup:</Text>
              <Text style={[styles.distanceValue, canPickup && styles.distanceNear]}>
                {formatDistance(distanceToPickup)}
              </Text>
            </View>
          )}
          {distanceToDestination !== null && (
            <View style={styles.distanceItem}>
              <Ionicons name="flag" size={14} color={colors.primary} />
              <Text style={styles.distanceLabel}>Dest:</Text>
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
              {!hasArrived && (
                <TouchableOpacity
                  style={[styles.primaryBtn, styles.arrivedBtn, !canMarkArrival && styles.btnDisabled]}
                  onPress={handleMarkArrived}
                >
                  <Ionicons name="location" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>I've Arrived</Text>
                </TouchableOpacity>
              )}

              {hasArrived && !canMarkNoShow && (
                <View style={styles.waitingContainer}>
                  <View style={styles.waitingInfo}>
                    <Ionicons name="time" size={20} color="#f57c00" />
                    <View style={styles.waitingTextContainer}>
                      <Text style={styles.waitingTitle}>Waiting for Passenger</Text>
                      <Text style={styles.waitingCountdown}>
                        No-show in: {formatTimeRemaining(timeRemaining)}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.primaryBtn, styles.pickupBtn, !canPickup && styles.btnDisabled]}
                    onPress={handlePickup}
                  >
                    <Ionicons name="enter-outline" size={18} color="#fff" />
                    <Text style={styles.primaryBtnText}>Confirm Pickup</Text>
                  </TouchableOpacity>
                </View>
              )}

              {hasArrived && canMarkNoShow && (
                <View style={styles.noShowContainer}>
                  <Text style={styles.noShowExpiredText}>
                    Wait expired. No-show?
                  </Text>
                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[styles.secondaryBtn, styles.noShowBtn]}
                      onPress={handleMarkNoShow}
                    >
                      <Ionicons name="person-remove" size={16} color="#dc3545" />
                      <Text style={styles.noShowBtnText}>No-Show</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.primaryBtn, styles.pickupBtn, styles.flexBtn, !canPickup && styles.btnDisabled]}
                      onPress={handlePickup}
                    >
                      <Ionicons name="enter-outline" size={18} color="#fff" />
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
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Complete Trip</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Helper text */}
        {!isPickedUp && !hasArrived && !canMarkArrival && (
          <Text style={styles.helperText}>
            Get within {ARRIVAL_RADIUS_METERS}m of pickup to mark arrival
          </Text>
        )}
        {!isPickedUp && hasArrived && !canPickup && (
          <Text style={styles.helperText}>
            Get within {PICKUP_RADIUS_METERS}m to confirm pickup
          </Text>
        )}
        {isPickedUp && !canComplete && (
          <Text style={styles.helperText}>
            Must be within {COMPLETION_RADIUS_METERS}m of destination
          </Text>
        )}

        {/* DEV-only simulator removed */}

        {/* Back to bookings button */}
        <TouchableOpacity style={styles.backBtn} onPress={onBackToBookings}>
          <Ionicons name="list-outline" size={16} color={colors.primary} />
          <Text style={styles.backBtnText}>Bookings</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* TripSimulator removed */}
    </Animated.View>
  );
};

export default ActiveTripOverlay;

const styles = StyleSheet.create({
  // The whole drawer sits at the right edge, extends full height
  drawerWrapper: {
    position: 'absolute',
    top: 60,
    right: 0,
    bottom: 120,
    flexDirection: 'row',
    zIndex: 100,
  },
  // Tab handle that peeks out on the left side of the drawer
  tabHandle: {
    width: TAB_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabTouchable: {
    backgroundColor: colors.primary,
    width: TAB_WIDTH,
    paddingVertical: 14,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: -2, height: 0 },
    shadowRadius: 4,
    elevation: 6,
  },
  tabIconContainer: {
    marginVertical: 4,
  },
  tabLabel: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  // The actual drawer panel
  drawerPanel: {
    width: DRAWER_WIDTH,
    backgroundColor: '#fff',
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: -3, height: 0 },
    shadowRadius: 10,
    elevation: 8,
  },
  drawerContent: {
    padding: 12,
    paddingBottom: 20,
  },
  // Status row
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
    padding: 4,
  },
  // Passenger
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passengerInfo: {
    marginLeft: 10,
    flex: 1,
  },
  passengerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  fare: {
    fontSize: 13,
    color: '#28a745',
    fontWeight: '500',
    marginTop: 1,
  },
  // Distance
  distanceRow: {
    flexDirection: 'column',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    gap: 4,
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
  // Actions
  actionsRow: {
    marginTop: 6,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  pickupBtn: {
    backgroundColor: '#28a745',
  },
  completeBtn: {
    backgroundColor: colors.primary,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
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
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  backBtnText: {
    fontSize: 12,
    color: colors.primary,
    marginLeft: 4,
  },
  // No-show / waiting
  arrivedBtn: {
    backgroundColor: '#17a2b8',
  },
  waitingContainer: {
    gap: 8,
  },
  waitingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    padding: 10,
  },
  waitingTextContainer: {
    marginLeft: 10,
    flex: 1,
  },
  waitingTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e65100',
  },
  waitingCountdown: {
    fontSize: 12,
    color: '#f57c00',
    marginTop: 2,
  },
  noShowContainer: {
    gap: 8,
  },
  noShowExpiredText: {
    fontSize: 12,
    color: '#dc3545',
    textAlign: 'center',
    marginBottom: 6,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  noShowBtn: {
    borderColor: '#dc3545',
    backgroundColor: '#fff',
  },
  noShowBtnText: {
    color: '#dc3545',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  flexBtn: {
    flex: 1,
  },
  // DEV-only simulator button
  simBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6f42c1',
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  simBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
});
