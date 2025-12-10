import React from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { colors, spacing } from '../../../components/common/theme';
import styles from '../operatorStyles';

export default function AddTricycleModal({
  visible,
  onClose,
  onSubmit,
  newTricycle,
  setNewTricycle,
  creating
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView 
        style={styles.modalContainer} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Add New Tricycle</Text>
          
          <TextInput
            style={styles.textInput}
            placeholder="Plate Number"
            value={newTricycle.plateNumber}
            onChangeText={(text) => setNewTricycle({ ...newTricycle, plateNumber: text.toUpperCase() })}
            editable={!creating}
          />
          
          <TextInput
            style={styles.textInput}
            placeholder="Model"
            value={newTricycle.model}
            onChangeText={(text) => setNewTricycle({ ...newTricycle, model: text })}
            editable={!creating}
          />
          
          <TextInput
            style={styles.textInput}
            placeholder="Initial Odometer (km)"
            value={newTricycle.currentOdometer}
            onChangeText={(text) => setNewTricycle({ ...newTricycle, currentOdometer: text })}
            keyboardType="numeric"
            editable={!creating}
          />
          
          <View style={styles.modalActions}>
            <TouchableOpacity 
              style={[styles.modalBtn, { backgroundColor: '#6c757d' }]} 
              onPress={onClose} 
              disabled={creating}
            >
              <Text style={styles.modalBtnText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.modalBtn, { backgroundColor: colors.primary }]} 
              onPress={onSubmit} 
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalBtnText}>Create</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}