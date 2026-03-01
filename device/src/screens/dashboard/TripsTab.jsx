/**
 * TripsTab.jsx - Simplified Trips tab (list-only, no map)
 * 
 * This tab shows:
 * - Online/offline toggle
 * - Nearby booking requests as cards
 * - Pending offers
 * - Simple active trip card (no map)
 * 
 * All map-related activities happen in the Maps tab.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { colors, spacing } from '../../components/common/theme';
import { useBooking } from '../../context/BookingContext';
import {
  BookingCard,
  CodingDayBanner,
  NoTricycleBanner,
  OfflineState,
  OnlineToggle,
  PendingOfferCard,
} from '../../components/booking';

const TripsTab = () => {
  const navigation = useNavigation();
  const {
    isOnline,
    isLoading,
    isRefreshing,
    nearbyBookings,
    activeBooking,
    pendingOffers,
    userLocation,
    assignedTricycle,
    codingDayStatus,
    toggleOnlineStatus,
    acceptBooking,
    sendCounterOffer,
    cancelTrip,
    refresh,
    passengerCancelledBooking,
    acknowledgeCancellation,
  } = useBooking();

  // Counter offer modal state
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [counterOffer, setCounterOffer] = useState('');
  const [offerMessage, setOfferMessage] = useState('');

  // Handle accept booking
  const handleAcceptBooking = useCallback(async (booking) => {
    const success = await acceptBooking(booking, navigation);
    if (success) {
      // Navigation happens inside acceptBooking
    }
  }, [acceptBooking, navigation]);

  // Handle counter offer
  const handleOpenOfferModal = useCallback((booking) => {
    setSelectedBooking(booking);
    setCounterOffer(booking.preferredFare?.toString() || '');
    setOfferMessage('');
    setShowOfferModal(true);
  }, []);

  const handleSendOffer = useCallback(async () => {
    const amount = parseFloat(counterOffer);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Offer', 'Please enter a valid fare amount.');
      return;
    }

    const success = await sendCounterOffer(selectedBooking, amount, offerMessage);
    if (success) {
      setShowOfferModal(false);
      setSelectedBooking(null);
      setCounterOffer('');
      setOfferMessage('');
    }
  }, [selectedBooking, counterOffer, offerMessage, sendCounterOffer]);

  // Handle withdraw offer (placeholder - needs API)
  const handleWithdrawOffer = useCallback((bookingId) => {
    Alert.alert(
      'Withdraw Offer',
      'Are you sure you want to withdraw this offer?',
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes', onPress: () => {
          // TODO: Implement withdraw API
          Alert.alert('Withdrawn', 'Your offer has been withdrawn.');
        }},
      ]
    );
  }, []);

  // Handle cancel trip
  const handleCancelTrip = useCallback(() => {
    Alert.alert(
      'Cancel Trip',
      'Are you sure you want to cancel this trip?',
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes, Cancel', style: 'destructive', onPress: cancelTrip },
      ]
    );
  }, [cancelTrip]);

  // Navigate to Maps
  const goToMaps = useCallback(() => {
    navigation.navigate('Maps');
  }, [navigation]);

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Check if user can operate
  const canOperate = assignedTricycle && !codingDayStatus?.isCodingDay;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Banners */}
      <NoTricycleBanner visible={!assignedTricycle} />
      <CodingDayBanner 
        codingDayStatus={codingDayStatus} 
        assignedTricycle={assignedTricycle} 
      />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="bicycle" size={26} color={colors.primary} />
          <View style={styles.headerTitleSection}>
            <Text style={styles.headerTitle}>Trips</Text>
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
        <OnlineToggle
          isOnline={isOnline}
          onToggle={toggleOnlineStatus}
          disabled={!canOperate}
        />
      </View>

      {/* Active Trip Card - No map, just info + button to go to Maps */}
      {activeBooking && (
        <View style={styles.activeTripCard}>
          <View style={styles.activeTripHeader}>
            <View style={styles.activeTripBadge}>
              <View style={styles.tripStatusDot} />
              <Text style={styles.tripStatusText}>Active Trip</Text>
            </View>
            <TouchableOpacity onPress={handleCancelTrip}>
              <Ionicons name="close-circle-outline" size={24} color="#dc3545" />
            </TouchableOpacity>
          </View>

          <View style={styles.activeTripPassenger}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={18} color="#fff" />
            </View>
            <View style={styles.passengerDetails}>
              <Text style={styles.passengerName}>
                {activeBooking.user?.firstname || 'Passenger'} {activeBooking.user?.lastname || ''}
              </Text>
              <Text style={styles.tripFare}>
                Fare: ₱{activeBooking.agreedFare || activeBooking.preferredFare}
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.goToMapsBtn} onPress={goToMaps}>
            <Ionicons name="map" size={20} color="#fff" />
            <Text style={styles.goToMapsBtnText}>Open in Maps</Text>
          </TouchableOpacity>

          <Text style={styles.activeTripHint}>
            Navigate to Maps tab to view route and complete the trip
          </Text>
        </View>
      )}

      {/* Content */}
      {!activeBooking && (
        !isOnline ? (
          <OfflineState onGoOnline={toggleOnlineStatus} disabled={!canOperate} />
        ) : (
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={refresh}
                colors={[colors.primary]}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {/* Pending Offers Section */}
            {pendingOffers.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="hourglass-outline" size={18} color={colors.primary} />
                  <Text style={styles.sectionTitle}>Pending Offers</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{pendingOffers.length}</Text>
                  </View>
                </View>
                {pendingOffers.map((offer) => (
                  <PendingOfferCard
                    key={offer._id}
                    offer={offer}
                    onWithdraw={handleWithdrawOffer}
                  />
                ))}
              </View>
            )}

            {/* Nearby Bookings Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="location-outline" size={18} color={colors.primary} />
                <Text style={styles.sectionTitle}>Nearby Requests</Text>
                {nearbyBookings.length > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{nearbyBookings.length}</Text>
                  </View>
                )}
              </View>

              {nearbyBookings.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="search-outline" size={48} color="#ccc" />
                  <Text style={styles.emptyTitle}>No Requests Nearby</Text>
                  <Text style={styles.emptyText}>
                    We'll show booking requests when passengers are nearby
                  </Text>
                </View>
              ) : (
                nearbyBookings.map((booking) => (
                  <BookingCard
                    key={booking._id}
                    booking={booking}
                    userLocation={userLocation}
                    onAccept={handleAcceptBooking}
                    onCounterOffer={handleOpenOfferModal}
                    disabled={!canOperate}
                  />
                ))
              )}
            </View>
          </ScrollView>
        )
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
              <Text style={styles.modalTitle}>Counter Offer</Text>
              <TouchableOpacity onPress={() => setShowOfferModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>
              Passenger's offer: ₱{selectedBooking?.preferredFare}
            </Text>

            <View style={styles.inputRow}>
              <Text style={styles.currencySymbol}>₱</Text>
              <TextInput
                style={styles.fareInput}
                placeholder="Your fare"
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
              numberOfLines={2}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setShowOfferModal(false)}
              >
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sendOfferBtn}
                onPress={handleSendOffer}
              >
                <Text style={styles.sendOfferBtnText}>Send Offer</Text>
              </TouchableOpacity>
            </View>
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
        <View style={styles.cancelNotifyOverlay}>
          <View style={styles.cancelNotifyContent}>
            <View style={styles.cancelNotifyIcon}>
              <Ionicons name="close-circle" size={60} color="#dc3545" />
            </View>
            <Text style={styles.cancelNotifyTitle}>Booking Cancelled</Text>
            <Text style={styles.cancelNotifyMessage}>
              {passengerCancelledBooking?.passengerName || 'The passenger'} has cancelled the ride.
            </Text>
            <TouchableOpacity
              style={styles.cancelNotifyButton}
              onPress={acknowledgeCancellation}
            >
              <Text style={styles.cancelNotifyButtonText}>OK, Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default TripsTab;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.medium,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitleSection: {
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  activeTripCard: {
    backgroundColor: '#fff',
    margin: spacing.medium,
    borderRadius: 16,
    padding: spacing.medium,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 4,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  activeTripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.small,
  },
  activeTripBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tripStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#28a745',
    marginRight: 6,
  },
  tripStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#28a745',
  },
  activeTripPassenger: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.medium,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passengerDetails: {
    marginLeft: 12,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  tripFare: {
    fontSize: 14,
    color: '#28a745',
    fontWeight: '500',
    marginTop: 2,
  },
  goToMapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
  },
  goToMapsBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  activeTripHint: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    marginTop: spacing.small,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.medium,
  },
  section: {
    marginBottom: spacing.large,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.medium,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 6,
  },
  badge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.large * 2,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: spacing.medium,
  },
  emptyText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    marginTop: spacing.small,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.large,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.medium,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: spacing.small,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: spacing.medium,
  },
  currencySymbol: {
    fontSize: 18,
    color: '#333',
    marginRight: 4,
  },
  fareInput: {
    flex: 1,
    fontSize: 18,
    paddingVertical: 12,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    marginBottom: spacing.medium,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelModalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelModalBtnText: {
    color: '#666',
    fontWeight: '600',
  },
  sendOfferBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  sendOfferBtnText: {
    color: '#fff',
    fontWeight: '600',
  },

  // Passenger Cancellation Notification Modal
  cancelNotifyOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.large,
  },
  cancelNotifyContent: {
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
  cancelNotifyIcon: {
    marginBottom: spacing.medium,
  },
  cancelNotifyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#dc3545',
    marginBottom: spacing.small,
    textAlign: 'center',
  },
  cancelNotifyMessage: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    marginBottom: spacing.large,
    lineHeight: 22,
  },
  cancelNotifyButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  cancelNotifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
