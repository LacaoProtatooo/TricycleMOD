import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../components/common/theme';
import styles from '../operatorStyles';

export default function UnassignDriverModal({
  visible,
  onClose,
  tricycleToUnassign,
  onConfirmUnassign
}) {
  const [unassignReason, setUnassignReason] = useState('');
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState(null);
  const [isUnassignAll, setIsUnassignAll] = useState(false);
  
  // Check if tricycle has shared schedules or just a primary driver
  const hasSchedules = tricycleToUnassign?.schedules && tricycleToUnassign.schedules.length > 0;
  const hasPrimaryDriver = tricycleToUnassign?.driver;

  const handleSelectDriver = (driverId = null, isAll = false) => {
    setSelectedDriverId(driverId);
    setIsUnassignAll(isAll);
    setShowReasonInput(true);
  };

  const handleConfirmWithReason = () => {
    if (!unassignReason.trim()) {
      Alert.alert('Reason Required', 'Please provide a reason for unassigning the driver.');
      return;
    }

    const tricycleId = tricycleToUnassign._id || tricycleToUnassign.id;
    
    if (isUnassignAll) {
      onConfirmUnassign(tricycleId, null, unassignReason.trim());
    } else {
      onConfirmUnassign(tricycleId, selectedDriverId, unassignReason.trim());
    }
    
    // Reset state
    setUnassignReason('');
    setShowReasonInput(false);
    setSelectedDriverId(null);
    setIsUnassignAll(false);
  };

  const handleCancelReason = () => {
    setUnassignReason('');
    setShowReasonInput(false);
    setSelectedDriverId(null);
    setIsUnassignAll(false);
  };

  const handleClose = () => {
    handleCancelReason();
    onClose();
  };
  
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Unassign Driver</Text>
          <Text style={styles.modalSub}>
            {hasSchedules 
              ? `Select which driver to remove from ${tricycleToUnassign?.plate || tricycleToUnassign?.plateNumber}`
              : `Remove driver from ${tricycleToUnassign?.plate || tricycleToUnassign?.plateNumber}`
            }
          </Text>

          {showReasonInput ? (
            // Reason Input View
            <View style={unassignStyles.reasonContainer}>
              <Text style={unassignStyles.reasonTitle}>
                <Ionicons name="information-circle" size={18} color={colors.orangeShade5} /> Reason for Unassignment
              </Text>
              <Text style={unassignStyles.reasonSubtitle}>
                The driver will be notified of this reason.
              </Text>
              <TextInput
                style={unassignStyles.reasonInput}
                placeholder="Enter reason for unassigning driver..."
                placeholderTextColor="#999"
                value={unassignReason}
                onChangeText={setUnassignReason}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <View style={unassignStyles.reasonButtons}>
                <TouchableOpacity
                  style={[unassignStyles.reasonBtn, unassignStyles.cancelReasonBtn]}
                  onPress={handleCancelReason}
                >
                  <Text style={unassignStyles.cancelReasonBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[unassignStyles.reasonBtn, unassignStyles.confirmReasonBtn]}
                  onPress={handleConfirmWithReason}
                >
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={unassignStyles.confirmReasonBtnText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            // Driver Selection View
            <ScrollView style={{ maxHeight: 350, marginVertical: 16 }}>
              {/* Show Primary Driver if exists and no schedules */}
              {hasPrimaryDriver && !hasSchedules && (
                <TouchableOpacity 
                  style={unassignStyles.scheduleCard}
                  onPress={() => handleSelectDriver(tricycleToUnassign.driver?._id || tricycleToUnassign.driver?.id)}
                >
                  {tricycleToUnassign.driver?.image?.url ? (
                    <Image source={{ uri: tricycleToUnassign.driver.image.url }} style={unassignStyles.avatar} />
                  ) : (
                    <Ionicons 
                      name="person-circle-outline" 
                      size={40} 
                      color={colors.orangeShade5} 
                      style={{ marginRight: 12 }} 
                    />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={unassignStyles.driverName}>
                      {tricycleToUnassign.driver?.firstname} {tricycleToUnassign.driver?.lastname}
                    </Text>
                    <Text style={unassignStyles.scheduleInfo}>Exclusive Assignment</Text>
                  </View>
                  <Ionicons name="trash-outline" size={20} color="#dc3545" />
                </TouchableOpacity>
              )}

              {/* Show Scheduled Drivers Header */}
              {hasSchedules && (
                <Text style={unassignStyles.sectionHeader}>Scheduled Drivers ({tricycleToUnassign.schedules.length})</Text>
              )}

              {/* Show each scheduled driver */}
              {hasSchedules && tricycleToUnassign.schedules.map((sch, idx) => (
                <TouchableOpacity 
                  key={idx} 
                  style={unassignStyles.scheduleCard}
                  onPress={() => handleSelectDriver(sch.driver?._id || sch.driver?.id)}
                >
                  {sch.driver?.image?.url ? (
                    <Image source={{ uri: sch.driver.image.url }} style={unassignStyles.avatar} />
                  ) : (
                    <Ionicons 
                      name="person-circle-outline" 
                      size={40} 
                      color={colors.orangeShade5} 
                      style={{ marginRight: 12 }} 
                    />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={unassignStyles.driverName}>
                      {sch.driver?.firstname} {sch.driver?.lastname}
                    </Text>
                    <Text style={unassignStyles.scheduleInfo}>
                      {sch.days.join(', ')} • {sch.startTime}-{sch.endTime}
                    </Text>
                  </View>
                  <Ionicons name="trash-outline" size={20} color="#dc3545" />
                </TouchableOpacity>
              ))}
              
              <TouchableOpacity 
                style={unassignStyles.clearAllButton}
                onPress={() => handleSelectDriver(null, true)}
              >
                <Text style={unassignStyles.clearAllText}>Unassign All Drivers</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {!showReasonInput && (
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: '#6c757d' }]} 
                onPress={handleClose}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const unassignStyles = {
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee'
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12
  },
  driverName: {
    fontWeight: '600',
    fontSize: 16
  },
  scheduleInfo: {
    fontSize: 12,
    color: '#666'
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6'
  },
  clearAllButton: {
    padding: 12,
    backgroundColor: '#fee',
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#fcc'
  },
  clearAllText: {
    color: '#dc3545',
    fontWeight: '600'
  },
  reasonContainer: {
    marginVertical: 16,
    padding: 16,
    backgroundColor: '#fff8f0',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.orangeShade2,
  },
  reasonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.orangeShade6,
    marginBottom: 4,
  },
  reasonSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  reasonInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    color: '#333',
  },
  reasonButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 12,
  },
  reasonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  cancelReasonBtn: {
    backgroundColor: '#f1f1f1',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelReasonBtnText: {
    color: '#666',
    fontWeight: '500',
  },
  confirmReasonBtn: {
    backgroundColor: '#dc3545',
  },
  confirmReasonBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
};