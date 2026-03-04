/**
 * UnassignmentNotificationModal.jsx
 *
 * A pop-up modal that appears when a driver is unassigned from a tricycle by their operator.
 * Shows the reason for unassignment and relevant details.
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from './theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function UnassignmentNotificationModal({
  visible,
  onClose,
  notificationTitle,
  notificationBody,
  notificationData,
}) {
  const {
    operatorName = 'Your Operator',
    plateNumber = 'N/A',
    reason = 'No reason provided',
    unassignedAt,
  } = notificationData || {};

  const formatDate = (dateString) => {
    if (!dateString) return '';
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

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconBackground}>
              <Ionicons name="person-remove" size={40} color="#dc3545" />
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>You've Been Unassigned</Text>
          <Text style={styles.subtitle}>
            {notificationBody || `You have been unassigned from tricycle ${plateNumber}`}
          </Text>

          {/* Details Card */}
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="car" size={18} color={colors.primary} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Tricycle</Text>
                <Text style={styles.detailValue}>{plateNumber}</Text>
              </View>
            </View>

            <View style={styles.separator} />

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="person" size={18} color={colors.primary} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Operator</Text>
                <Text style={styles.detailValue}>{operatorName}</Text>
              </View>
            </View>

            {unassignedAt && (
              <>
                <View style={styles.separator} />
                <View style={styles.detailRow}>
                  <View style={styles.detailIcon}>
                    <Ionicons name="time" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Date</Text>
                    <Text style={styles.detailValue}>{formatDate(unassignedAt)}</Text>
                  </View>
                </View>
              </>
            )}
          </View>

          {/* Reason Section */}
          <View style={styles.reasonContainer}>
            <View style={styles.reasonHeader}>
              <Ionicons name="chatbubble-ellipses" size={18} color="#856404" />
              <Text style={styles.reasonHeaderText}>Reason for Unassignment</Text>
            </View>
            <ScrollView style={styles.reasonScroll} nestedScrollEnabled>
              <Text style={styles.reasonText}>{reason}</Text>
            </ScrollView>
          </View>

          {/* Info Note */}
          <View style={styles.infoNote}>
            <Ionicons name="information-circle" size={16} color="#6c757d" />
            <Text style={styles.infoNoteText}>
              Contact your operator if you have questions about this decision.
            </Text>
          </View>

          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Got It</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: SCREEN_WIDTH - 40,
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    marginBottom: 16,
  },
  iconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  detailsCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  separator: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },
  reasonContainer: {
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: '#fcd34d',
    marginBottom: 16,
  },
  reasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  reasonHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
  },
  reasonScroll: {
    maxHeight: 80,
  },
  reasonText: {
    fontSize: 14,
    color: '#78350f',
    lineHeight: 20,
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
    width: '100%',
    marginBottom: 20,
    gap: 8,
  },
  infoNoteText: {
    flex: 1,
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
  closeButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
