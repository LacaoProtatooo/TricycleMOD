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
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Select Driver to Message</Text>
          <Text style={styles.modalSub}>
            Who do you want to message regarding {selectedTricycle?.plate || selectedTricycle?.plateNumber}?
          </Text>

          <ScrollView style={{ maxHeight: 300, marginVertical: 16 }}>
            {selectedTricycle?.schedules && selectedTricycle.schedules.map((sch, idx) => (
              <TouchableOpacity 
                key={idx} 
                style={messageStyles.scheduleCard}
                onPress={() => {
                  onClose();
                  navigation.navigate('Chat', {
                    userId: sch.driver._id || sch.driver.id,
                    userName: `${sch.driver.firstname} ${sch.driver.lastname}`,
                    userImage: sch.driver.image?.url
                  });
                }}
              >
                {sch.driver?.image?.url ? (
                  <Image source={{ uri: sch.driver.image.url }} style={messageStyles.avatar} />
                ) : (
                  <Ionicons name="person-circle-outline" size={40} color={colors.orangeShade5} style={{ marginRight: 12 }} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={messageStyles.driverName}>
                    {sch.driver?.firstname} {sch.driver?.lastname}
                  </Text>
                  <Text style={messageStyles.scheduleInfo}>
                    {sch.days.join(', ')} • {sch.startTime}-{sch.endTime}
                  </Text>
                </View>
                <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
            ))}
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