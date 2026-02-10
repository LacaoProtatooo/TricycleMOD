/**
 * ComplaintNotificationModal.jsx
 *
 * A pop-up modal that appears when:
 * 1. An operator receives a notification that their driver has been reported (type: driver_complaint)
 * 2. A guest/user receives a notification that the admin has reviewed/resolved their complaint
 *    (type: complaint_status_update, complaint_resolved)
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

const CATEGORY_LABELS = {
  rude_behavior: 'Rude Behavior',
  overcharging: 'Overcharging',
  unsafe_driving: 'Unsafe Driving',
  route_deviation: 'Route Deviation',
  vehicle_condition: 'Vehicle Condition',
  refusal_of_service: 'Refusal of Service',
  harassment: 'Harassment',
  discrimination: 'Discrimination',
  intoxicated_driving: 'Intoxicated Driving',
  other: 'Other',
};

const STATUS_LABELS = {
  pending: 'Pending',
  under_review: 'Under Review',
  investigating: 'Being Investigated',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

/**
 * Returns the visual config based on notification type
 */
const getModalConfig = (notificationType, data = {}) => {
  switch (notificationType) {
    // Operator: their driver was reported by a guest
    case 'driver_complaint':
      return {
        icon: 'warning',
        iconColor: '#EF4444',
        bgGradientTop: '#FEF2F2',
        accentColor: '#EF4444',
        title: 'Driver Reported',
        subtitle: 'A complaint has been filed against your driver',
        badgeText: data.severity === 'critical' ? 'CRITICAL' : data.severity === 'high' ? 'HIGH' : 'NEW',
        badgeColor: data.severity === 'critical' ? '#DC2626' : data.severity === 'high' ? '#F59E0B' : '#3B82F6',
        buttonText: 'View Details',
        buttonColor: '#EF4444',
      };

    // Operator: complaint against driver status updated
    case 'complaint_status_update_operator':
      return {
        icon: 'information-circle',
        iconColor: '#3B82F6',
        bgGradientTop: '#EFF6FF',
        accentColor: '#3B82F6',
        title: 'Complaint Update',
        subtitle: 'Status update on a complaint against your driver',
        badgeText: STATUS_LABELS[data.newStatus] || data.newStatus || 'UPDATED',
        badgeColor: data.newStatus === 'resolved' ? '#10B981' : data.newStatus === 'dismissed' ? '#6B7280' : '#3B82F6',
        buttonText: 'Got It',
        buttonColor: '#3B82F6',
      };

    // Operator: complaint against driver resolved
    case 'complaint_resolved_operator':
      return {
        icon: data.resolution === 'dismissed' ? 'checkmark-circle' : 'shield-checkmark',
        iconColor: data.resolution === 'dismissed' ? '#6B7280' : '#10B981',
        bgGradientTop: data.resolution === 'dismissed' ? '#F9FAFB' : '#ECFDF5',
        accentColor: data.resolution === 'dismissed' ? '#6B7280' : '#10B981',
        title: data.resolution === 'dismissed' ? 'Complaint Dismissed' : 'Complaint Resolved',
        subtitle: data.resolution === 'dismissed'
          ? 'The complaint against your driver was dismissed'
          : 'The complaint against your driver has been resolved',
        badgeText: data.resolution === 'dismissed' ? 'DISMISSED' : 'RESOLVED',
        badgeColor: data.resolution === 'dismissed' ? '#6B7280' : '#10B981',
        buttonText: 'Got It',
        buttonColor: data.resolution === 'dismissed' ? '#6B7280' : '#10B981',
      };

    // Guest/User: their complaint status was updated by admin
    case 'complaint_status_update':
      return {
        icon: 'clipboard',
        iconColor: '#3B82F6',
        bgGradientTop: '#EFF6FF',
        accentColor: '#3B82F6',
        title: 'Complaint Update',
        subtitle: 'Your complaint status has been updated',
        badgeText: STATUS_LABELS[data.newStatus] || data.newStatus || 'UPDATED',
        badgeColor: data.newStatus === 'investigating' ? '#8B5CF6' : data.newStatus === 'under_review' ? '#3B82F6' : '#F59E0B',
        buttonText: 'Got It',
        buttonColor: '#3B82F6',
      };

    // Guest/User: their complaint was resolved or dismissed
    case 'complaint_resolved':
      return {
        icon: data.resolution === 'dismissed' ? 'close-circle' : 'checkmark-circle',
        iconColor: data.resolution === 'dismissed' ? '#EF4444' : '#10B981',
        bgGradientTop: data.resolution === 'dismissed' ? '#FEF2F2' : '#ECFDF5',
        accentColor: data.resolution === 'dismissed' ? '#EF4444' : '#10B981',
        title: data.resolution === 'dismissed' ? 'Complaint Dismissed' : 'Complaint Resolved',
        subtitle: data.resolution === 'dismissed'
          ? 'Your complaint has been reviewed and dismissed'
          : 'Your complaint has been resolved by the admin',
        badgeText: data.resolution === 'dismissed' ? 'DISMISSED' : 'RESOLVED',
        badgeColor: data.resolution === 'dismissed' ? '#EF4444' : '#10B981',
        buttonText: 'View Details',
        buttonColor: data.resolution === 'dismissed' ? '#EF4444' : '#10B981',
      };

    // Driver: someone filed a complaint against them
    case 'complaint_received':
      return {
        icon: 'alert-circle',
        iconColor: '#EF4444',
        bgGradientTop: '#FEF2F2',
        accentColor: '#EF4444',
        title: 'Complaint Filed Against You',
        subtitle: 'A passenger has reported a complaint about your service',
        badgeText: 'NEW COMPLAINT',
        badgeColor: '#DC2626',
        buttonText: 'View Details',
        buttonColor: '#EF4444',
      };

    // Driver: complaint against them status updated
    case 'complaint_status_update_driver':
      return {
        icon: 'sync-circle',
        iconColor: '#8B5CF6',
        bgGradientTop: '#F5F3FF',
        accentColor: '#8B5CF6',
        title: 'Complaint Update',
        subtitle: 'The complaint against you has a status update',
        badgeText: STATUS_LABELS[data.newStatus] || data.newStatus || 'UPDATED',
        badgeColor: data.newStatus === 'investigating' ? '#8B5CF6' : data.newStatus === 'under_review' ? '#3B82F6' : '#F59E0B',
        buttonText: 'Got It',
        buttonColor: '#8B5CF6',
      };

    // Driver: complaint against them resolved
    case 'complaint_resolved_driver':
      return {
        icon: data.resolution === 'dismissed' ? 'happy' : 'alert-circle',
        iconColor: data.resolution === 'dismissed' ? '#10B981' : '#F59E0B',
        bgGradientTop: data.resolution === 'dismissed' ? '#ECFDF5' : '#FFFBEB',
        accentColor: data.resolution === 'dismissed' ? '#10B981' : '#F59E0B',
        title: data.resolution === 'dismissed'
          ? 'Complaint Dismissed'
          : 'Complaint Resolved',
        subtitle: data.resolution === 'dismissed'
          ? 'Good news! The complaint against you has been dismissed'
          : 'The complaint against you has been resolved with action taken',
        badgeText: data.resolution === 'dismissed' ? 'CLEARED' : 'ACTION TAKEN',
        badgeColor: data.resolution === 'dismissed' ? '#10B981' : '#F59E0B',
        buttonText: 'Got It',
        buttonColor: data.resolution === 'dismissed' ? '#10B981' : '#F59E0B',
      };

    default:
      return {
        icon: 'notifications',
        iconColor: '#3B82F6',
        bgGradientTop: '#EFF6FF',
        accentColor: '#3B82F6',
        title: 'Notification',
        subtitle: 'You have a new notification',
        badgeText: 'NEW',
        badgeColor: '#3B82F6',
        buttonText: 'OK',
        buttonColor: '#3B82F6',
      };
  }
};

