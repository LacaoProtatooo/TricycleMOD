import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView
} from 'react-native';
import { colors } from '../../../components/common/theme';
import styles from '../operatorStyles';

export default function MaintenanceModal({
  visible,
  onClose,
  selectedTricycle,
  history
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalContainer}>
        <View style={[styles.modalContent, { maxHeight: '80%' }]}>
          <Text style={styles.modalTitle}>Maintenance Logs</Text>
          <Text style={styles.modalSub}>
            {selectedTricycle?.plate || selectedTricycle?.plateNumber} • 
            Odometer: {selectedTricycle?.currentOdometer || 0} km
          </Text>
          
          <ScrollView style={{ marginBottom: 16 }}>
            {history.length === 0 ? (
              <Text style={styles.emptyText}>No maintenance records found.</Text>
            ) : (
              history.slice().reverse().map((log, index) => (
                <View key={index} style={maintenanceStyles.logItem}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontWeight: '700', color: colors.orangeShade7 }}>
                      {log.itemKey.replace(/_/g, ' ').toUpperCase()}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#999' }}>
                      {new Date(log.completedAt).toLocaleDateString()}
                    </Text>
                  </View>
                  
                  <Text style={{ marginTop: 4, color: colors.orangeShade5 }}>
                    Service at: {log.lastServiceKm} km
                  </Text>
                  
                  {log.notes && (
                    <Text style={{ marginTop: 4, fontStyle: 'italic', fontSize: 12, color: '#666' }}>
                      "{log.notes}"
                    </Text>
                  )}
                </View>
              ))
            )}
          </ScrollView>

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

const maintenanceStyles = {
  logItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 8
  }
};