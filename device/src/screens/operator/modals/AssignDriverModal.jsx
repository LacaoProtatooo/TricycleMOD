import React, { useState } from 'react';
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
  ActivityIndicator,
  StyleSheet,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../components/common/theme';
import styles from '../operatorStyles';

const BOUNDARY_OPTIONS = [300, 350, 400, 450, 500, 550, 600, 650, 700];
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  setSchedule,
  boundary,
  setBoundary
}) {
  // State for selected driver in shared mode
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [step, setStep] = useState(1); // Step 1: Select driver, Step 2: Configure schedule

  // Reset state when modal closes or assignment type changes
  const handleClose = () => {
    setSelectedDriver(null);
    setStep(1);
    onClose();
  };

  const handleAssignmentTypeChange = (type) => {
    setAssignmentType(type);
    setSelectedDriver(null);
    setStep(1);
  };

  // Handle driver selection in shared mode
  const handleDriverSelect = (driver) => {
    if (assignmentType === 'shared') {
      setSelectedDriver(driver);
      setStep(2);
      // Reset schedule for new driver
      setSchedule({ days: [], startTime: '08:00', endTime: '17:00' });
    } else {
      // Exclusive mode - directly assign
      onSubmit(selectedTricycle?.id || selectedTricycle?._id, driver._id || driver.id);
    }
  };

  // Handle back button in shared mode
  const handleBack = () => {
    setSelectedDriver(null);
    setStep(1);
  };

  // Handle confirm assignment in shared mode
  const handleConfirmAssignment = () => {
    if (selectedDriver) {
      onSubmit(selectedTricycle?.id || selectedTricycle?._id, selectedDriver._id || selectedDriver.id);
      setSelectedDriver(null);
      setStep(1);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={localStyles.overlay}>
        <KeyboardAvoidingView 
          style={localStyles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={localStyles.modalBox}>
            {/* Fixed Header */}
            <View style={localStyles.header}>
              <View style={localStyles.headerRow}>
                {assignmentType === 'shared' && step === 2 && (
                  <TouchableOpacity onPress={handleBack} style={localStyles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.primary} />
                  </TouchableOpacity>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>
                    {assignmentType === 'shared' && step === 2 
                      ? 'Configure Schedule' 
                      : 'Assign Driver'}
                  </Text>
                  <Text style={styles.modalSub}>
                    {assignmentType === 'shared' && step === 2 
                      ? `Set schedule for ${selectedDriver?.firstname} ${selectedDriver?.lastname}`
                      : `Select a driver for ${selectedTricycle?.plate || selectedTricycle?.plateNumber || 'this tricycle'}`}
                  </Text>
                </View>
              </View>
            </View>

            {/* Scrollable Content */}
            <ScrollView 
              style={localStyles.scrollArea}
              contentContainerStyle={localStyles.scrollContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              {/* Assignment Type Toggle - Only show on step 1 */}
              {step === 1 && (
                <View style={localStyles.toggleRow}>
                  <TouchableOpacity 
                    style={[
                      localStyles.toggleBtn, 
                      localStyles.toggleBtnLeft,
                      assignmentType === 'exclusive' && localStyles.toggleBtnActive
                    ]}
                    onPress={() => handleAssignmentTypeChange('exclusive')}
                  >
                    <Text style={[
                      localStyles.toggleBtnText,
                      assignmentType === 'exclusive' && localStyles.toggleBtnTextActive
                    ]}>
                      Exclusive
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[
                      localStyles.toggleBtn, 
                      localStyles.toggleBtnRight,
                      assignmentType === 'shared' && localStyles.toggleBtnActive
                    ]}
                    onPress={() => handleAssignmentTypeChange('shared')}
                  >
                    <Text style={[
                      localStyles.toggleBtnText,
                      assignmentType === 'shared' && localStyles.toggleBtnTextActive
                    ]}>
                      Shared Schedule
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Step 2: Schedule & Boundary Configuration for Selected Driver */}
              {assignmentType === 'shared' && step === 2 && selectedDriver && (
                <>
                  {/* Selected Driver Info */}
                  <View style={localStyles.selectedDriverCard}>
                    <View style={styles.driverOptionAvatar}>
                      {selectedDriver.image?.url ? (
                        <Image source={{ uri: selectedDriver.image.url }} style={styles.driverOptionAvatarImage} />
                      ) : (
                        <Ionicons name="person" size={24} color={colors.orangeShade5} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={localStyles.selectedDriverName}>
                        {selectedDriver.firstname} {selectedDriver.lastname}
                      </Text>
                      <Text style={localStyles.selectedDriverUsername}>@{selectedDriver.username}</Text>
                    </View>
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  </View>

                  {/* Schedule Section */}
                  <View style={localStyles.section}>
                    <Text style={localStyles.sectionTitle}>
                      <Ionicons name="calendar-outline" size={16} /> Schedule Days
                    </Text>
                    <Text style={localStyles.sectionHint}>
                      Select the days this driver will operate
                    </Text>
                    <View style={localStyles.daysRow}>
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                        <TouchableOpacity 
                          key={day}
                          style={[
                            localStyles.dayChip,
                            schedule.days.includes(day) && localStyles.dayChipActive
                          ]}
                          onPress={() => {
                            const newDays = schedule.days.includes(day) 
                              ? schedule.days.filter(d => d !== day)
                              : [...schedule.days, day];
                            setSchedule({ ...schedule, days: newDays });
                          }}
                        >
                          <Text style={[
                            localStyles.dayChipText,
                            schedule.days.includes(day) && localStyles.dayChipTextActive
                          ]}>
                            {day}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    
                    <View style={localStyles.timeRow}>
                      <View style={localStyles.timeInput}>
                        <Text style={localStyles.timeLabel}>Start Time</Text>
                        <TextInput 
                          style={[styles.textInput, { marginBottom: 0 }]} 
                          value={schedule.startTime}
                          onChangeText={(t) => setSchedule({...schedule, startTime: t})}
                          placeholder="08:00"
                        />
                      </View>
                      <View style={localStyles.timeInput}>
                        <Text style={localStyles.timeLabel}>End Time</Text>
                        <TextInput 
                          style={[styles.textInput, { marginBottom: 0 }]} 
                          value={schedule.endTime}
                          onChangeText={(t) => setSchedule({...schedule, endTime: t})}
                          placeholder="17:00"
                        />
                      </View>
                    </View>
                  </View>

                  {/* Boundary/Koding Section */}
                  <View style={localStyles.boundarySection}>
                    <Text style={localStyles.boundarySectionTitle}>
                      <Ionicons name="cash-outline" size={16} /> Boundary (Koding)
                    </Text>
                    <Text style={localStyles.sectionHint}>
                      Set the boundary amount for this driver
                    </Text>
                    
                    <Text style={localStyles.boundaryRate}>
                      Daily Rate: ₱{boundary.amount}
                    </Text>
                    
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false} 
                      style={localStyles.boundaryScroll}
                      nestedScrollEnabled={true}
                    >
                      <View style={localStyles.boundaryOptions}>
                        {BOUNDARY_OPTIONS.map((amount) => (
                          <TouchableOpacity
                            key={amount}
                            style={[
                              localStyles.boundaryChip,
                              boundary.amount === amount && localStyles.boundaryChipActive
                            ]}
                            onPress={() => setBoundary({ ...boundary, amount })}
                          >
                            <Text style={[
                              localStyles.boundaryChipText,
                              boundary.amount === amount && localStyles.boundaryChipTextActive
                            ]}>
                              ₱{amount}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>

                    <Text style={localStyles.settlementLabel}>Settlement Type:</Text>
                    <View style={localStyles.settlementRow}>
                      <TouchableOpacity
                        style={[
                          localStyles.settlementBtn,
                          boundary.settlementType === 'daily' && localStyles.settlementBtnActive
                        ]}
                        onPress={() => setBoundary({ ...boundary, settlementType: 'daily' })}
                      >
                        <Text style={[
                          localStyles.settlementBtnText,
                          boundary.settlementType === 'daily' && localStyles.settlementBtnTextActive
                        ]}>
                          Daily
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          localStyles.settlementBtn,
                          boundary.settlementType === 'weekly' && localStyles.settlementBtnActive
                        ]}
                        onPress={() => setBoundary({ ...boundary, settlementType: 'weekly' })}
                      >
                        <Text style={[
                          localStyles.settlementBtnText,
                          boundary.settlementType === 'weekly' && localStyles.settlementBtnTextActive
                        ]}>
                          Weekly (₱{boundary.amount * 7})
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <TextInput
                      style={[styles.textInput, { marginTop: 10, marginBottom: 0 }]}
                      value={boundary.notes}
                      onChangeText={(t) => setBoundary({ ...boundary, notes: t })}
                      placeholder="Notes (optional, e.g., 'Sundays free')"
                      maxLength={200}
                    />
                  </View>
                </>
              )}

              {/* Step 1: Driver List (Exclusive mode shows boundary first, Shared mode shows drivers to select) */}
              {step === 1 && (
                <>
                  {/* Boundary Section for Exclusive Mode */}
                  {assignmentType === 'exclusive' && (
                    <View style={localStyles.boundarySection}>
                      <Text style={localStyles.boundarySectionTitle}>
                        <Ionicons name="cash-outline" size={16} /> Boundary (Koding)
                      </Text>
                      
                      <Text style={localStyles.boundaryRate}>
                        Daily Rate: ₱{boundary.amount}
                      </Text>
                      
                      <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false} 
                        style={localStyles.boundaryScroll}
                        nestedScrollEnabled={true}
                      >
                        <View style={localStyles.boundaryOptions}>
                          {BOUNDARY_OPTIONS.map((amount) => (
                            <TouchableOpacity
                              key={amount}
                              style={[
                                localStyles.boundaryChip,
                                boundary.amount === amount && localStyles.boundaryChipActive
                              ]}
                              onPress={() => setBoundary({ ...boundary, amount })}
                            >
                              <Text style={[
                                localStyles.boundaryChipText,
                                boundary.amount === amount && localStyles.boundaryChipTextActive
                              ]}>
                                ₱{amount}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>

                      <Text style={localStyles.settlementLabel}>Settlement Type:</Text>
                      <View style={localStyles.settlementRow}>
                        <TouchableOpacity
                          style={[
                            localStyles.settlementBtn,
                            boundary.settlementType === 'daily' && localStyles.settlementBtnActive
                          ]}
                          onPress={() => setBoundary({ ...boundary, settlementType: 'daily' })}
                        >
                          <Text style={[
                            localStyles.settlementBtnText,
                            boundary.settlementType === 'daily' && localStyles.settlementBtnTextActive
                          ]}>
                            Daily
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            localStyles.settlementBtn,
                            boundary.settlementType === 'weekly' && localStyles.settlementBtnActive
                          ]}
                          onPress={() => setBoundary({ ...boundary, settlementType: 'weekly' })}
                        >
                          <Text style={[
                            localStyles.settlementBtnText,
                            boundary.settlementType === 'weekly' && localStyles.settlementBtnTextActive
                          ]}>
                            Weekly (₱{boundary.amount * 7})
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <TextInput
                        style={[styles.textInput, { marginTop: 10, marginBottom: 0 }]}
                        value={boundary.notes}
                        onChangeText={(t) => setBoundary({ ...boundary, notes: t })}
                        placeholder="Notes (optional, e.g., 'Sundays free')"
                        maxLength={200}
                      />
                    </View>
                  )}

                  {/* Driver List */}
                  <View style={localStyles.driverSection}>
                    <Text style={localStyles.driverSectionTitle}>
                      <Ionicons name="people-outline" size={16} /> 
                      {assignmentType === 'shared' ? ' Select Driver to Configure' : ' Select Driver'}
                    </Text>
                    {assignmentType === 'shared' && (
                      <Text style={localStyles.sectionHint}>
                        Tap a driver to set their individual schedule and boundary
                      </Text>
                    )}
                    {availableDrivers.length === 0 ? (
                      <Text style={styles.emptyText}>No available drivers</Text>
                    ) : (
                      availableDrivers.map((driver) => (
                        <TouchableOpacity
                          key={driver._id || driver.id}
                          style={[
                            styles.driverOption,
                            assignmentType === 'shared' && localStyles.driverOptionShared
                          ]}
                          onPress={() => handleDriverSelect(driver)}
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
                          
                          {assigning ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                          ) : assignmentType === 'shared' ? (
                            <Ionicons name="chevron-forward" size={20} color={colors.orangeShade5} />
                          ) : null}
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                </>
              )}
            </ScrollView>
            
            {/* Fixed Footer */}
            <View style={localStyles.footer}>
              {assignmentType === 'shared' && step === 2 ? (
                <View style={localStyles.footerButtons}>
                  <TouchableOpacity 
                    style={[localStyles.footerBtn, localStyles.footerBtnCancel]} 
                    onPress={handleBack}
                  >
                    <Text style={localStyles.footerBtnCancelText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[
                      localStyles.footerBtn, 
                      localStyles.footerBtnConfirm,
                      schedule.days.length === 0 && localStyles.footerBtnDisabled
                    ]} 
                    onPress={handleConfirmAssignment}
                    disabled={assigning || schedule.days.length === 0}
                  >
                    {assigning ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={localStyles.footerBtnConfirmText}>
                        Assign Driver
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity 
                  style={[styles.modalBtn, { backgroundColor: '#6c757d' }]} 
                  onPress={handleClose} 
                  disabled={assigning}
                >
                  <Text style={styles.modalBtnText}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const localStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.85,
    paddingHorizontal: 16,
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: SCREEN_HEIGHT * 0.8,
    overflow: 'hidden',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    marginRight: 12,
    padding: 4,
  },
  scrollArea: {
    maxHeight: SCREEN_HEIGHT * 0.55,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 8,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  footerBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnCancel: {
    backgroundColor: '#f0f0f0',
  },
  footerBtnCancelText: {
    color: '#666',
    fontWeight: '600',
  },
  footerBtnConfirm: {
    backgroundColor: colors.primary,
  },
  footerBtnConfirmText: {
    color: '#fff',
    fontWeight: '600',
  },
  footerBtnDisabled: {
    backgroundColor: '#ccc',
  },
  toggleRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    padding: 10,
    backgroundColor: '#eee',
    alignItems: 'center',
  },
  toggleBtnLeft: {
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  toggleBtnRight: {
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: colors.primary,
  },
  toggleBtnText: {
    color: '#333',
    fontWeight: '600',
  },
  toggleBtnTextActive: {
    color: '#fff',
  },
  selectedDriverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  selectedDriverName: {
    fontWeight: '600',
    fontSize: 16,
    color: '#333',
  },
  selectedDriverUsername: {
    fontSize: 12,
    color: '#666',
  },
  section: {
    marginBottom: 16,
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 4,
    color: colors.primary,
  },
  sectionLabel: {
    marginBottom: 8,
    fontWeight: '600',
  },
  sectionHint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#eee',
  },
  dayChipActive: {
    backgroundColor: colors.primary,
  },
  dayChipText: {
    color: '#333',
    fontSize: 12,
    fontWeight: '500',
  },
  dayChipTextActive: {
    color: '#fff',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  timeInput: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '500',
  },
  boundarySection: {
    marginBottom: 16,
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
  },
  boundarySectionTitle: {
    fontWeight: '600',
    marginBottom: 4,
    color: colors.primary,
  },
  boundaryRate: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  boundaryScroll: {
    marginBottom: 8,
  },
  boundaryOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  boundaryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e9ecef',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  boundaryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  boundaryChipText: {
    color: '#495057',
    fontWeight: '400',
    fontSize: 13,
  },
  boundaryChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  settlementLabel: {
    fontSize: 12,
    marginTop: 8,
    marginBottom: 6,
    fontWeight: '500',
  },
  settlementRow: {
    flexDirection: 'row',
    gap: 10,
  },
  settlementBtn: {
    flex: 1,
    padding: 10,
    backgroundColor: '#eee',
    alignItems: 'center',
    borderRadius: 8,
  },
  settlementBtnActive: {
    backgroundColor: colors.primary,
  },
  settlementBtnText: {
    color: '#333',
    fontWeight: '500',
  },
  settlementBtnTextActive: {
    color: '#fff',
  },
  driverSection: {
    marginTop: 8,
  },
  driverSectionTitle: {
    fontWeight: '600',
    marginBottom: 4,
    color: colors.primary,
  },
  driverOptionShared: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    marginBottom: 8,
  },
});