/**
 * Build the detail items to display based on notification type and data
 */
const getDetailItems = (notificationType, data = {}, notificationBody = '') => {
  const items = [];

  // Category
  if (data.category) {
    items.push({
      icon: 'pricetag',
      label: 'Category',
      value: CATEGORY_LABELS[data.category] || data.category,
    });
  }

  // Driver name (for operator notifications)
  if (data.driverName) {
    items.push({
      icon: 'person',
      label: 'Driver',
      value: data.driverName,
    });
  }

  // Status change
  if (data.previousStatus && data.newStatus) {
    items.push({
      icon: 'swap-horizontal',
      label: 'Status Changed',
      value: `${STATUS_LABELS[data.previousStatus] || data.previousStatus} → ${STATUS_LABELS[data.newStatus] || data.newStatus}`,
    });
  } else if (data.newStatus) {
    items.push({
      icon: 'flag',
      label: 'New Status',
      value: STATUS_LABELS[data.newStatus] || data.newStatus,
    });
  }

  // Resolution action
  if (data.action) {
    items.push({
      icon: 'hammer',
      label: 'Action Taken',
      value: data.action,
    });
  }

  // Details / note
  if (data.details) {
    items.push({
      icon: 'document-text',
      label: 'Details',
      value: data.details,
    });
  } else if (data.note) {
    items.push({
      icon: 'document-text',
      label: 'Admin Note',
      value: data.note,
    });
  }

  // Severity (for operator complaint)
  if (data.severity) {
    const severityConfig = {
      critical: { color: '#DC2626', label: 'Critical - Immediate attention required' },
      high: { color: '#F59E0B', label: 'High Priority' },
      medium: { color: '#3B82F6', label: 'Medium Priority' },
      low: { color: '#6B7280', label: 'Low Priority' },
    };
    items.push({
      icon: 'alert-circle',
      label: 'Severity',
      value: severityConfig[data.severity]?.label || data.severity,
      valueColor: severityConfig[data.severity]?.color,
    });
  }

  // If false complaint (for user)
  if (data.isFalseComplaint === 'true') {
    items.push({
      icon: 'warning',
      label: 'Notice',
      value: 'This complaint was determined to be false. Repeated false complaints may result in restrictions.',
      valueColor: '#EF4444',
    });
  }

  return items;
};

