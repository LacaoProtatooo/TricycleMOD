import React from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../components/common/theme';
import styles from '../operatorStyles';

export default function AssignDriverModal({
  visible,
  onClose,
  onSubmit,
  availableDrivers,
  selectedTricycle,
  assigning,
  assignmentType,
  setAssignmentType,
  schedule,
  setSchedule
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView 
        style={styles.modalContainer} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Assign Driver</Text>
          <Text style={styles.modalSub}>
            Select a driver for {selectedTricycle?.plate || selectedTricycle?.plateNumber || 'this tricycle'}
          </Text>

          {/* Assignment Type Toggle */}
          <View style={{ flexDirection: 'row', marginBottom: 16 }}>
            <TouchableOpacity 
              style={{ 
                flex: 1, 
                padding: 10, 
                backgroundColor: assignmentType === 'exclusive' ? colors.primary : '#eee',
                alignItems: 'center',
                borderTopLeftRadius: 8,
                borderBottomLeftRadius: 8
              }}
              onPress={() => setAssignmentType('exclusive')}
            >
              <Text style={{ color: assignmentType === 'exclusive' ? '#fff' : '#333', fontWeight: '600' }}>
                Exclusive
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={{ 
                flex: 1, 
                padding: 10, 
                backgroundColor: assignmentType === 'shared' ? colors.primary : '#eee',
                alignItems: 'center',
                borderTopRightRadius: 8,
                borderBottomRightRadius: 8
              }}
              onPress={() => setAssignmentType('shared')}
            >
              <Text style={{ color: assignmentType === 'shared' ? '#fff' : '#333', fontWeight: '600' }}>
                Shared Schedule
              </Text>
            </TouchableOpacity>
          </View>

          {assignmentType === 'shared' && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ marginBottom: 8, fontWeight: '600' }}>Schedule Days:</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                  <TouchableOpacity 
                    key={day}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 16,
                      backgroundColor: schedule.days.includes(day) ? colors.primary : '#eee'
                    }}
                    onPress={() => {
                      const newDays = schedule.days.includes(day) 
                        ? schedule.days.filter(d => d !== day)
                        : [...schedule.days, day];
                      setSchedule({ ...schedule, days: newDays });
                    }}
                  >
                    <Text style={{ color: schedule.days.includes(day) ? '#fff' : '#333', fontSize: 12 }}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, marginBottom: 4 }}>Start Time</Text>
                  <TextInput 
                    style={[styles.textInput, { marginBottom: 0 }]} 
                    value={schedule.startTime}
                    onChangeText={(t) => setSchedule({...schedule, startTime: t})}
                    placeholder="08:00"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, marginBottom: 4 }}>End Time</Text>
                  <TextInput 
                    style={[styles.textInput, { marginBottom: 0 }]} 
                    value={schedule.endTime}
                    onChangeText={(t) => setSchedule({...schedule, endTime: t})}
                    placeholder="17:00"
                  />
                </View>
              </View>
            </View>
          )}

          <ScrollView style={styles.driverList}>
            {availableDrivers.length === 0 ? (
              <Text style={styles.emptyText}>No available drivers</Text>
            ) : (
              availableDrivers.map((driver) => (
                <TouchableOpacity
                  key={driver._id || driver.id}
                  style={styles.driverOption}
                  onPress={() => onSubmit(selectedTricycle?.id || selectedTricycle?._id, driver._id || driver.id)}
                  disabled={assigning}
                >
                  <View style={styles.driverOptionAvatar}>
                    {driver.image?.url ? (
                      <Image source={{ uri: driver.image.url }} style={styles.driverOptionAvatarImage} />
                    ) : (
                      <Ionicons name="person" size={24} color={colors.orangeShade5} />
                    )}
                  </View>
                  
                  <View style={styles.driverOptionInfo}>
                    <Text style={styles.driverOptionName}>
                      {driver.firstname} {driver.lastname}
                    </Text>
                    <Text style={styles.driverOptionUsername}>@{driver.username}</Text>
                  </View>
                  
                  {assigning && <ActivityIndicator size="small" color={colors.primary} />}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
          
          <View style={styles.modalActions}>
            <TouchableOpacity 
              style={[styles.modalBtn, { backgroundColor: '#6c757d' }]} 
              onPress={onClose} 
              disabled={assigning}
            >
              <Text style={styles.modalBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}