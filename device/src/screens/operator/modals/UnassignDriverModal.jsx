import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert
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
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Unassign Driver</Text>
          <Text style={styles.modalSub}>
            Select a driver to remove from {tricycleToUnassign?.plate || tricycleToUnassign?.plateNumber}
          </Text>

          <ScrollView style={{ maxHeight: 300, marginVertical: 16 }}>
            {tricycleToUnassign?.schedules && tricycleToUnassign.schedules.map((sch, idx) => (
              <TouchableOpacity 
                key={idx} 
                style={unassignStyles.scheduleCard}
                onPress={() => {
                  Alert.alert(
                    'Confirm Unassign',
                    `Remove ${sch.driver?.firstname} from schedule?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { 
                        text: 'Remove', 
                        style: 'destructive', 
                        onPress: () => onConfirmUnassign(
                          tricycleToUnassign._id || tricycleToUnassign.id, 
                          sch.driver?._id || sch.driver?.id
                        ) 
                      }
                    ]
                  );
                }}
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
              onPress={() => {
                Alert.alert(
                  'Confirm Clear All',
                  'Remove ALL drivers from this tricycle?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                      text: 'Clear All', 
                      style: 'destructive', 
                      onPress: () => onConfirmUnassign(
                        tricycleToUnassign._id || tricycleToUnassign.id
                      ) 
                    }
                  ]
                );
              }}
            >
              <Text style={unassignStyles.clearAllText}>Unassign All Drivers</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity 
              style={[styles.modalBtn, { backgroundColor: '#6c757d' }]} 
              onPress={onClose}
            >
              <Text style={styles.modalBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
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
  clearAllButton: {
    padding: 12,
    backgroundColor: '#fee',
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#fcc'
  },
  clearAllText: {
    color: '#dc3545',
    fontWeight: '600'
  }
};