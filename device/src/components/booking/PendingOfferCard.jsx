/**
 * PendingOfferCard.jsx - Card showing a pending counter offer waiting for response
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors, spacing } from '../common/theme';

const PendingOfferCard = ({ offer, onWithdraw }) => {
  const passengerName = offer.user?.firstname 
    ? `${offer.user.firstname} ${offer.user.lastname || ''}`.trim()
    : 'Passenger';

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.passengerInfo}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={14} color="#fff" />
          </View>
          <Text style={styles.passengerName}>{passengerName}</Text>
        </View>
        <View style={styles.statusBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Waiting</Text>
        </View>
      </View>

      <View style={styles.offerDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="cash-outline" size={16} color="#28a745" />
          <Text style={styles.yourOffer}>
            Your offer: ₱{offer.driverOffer?.amount || offer.preferredFare}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="pricetag-outline" size={16} color="#6c757d" />
          <Text style={styles.originalFare}>
            Guest's fare: ₱{offer.preferredFare}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="location" size={16} color={colors.primary} />
          <Text style={styles.location} numberOfLines={1}>
            {offer.pickup?.address || 'Pickup location'}
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.withdrawBtn} onPress={() => onWithdraw(offer._id)}>
        <Ionicons name="close-outline" size={16} color="#dc3545" />
        <Text style={styles.withdrawBtnText}>Withdraw Offer</Text>
      </TouchableOpacity>

      <Text style={styles.hintText}>
        Waiting for passenger to accept or decline...
      </Text>
    </View>
  );
};

export default PendingOfferCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fffdf5',
    borderRadius: 12,
    padding: spacing.medium,
    marginBottom: spacing.small,
    borderWidth: 1,
    borderColor: '#ffc107',
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
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passengerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffc107',
    marginRight: 4,
  },
  statusText: {
    fontSize: 11,
    color: '#856404',
    fontWeight: '500',
  },
  offerDetails: {
    marginVertical: spacing.small,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  yourOffer: {
    fontSize: 13,
    color: '#28a745',
    fontWeight: '600',
    marginLeft: 6,
  },
  originalFare: {
    fontSize: 12,
    color: '#6c757d',
    marginLeft: 6,
  },
  location: {
    fontSize: 12,
    color: '#555',
    marginLeft: 6,
    flex: 1,
  },
  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dc3545',
    marginTop: spacing.small,
  },
  withdrawBtnText: {
    fontSize: 13,
    color: '#dc3545',
    fontWeight: '500',
    marginLeft: 4,
  },
  hintText: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    marginTop: spacing.small,
    fontStyle: 'italic',
  },
});