const ComplaintNotificationModal = ({
  visible,
  onClose,
  onViewDetails,
  notificationType,
  notificationTitle,
  notificationBody,
  notificationData,
}) => {
  if (!visible) return null;

  const config = getModalConfig(notificationType, notificationData);
  const details = getDetailItems(notificationType, notificationData, notificationBody);

  const handlePress = () => {
    if (onViewDetails && (notificationType === 'driver_complaint' || notificationType === 'complaint_resolved')) {
      onViewDetails(notificationData);
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { borderTopColor: config.accentColor }]}>
          {/* Header Section */}
          <View style={[styles.headerSection, { backgroundColor: config.bgGradientTop }]}>
            {/* Close button */}
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Icon */}
            <View style={[styles.iconCircle, { backgroundColor: `${config.accentColor}15` }]}>
              <Ionicons name={config.icon} size={40} color={config.iconColor} />
            </View>

            {/* Badge */}
            <View style={[styles.badge, { backgroundColor: config.badgeColor }]}>
              <Text style={styles.badgeText}>{config.badgeText}</Text>
            </View>

            {/* Title & Subtitle */}
            <Text style={styles.title}>{notificationTitle || config.title}</Text>
            <Text style={styles.subtitle}>{config.subtitle}</Text>
          </View>

          {/* Body / notification text */}
          {notificationBody ? (
            <View style={styles.bodySection}>
              <Text style={styles.bodyText}>{notificationBody}</Text>
            </View>
          ) : null}

          {/* Detail Items */}
          {details.length > 0 && (
            <ScrollView
              style={styles.detailsScroll}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {details.map((item, index) => (
                <View key={index} style={styles.detailRow}>
                  <View style={styles.detailIcon}>
                    <Ionicons name={item.icon} size={18} color="#6B7280" />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>{item.label}</Text>
                    <Text
                      style={[
                        styles.detailValue,
                        item.valueColor && { color: item.valueColor },
                      ]}
                    >
                      {item.value}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Timestamp */}
          <Text style={styles.timestamp}>
            {new Date().toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })}
          </Text>

          {/* Action Button */}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: config.buttonColor }]}
            onPress={handlePress}
            activeOpacity={0.8}
          >
            <Text style={styles.actionButtonText}>{config.buttonText}</Text>
          </TouchableOpacity>

          {/* Dismiss text */}
          <TouchableOpacity onPress={onClose} style={styles.dismissLink}>
            <Text style={styles.dismissText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: SCREEN_WIDTH - 40,
    maxHeight: '80%',
    overflow: 'hidden',
    borderTopWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  headerSection: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  bodySection: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    textAlign: 'center',
  },
  detailsScroll: {
    maxHeight: 200,
    paddingHorizontal: 20,
    marginTop: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    lineHeight: 20,
  },
  timestamp: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 12,
    marginBottom: 8,
  },
  actionButton: {
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  dismissLink: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 12,
  },
  dismissText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
});

export default ComplaintNotificationModal;
