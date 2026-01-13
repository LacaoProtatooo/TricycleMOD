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

export default function MessageSelectionModal({
  visible,
  onClose,
  selectedTricycle,
  navigation
}) {
  // Helper to get driver info safely (handles both populated and unpopulated driver)
  const getDriverInfo = (sch) => {
    if (!sch.driver) return null;
    
    // If driver is populated (object with firstname/lastname)
    if (typeof sch.driver === 'object' && sch.driver.firstname) {
      return {
        id: sch.driver._id || sch.driver.id,
        name: `${sch.driver.firstname} ${sch.driver.lastname}`,
        image: sch.driver.image?.url
      };
    }
    
    // If driver is just an ObjectId string (not populated)
    return {
      id: sch.driver,
      name: 'Driver',
      image: null
    };
  };

  const handleSelectDriver = (sch) => {
    const driverInfo = getDriverInfo(sch);
    
    if (!driverInfo || !driverInfo.id) {
      Alert.alert('Error', 'Unable to get driver information. Please try again.');
      return;
    }
    
    onClose();
    navigation.navigate('Chat', {
      userId: driverInfo.id,
      userName: driverInfo.name,
      userImage: driverInfo.image
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Select Driver to Message</Text>
          <Text style={styles.modalSub}>
            Who do you want to message regarding {selectedTricycle?.plate || selectedTricycle?.plateNumber}?
          </Text>

          <ScrollView style={{ maxHeight: 300, marginVertical: 16 }}>
            {selectedTricycle?.schedules && selectedTricycle.schedules.map((sch, idx) => {
              const driverInfo = getDriverInfo(sch);
              if (!driverInfo) return null;
              
              return (
                <TouchableOpacity 
                  key={idx} 
                  style={messageStyles.scheduleCard}
                  onPress={() => handleSelectDriver(sch)}
                >
                  {driverInfo.image ? (
                    <Image source={{ uri: driverInfo.image }} style={messageStyles.avatar} />
                  ) : (
                    <Ionicons name="person-circle-outline" size={40} color={colors.orangeShade5} style={{ marginRight: 12 }} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={messageStyles.driverName}>
                      {driverInfo.name}
                    </Text>
                    <Text style={messageStyles.scheduleInfo}>
                      {sch.days?.join(', ') || 'No days'} • {sch.startTime || '?'}-{sch.endTime || '?'}
                    </Text>
                  </View>
                  <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              );
            })}
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

const messageStyles = {
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
  }
};