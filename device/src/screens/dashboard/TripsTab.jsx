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

import React, { useState, useCallback, useEffect } from 'react';
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
import axios from 'axios';

import { colors, spacing } from '../../components/common/theme';
import { useBooking } from '../../context/BookingContext';
import { API_URL } from '../../utils/config';
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
    authToken,
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
    boundaryInfo,
    boundaryLoading,
    fetchBoundaryInfo,
  } = useBooking();

  // Counter offer modal state
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [counterOffer, setCounterOffer] = useState('');
  const [offerMessage, setOfferMessage] = useState('');

  // Boundary settlement modal state
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementNotes, setSettlementNotes] = useState('');
  const [settlementMethod, setSettlementMethod] = useState('cash');
  const [settlementReference, setSettlementReference] = useState('');
  const [isSettling, setIsSettling] = useState(false);

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

  // Handle boundary settlement
  const handleOpenSettlementModal = useCallback(() => {
    // Pre-fill with outstanding balance or daily boundary amount
    const prefillAmount = boundaryInfo?.summary?.outstandingBalance > 0 
      ? boundaryInfo.summary.outstandingBalance 
      : boundaryInfo?.tricycle?.boundary?.amount || '';
    setSettlementAmount(prefillAmount.toString());
    setSettlementNotes('');
    setSettlementMethod('cash');
    setSettlementReference('');
    setShowSettlementModal(true);
  }, [boundaryInfo]);

  const handleSettlePayment = useCallback(async () => {
    const amount = parseFloat(settlementAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount.');
      return;
    }

    setIsSettling(true);
    try {
      const response = await axios.post(
        `${API_URL}/api/boundary/settle`,
        {
          amount,
          paymentMethod: settlementMethod,
          referenceNumber: settlementReference || undefined,
          notes: settlementNotes || undefined,
        },
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      if (response.data.success) {
        Alert.alert(
          'Payment Recorded',
          'Your boundary payment has been recorded. Awaiting operator confirmation.',
          [{ text: 'OK' }]
        );
        setShowSettlementModal(false);
        // Refresh boundary info
        if (fetchBoundaryInfo) fetchBoundaryInfo();
      } else {
        Alert.alert('Error', response.data.message || 'Failed to record payment');
      }
    } catch (error) {
      console.error('Settlement error:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to record payment. Please try again.');
    } finally {
      setIsSettling(false);
    }
  }, [settlementAmount, settlementMethod, settlementReference, settlementNotes, authToken, fetchBoundaryInfo]);

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

            {/* Boundary Settlement Section */}
            {boundaryInfo?.hasTricycle && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="wallet-outline" size={18} color={colors.primary} />
                  <Text style={styles.sectionTitle}>Boundary Settlement</Text>
                </View>

                <View style={styles.boundaryCard}>
                  {/* Boundary Summary */}
                  <View style={styles.boundaryHeader}>
                    <View style={styles.boundaryTricycleInfo}>
                      <Text style={styles.boundaryBodyNumber}>
                        {boundaryInfo.tricycle?.bodyNumber || '—'}
                      </Text>
                      <Text style={styles.boundaryPlate}>
                        {boundaryInfo.tricycle?.plateNumber || '—'}
                      </Text>
                    </View>
                    <View style={styles.boundaryAmountBox}>
                      <Text style={styles.boundaryAmountLabel}>
                        {boundaryInfo.tricycle?.boundary?.settlementType || 'Daily'} Boundary
                      </Text>
                      <Text style={styles.boundaryAmount}>
                        ₱{boundaryInfo.tricycle?.boundary?.amount || 0}
                      </Text>
                    </View>
                  </View>

                  {/* Operator Info */}
                  {boundaryInfo.operator && (
                    <View style={styles.operatorInfo}>
                      <Ionicons name="person-circle-outline" size={20} color="#666" />
                      <View style={styles.operatorDetails}>
                        <Text style={styles.operatorLabel}>Operator</Text>
                        <Text style={styles.operatorName}>{boundaryInfo.operator.name}</Text>
                      </View>
                    </View>
                  )}

                  {/* Pending Summary */}
                  {(boundaryInfo.summary?.totalPending > 0 || boundaryInfo.summary?.totalAwaitingConfirmation > 0) && (
                    <View style={styles.pendingSummary}>
                      {boundaryInfo.summary?.totalPending > 0 && (
                        <View style={styles.pendingItem}>
                          <View style={[styles.pendingDot, { backgroundColor: '#dc3545' }]} />
                          <Text style={styles.pendingText}>
                            ₱{boundaryInfo.summary.totalPending} pending ({boundaryInfo.summary.pendingCount} settlements)
                          </Text>
                        </View>
                      )}
                      {boundaryInfo.summary?.totalAwaitingConfirmation > 0 && (
                        <View style={styles.pendingItem}>
                          <View style={[styles.pendingDot, { backgroundColor: '#ffc107' }]} />
                          <Text style={styles.pendingText}>
                            ₱{boundaryInfo.summary.totalAwaitingConfirmation} awaiting confirmation
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Outstanding Balance */}
                  {boundaryInfo.summary?.outstandingBalance > 0 && (
                    <View style={styles.outstandingBox}>
                      <View style={styles.outstandingHeader}>
                        <Ionicons name="alert-circle" size={20} color="#dc3545" />
                        <Text style={styles.outstandingTitle}>Outstanding Balance</Text>
                      </View>
                      <Text style={styles.outstandingAmount}>
                        ₱{boundaryInfo.summary.outstandingBalance.toLocaleString()}
                      </Text>
                      <Text style={styles.outstandingDetails}>
                        {boundaryInfo.summary.daysSinceLastSettlement} day{boundaryInfo.summary.daysSinceLastSettlement !== 1 ? 's' : ''} since last settlement
                      </Text>
                    </View>
                  )}

                  {/* All Clear - only when no outstanding and no pending */}
                  {boundaryInfo.summary?.outstandingBalance === 0 && 
                   boundaryInfo.summary?.totalPending === 0 && 
                   boundaryInfo.summary?.totalAwaitingConfirmation === 0 && (
                    <View style={styles.noPendingBox}>
                      <Ionicons name="checkmark-circle" size={20} color="#28a745" />
                      <Text style={styles.noPendingText}>All settlements cleared!</Text>
                    </View>
                  )}

                  {/* Settle Payment Button */}
                  <TouchableOpacity
                    style={styles.settlePaymentBtn}
                    onPress={handleOpenSettlementModal}
                  >
                    <Ionicons name="cash-outline" size={20} color="#fff" />
                    <Text style={styles.settlePaymentBtnText}>Settle Payment</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
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

      {/* Boundary Settlement Modal */}
      <Modal
        visible={showSettlementModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSettlementModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.settlementModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Settle Boundary Payment</Text>
              <TouchableOpacity onPress={() => setShowSettlementModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.settlementInfo}>
              <Text style={styles.settlementInfoLabel}>
                {boundaryInfo?.tricycle?.boundary?.settlementType || 'Daily'} boundary for{' '}
                <Text style={styles.settlementInfoBold}>{boundaryInfo?.tricycle?.bodyNumber}</Text>
              </Text>
              <Text style={styles.settlementInfoOperator}>
                Operator: {boundaryInfo?.operator?.name || '—'}
              </Text>
              {boundaryInfo?.summary?.outstandingBalance > 0 && (
                <View style={styles.settlementOutstandingInfo}>
                  <Text style={styles.settlementOutstandingLabel}>Outstanding balance:</Text>
                  <Text style={styles.settlementOutstandingValue}>
                    ₱{boundaryInfo.summary.outstandingBalance.toLocaleString()}
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.inputLabel}>Amount (₱)</Text>
            <View style={styles.inputRow}>
              <Text style={styles.currencySymbol}>₱</Text>
              <TextInput
                style={styles.fareInput}
                placeholder="Enter amount"
                keyboardType="numeric"
                value={settlementAmount}
                onChangeText={setSettlementAmount}
              />
            </View>

            <Text style={styles.inputLabel}>Payment Method</Text>
            <View style={styles.paymentMethodRow}>
              <TouchableOpacity
                style={[
                  styles.paymentMethodBtn,
                  settlementMethod === 'cash' && styles.paymentMethodBtnActive
                ]}
                onPress={() => setSettlementMethod('cash')}
              >
                <Ionicons name="cash-outline" size={18} color={settlementMethod === 'cash' ? '#fff' : '#666'} />
                <Text style={[
                  styles.paymentMethodText,
                  settlementMethod === 'cash' && styles.paymentMethodTextActive
                ]}>Cash</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.paymentMethodBtn,
                  settlementMethod === 'gcash' && styles.paymentMethodBtnActive
                ]}
                onPress={() => setSettlementMethod('gcash')}
              >
                <Ionicons name="phone-portrait-outline" size={18} color={settlementMethod === 'gcash' ? '#fff' : '#666'} />
                <Text style={[
                  styles.paymentMethodText,
                  settlementMethod === 'gcash' && styles.paymentMethodTextActive
                ]}>GCash</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.paymentMethodBtn,
                  settlementMethod === 'bank' && styles.paymentMethodBtnActive
                ]}
                onPress={() => setSettlementMethod('bank')}
              >
                <Ionicons name="card-outline" size={18} color={settlementMethod === 'bank' ? '#fff' : '#666'} />
                <Text style={[
                  styles.paymentMethodText,
                  settlementMethod === 'bank' && styles.paymentMethodTextActive
                ]}>Bank</Text>
              </TouchableOpacity>
            </View>

            {settlementMethod !== 'cash' && (
              <>
                <Text style={styles.inputLabel}>Reference Number (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., Transaction ID"
                  value={settlementReference}
                  onChangeText={setSettlementReference}
                />
              </>
            )}

            <Text style={styles.inputLabel}>Notes (Optional)</Text>
            <TextInput
              style={[styles.textInput, styles.notesInput]}
              placeholder="Add any notes..."
              value={settlementNotes}
              onChangeText={setSettlementNotes}
              multiline
              numberOfLines={2}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setShowSettlementModal(false)}
                disabled={isSettling}
              >
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.settleBtn, isSettling && styles.settleBtnDisabled]}
                onPress={handleSettlePayment}
                disabled={isSettling}
              >
                {isSettling ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={styles.settleBtnText}>Record Payment</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
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

  // Boundary Settlement Styles
  boundaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: spacing.medium,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
  },
  boundaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.medium,
    paddingBottom: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  boundaryTricycleInfo: {
    flex: 1,
  },
  boundaryBodyNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
  },
  boundaryPlate: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  boundaryAmountBox: {
    alignItems: 'flex-end',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  boundaryAmountLabel: {
    fontSize: 11,
    color: '#666',
    textTransform: 'capitalize',
  },
  boundaryAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#28a745',
  },
  operatorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.small,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: spacing.medium,
  },
  operatorDetails: {
    marginLeft: 10,
    flex: 1,
  },
  operatorLabel: {
    fontSize: 11,
    color: '#999',
  },
  operatorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  pendingSummary: {
    paddingTop: spacing.small,
    gap: 8,
  },
  pendingItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  pendingText: {
    fontSize: 13,
    color: '#555',
  },
  noPendingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.small,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
  },
  noPendingText: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#28a745',
  },
  outstandingBox: {
    backgroundColor: '#fef2f2',
    padding: spacing.medium,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: spacing.small,
  },
  outstandingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  outstandingTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#dc3545',
    marginLeft: 6,
  },
  outstandingAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: '#dc3545',
    marginVertical: 4,
  },
  outstandingDetails: {
    fontSize: 12,
    color: '#b91c1c',
  },

  // Settlement Button & Modal Styles
  settlePaymentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: spacing.medium,
    gap: 8,
  },
  settlePaymentBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  settlementModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.large,
    maxHeight: '90%',
  },
  settlementInfo: {
    backgroundColor: '#f8f9fa',
    padding: spacing.medium,
    borderRadius: 10,
    marginBottom: spacing.medium,
  },
  settlementInfoLabel: {
    fontSize: 14,
    color: '#444',
  },
  settlementInfoBold: {
    fontWeight: '700',
    color: colors.primary,
  },
  settlementInfoOperator: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  settlementOutstandingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.small,
    paddingTop: spacing.small,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  settlementOutstandingLabel: {
    fontSize: 13,
    color: '#dc3545',
    fontWeight: '500',
  },
  settlementOutstandingValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#dc3545',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444',
    marginBottom: 6,
    marginTop: spacing.small,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: '#fafafa',
  },
  notesInput: {
    textAlignVertical: 'top',
    minHeight: 60,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.small,
  },
  paymentMethodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fafafa',
    gap: 6,
  },
  paymentMethodBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  paymentMethodText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  paymentMethodTextActive: {
    color: '#fff',
  },
  settleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#28a745',
    gap: 6,
  },
  settleBtnDisabled: {
    opacity: 0.6,
  },
  settleBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
