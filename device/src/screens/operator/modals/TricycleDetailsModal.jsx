import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../components/common/theme';
import styles from '../operatorStyles';

export default function TricycleDetailsModal({
  visible,
  onClose,
  selectedTricycle
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Vehicle Details</Text>
          <Text style={styles.modalSub}>
            {selectedTricycle?.plate || selectedTricycle?.plateNumber} • {selectedTricycle?.model}
          </Text>

          <View style={{ marginVertical: 16 }}>
            <Text style={detailsStyles.sectionTitle}>Primary Driver</Text>
            {selectedTricycle?.driver ? (
              <View style={detailsStyles.driverCard}>
                {selectedTricycle.driver.image?.url ? (
                  <Image 
                    source={{ uri: selectedTricycle.driver.image.url }} 
                    style={detailsStyles.avatar} 
                  />
                ) : (
                  <Ionicons 
                    name="person-circle-outline" 
                    size={40} 
                    color={colors.orangeShade5} 
                    style={{ marginRight: 12 }} 
                  />
                )}
                <View>
                  <Text style={detailsStyles.driverName}>
                    {selectedTricycle.driver.firstname} {selectedTricycle.driver.lastname}
                  </Text>
                  <Text style={detailsStyles.username}>@{selectedTricycle.driver.username}</Text>
                </View>
              </View>
            ) : (
              <Text style={detailsStyles.noDriver}>No primary driver assigned</Text>
            )}

            <Text style={[detailsStyles.sectionTitle, { marginTop: 16 }]}>Scheduled Drivers</Text>
            {selectedTricycle?.schedules && selectedTricycle.schedules.length > 0 ? (
              <ScrollView style={{ maxHeight: 200 }}>
                {selectedTricycle.schedules.map((sch, idx) => (
                  <View key={idx} style={detailsStyles.scheduleCard}>
                    {sch.driver?.image?.url ? (
                      <Image 
                        source={{ uri: sch.driver.image.url }} 
                        style={detailsStyles.smallAvatar} 
                      />
                    ) : (
                      <Ionicons 
                        name="person-circle-outline" 
                        size={32} 
                        color={colors.orangeShade5} 
                        style={{ marginRight: 10 }} 
                      />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={detailsStyles.scheduleDriverName}>
                        {sch.driver?.firstname} {sch.driver?.lastname}
                      </Text>
                      <Text style={detailsStyles.scheduleInfo}>
                        {sch.days.join(', ')} • {sch.startTime}-{sch.endTime}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={detailsStyles.noDriver}>No scheduled drivers</Text>
            )}
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity 
              style={[styles.modalBtn, { backgroundColor: '#6c757d' }]} 
              onPress={onClose}
            >
              <Text style={styles.modalBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const detailsStyles = {
  sectionTitle: {
    fontWeight: '700',
    marginBottom: 8,
    color: colors.orangeShade7
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12
  },
  driverName: {
    fontWeight: '600'
  },
  username: {
    fontSize: 12,
    color: '#666'
  },
  noDriver: {
    fontStyle: 'italic',
    color: '#999',
    marginBottom: 12
  },
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 8
  },
  smallAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10
  },
  scheduleDriverName: {
    fontWeight: '600',
    fontSize: 14
  },
  scheduleInfo: {
    fontSize: 12,
    color: '#666'
  }
};