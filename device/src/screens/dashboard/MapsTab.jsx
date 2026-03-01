import React, { useEffect, useState, useMemo, useRef } from "react";
import { StyleSheet, View, TouchableOpacity, Text, Modal, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { colors, spacing } from '../../components/common/theme';
import TrackingMap from '../../components/home/TrackingMap';
import QueueCard from '../../components/home/QueueCard';
import { ActiveTripOverlay } from '../../components/booking';
import { useSafeBooking } from '../../context/BookingContext';
import { useAsyncSQLiteContext } from '../../utils/asyncSQliteProvider';
import { getToken } from '../../utils/jwtStorage';
import { getUserCredentials } from '../../utils/userStorage';
import { getCodingDayStatus, getCodingDayName } from '../../utils/codingDayUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../utils/config';

const BACKEND = API_URL;
const KM_KEY = 'vehicle_current_km_v1';

const MapsTab = () => {
  const isFocused = useIsFocused();
  const navigation = useNavigation();
  const db = useAsyncSQLiteContext();
  const trackingMapRef = useRef(null);
  
  // Booking context for active trip overlay (safely handles operators without BookingProvider)
  const { 
    activeBooking, 
    isPickedUp, 
    distanceToPickup, 
    distanceToDestination,
    driverArrivedAt,
    noShowWaitMinutes,
    bookingRoute,
    isRerouting,
    confirmPickup,
    completeTrip,
    cancelTrip,
    markDriverArrived,
    markNoShow,
    passengerCancelledBooking,
    acknowledgeCancellation,
  } = useSafeBooking();
  
  const [user, setUser] = useState(null);
  const [assignedTricycle, setAssignedTricycle] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [queueVisible, setQueueVisible] = useState(false);
  const [odometerSeed, setOdometerSeed] = useState(null);

  // Calculate coding day status based on assigned tricycle
  const codingDayStatus = useMemo(() => {
    if (!assignedTricycle) return null;
    
    // Debug logging - remove after testing
    console.log('=== CODING DAY DEBUG ===');
    console.log('Assigned Tricycle:', assignedTricycle?.plateNumber);
    console.log('Coding Day Value:', assignedTricycle?.codingDay);
    console.log('Coding Day Type:', typeof assignedTricycle?.codingDay);
    console.log('Today (getDay):', new Date().getDay());
    console.log('========================');
    
    return getCodingDayStatus(assignedTricycle.codingDay);
  }, [assignedTricycle]);

  useEffect(() => {
    if (db) {
      bootstrap();
    }
  }, [db]);

  const bootstrap = async () => {
    try {
      const creds = await getUserCredentials();
      setUser(creds);
      const token = await getToken(db);
      if (!token) {
        setAuthToken(null);
        setAssignedTricycle(null);
        return;
      }
      setAuthToken(token);

      const res = await fetch(`${BACKEND}/api/tricycles`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (res.ok && json.success && Array.isArray(json.data) && json.data.length) {
        const trike = json.data[0];
        setAssignedTricycle(trike);

        // Sync odometer like DashboardTab
        const storedTrikeId = await AsyncStorage.getItem('active_tricycle_id');
        const serverOdo = trike.currentOdometer || 0;
        setOdometerSeed(serverOdo);

        if (storedTrikeId !== trike._id) {
          await AsyncStorage.setItem('active_tricycle_id', trike._id);
          await AsyncStorage.setItem(KM_KEY, String(serverOdo));
        } else {
          const localKm = await AsyncStorage.getItem(KM_KEY);
          const localVal = localKm ? parseFloat(localKm) : 0;
          if (serverOdo > localVal) {
            await AsyncStorage.setItem(KM_KEY, String(serverOdo));
          }
        }
      } else {
        setAssignedTricycle(null);
        setOdometerSeed(null);
        await AsyncStorage.removeItem('active_tricycle_id');
        await AsyncStorage.removeItem(KM_KEY);
      }
    } catch (e) {
      console.warn('maps bootstrap error', e);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Coding Day Warning Banner */}
      {codingDayStatus && codingDayStatus.isCodingDay && (
        <View style={styles.codingDayBanner}>
          <View style={styles.codingDayContent}>
            <Ionicons name="warning" size={24} color="#fff" />
            <View style={styles.codingDayTextContainer}>
              <Text style={styles.codingDayTitle}>🚫 Coding Day - Cannot Operate</Text>
              <Text style={styles.codingDayMessage}>
                Today is {getCodingDayName(assignedTricycle?.codingDay)}. You cannot drive this tricycle today.
              </Text>
              <Text style={styles.codingDaySubtext}>
                {codingDayStatus.hoursRemaining} hour{codingDayStatus.hoursRemaining !== 1 ? 's' : ''} until coding ends
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Coding Day Reminder (not today) */}
      {codingDayStatus && !codingDayStatus.isCodingDay && codingDayStatus.severity === 'warning' && (
        <View style={styles.codingDayReminder}>
          <Ionicons name="calendar" size={18} color="#856404" />
          <Text style={styles.codingDayReminderText}>
            Reminder: Tomorrow is your coding day ({getCodingDayName(assignedTricycle?.codingDay)})
          </Text>
        </View>
      )}

      {/* Always keep TrackingMap mounted so recording/tracking stays alive across tab switches.
           isVisible controls whether MapView renders (prevents multiple MapView crashes). */}
      <TrackingMap
        ref={trackingMapRef}
        odometerSeed={odometerSeed}
        codingDayRestricted={codingDayStatus?.isCodingDay || false}
        isVisible={isFocused}
        activeBooking={activeBooking}
        bookingRoute={bookingRoute}
        isPickedUp={isPickedUp}
        isRerouting={isRerouting}
        onQueuePress={() => setQueueVisible(true)}
        onEnterTerminalZone={(terminal) => {
          // Don't allow queue actions on coding day
          if (codingDayStatus?.isCodingDay) {
            Alert.alert(
              'Coding Day Restriction',
              'You cannot join the queue on your coding day.',
              [{ text: 'OK' }]
            );
            return;
          }
          Alert.alert(
            'Terminal zone',
            `You are in ${terminal.name}. Join the queue.`,
            [
              { text: 'Close' },
              { text: 'Open queue', onPress: () => setQueueVisible(true) },
            ]
          );
        }}
      />

      {/* Active Trip Overlay - shows when driver has accepted a booking */}
      {activeBooking && (
        <ActiveTripOverlay
          booking={activeBooking}
          isPickedUp={isPickedUp}
          distanceToPickup={distanceToPickup}
          distanceToDestination={distanceToDestination}
          driverArrivedAt={driverArrivedAt}
          noShowWaitMinutes={noShowWaitMinutes}
          onConfirmPickup={confirmPickup}
          onCompleteTrip={completeTrip}
          onMarkArrived={markDriverArrived}
          onMarkNoShow={markNoShow}
          onCancelTrip={() => {
            // Add confirmation dialog before cancel
            Alert.alert(
              'Cancel Trip',
              'Are you sure you want to cancel this trip?',
              [
                { text: 'No', style: 'cancel' },
                { text: 'Yes, Cancel', style: 'destructive', onPress: cancelTrip },
              ]
            );
          }}
          onBackToBookings={() => {
            // Navigate back to Trips tab
            navigation.navigate('Trips');
          }}
        />
      )}

      <Modal
        visible={queueVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setQueueVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Terminal Queue</Text>
              <TouchableOpacity onPress={() => setQueueVisible(false)}>
                <Ionicons name="close" size={22} color={colors.orangeShade7} />
              </TouchableOpacity>
            </View>
            <QueueCard
              token={assignedTricycle ? authToken : null}
              BACKEND={BACKEND}
              assignedTricycle={assignedTricycle}
              userId={user?._id || user?.id}
            />
          </View>
        </View>
      </Modal>

      {/* Passenger Cancellation Modal */}
      <Modal
        visible={!!passengerCancelledBooking}
        animationType="fade"
        transparent
        onRequestClose={() => {}}
      >
        <View style={styles.cancelModalOverlay}>
          <View style={styles.cancelModalContent}>
            <View style={styles.cancelModalIcon}>
              <Ionicons name="close-circle" size={60} color="#dc3545" />
            </View>
            <Text style={styles.cancelModalTitle}>Booking Cancelled</Text>
            <Text style={styles.cancelModalMessage}>
              {passengerCancelledBooking?.passengerName || 'The passenger'} has cancelled the ride.
            </Text>
            <TouchableOpacity
              style={styles.cancelModalButton}
              onPress={acknowledgeCancellation}
            >
              <Text style={styles.cancelModalButtonText}>OK, Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default MapsTab;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  codingDayBanner: {
    backgroundColor: '#dc3545',
    padding: spacing.medium,
    zIndex: 10,
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
    fontSize: 16,
    fontWeight: 'bold',
  },
  codingDayMessage: {
    color: '#fff',
    fontSize: 13,
    marginTop: 2,
  },
  codingDaySubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 4,
  },
  codingDayReminder: {
    backgroundColor: '#fff3cd',
    padding: spacing.small,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  codingDayReminderText: {
    color: '#856404',
    fontSize: 13,
    marginLeft: spacing.small,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    padding: spacing.large,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 8,
    elevation: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.medium,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },

  // Passenger Cancellation Modal
  cancelModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.large,
  },
  cancelModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: spacing.large,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 10,
  },
  cancelModalIcon: {
    marginBottom: spacing.medium,
  },
  cancelModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#dc3545',
    marginBottom: spacing.small,
    textAlign: 'center',
  },
  cancelModalMessage: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    marginBottom: spacing.large,
    lineHeight: 22,
  },
  cancelModalButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  cancelModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
