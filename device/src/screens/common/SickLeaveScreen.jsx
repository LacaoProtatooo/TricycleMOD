import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { colors, spacing } from '../../components/common/theme';
import { useAsyncSQLiteContext } from '../../utils/asyncSQliteProvider';
import { getToken } from '../../utils/jwtStorage';
import { API_URL } from '../../utils/config';

const BACKEND = API_URL;

const SickLeaveScreen = ({ navigation }) => {
  const db = useAsyncSQLiteContext();
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [hasAssignment, setHasAssignment] = useState(true);
  const [statistics, setStatistics] = useState(null);
  
  // Form state
  const [reason, setReason] = useState('');
  const [selectedStartDate, setSelectedStartDate] = useState(null);
  const [selectedEndDate, setSelectedEndDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [medicalCertificate, setMedicalCertificate] = useState(null);
  const [medicalCertificateBase64, setMedicalCertificateBase64] = useState(null);
  
  // Emergency contact
  const [showEmergencyContact, setShowEmergencyContact] = useState(false);
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRelationship, setEmergencyRelationship] = useState('');
  
  // View details modal
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // Filter
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (db) {
      loadTokenAndFetch();
    }
  }, [db]);

  const loadTokenAndFetch = async () => {
    const t = await getToken(db);
    setToken(t);
    if (t) {
      fetchHistory(t);
    }
  };

  const fetchHistory = async (authToken) => {
    try {
      const res = await fetch(`${BACKEND}/api/sick-leave/driver`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setHistory(data.data);
        if (data.hasAssignment !== undefined) {
          setHasAssignment(data.hasAssignment);
        }
        if (data.statistics) {
          setStatistics(data.statistics);
        }
      }
    } catch (error) {
      console.error('Error fetching sick leave history:', error);
    }
  };

  const pickMedicalCertificate = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Permission to access media library is needed.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (result?.canceled === true) return;
      const uri = result?.assets?.[0]?.uri || result?.uri;

      if (uri) {
        setMedicalCertificate(uri);
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        setMedicalCertificateBase64(`data:image/jpeg;base64,${base64}`);
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  const handleSubmit = async () => {
    if (!hasAssignment) {
      Alert.alert('Error', 'You are not assigned to any tricycle/operator.');
      return;
    }
    if (!selectedStartDate || !selectedEndDate || !reason.trim()) {
      Alert.alert('Error', 'Please select start/end dates and provide a reason.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        startDate: selectedStartDate,
        endDate: selectedEndDate,
        reason,
        medicalCertificateBase64
      };
      
      if (showEmergencyContact && emergencyName && emergencyPhone) {
        payload.emergencyContact = {
          name: emergencyName,
          phone: emergencyPhone,
          relationship: emergencyRelationship
        };
      }

      const res = await fetch(`${BACKEND}/api/sick-leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Success', 'Sick leave request submitted.');
        resetForm();
        fetchHistory(token);
      } else {
        Alert.alert('Error', data.message || 'Failed to submit request.');
      }
    } catch (error) {
      console.error('Error submitting sick leave:', error);
      Alert.alert('Error', 'Failed to submit request.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id) => {
    Alert.alert(
      'Cancel Request',
      'Are you sure you want to cancel this sick leave request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${BACKEND}/api/sick-leave/${id}/cancel`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}` }
              });
              const data = await res.json();
              if (data.success) {
                Alert.alert('Success', 'Request cancelled');
                fetchHistory(token);
              } else {
                Alert.alert('Error', data.message);
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel request');
            }
          }
        }
      ]
    );
  };

  const resetForm = () => {
    setReason('');
    setSelectedStartDate(null);
    setSelectedEndDate(null);
    setMedicalCertificate(null);
    setMedicalCertificateBase64(null);
    setEmergencyName('');
    setEmergencyPhone('');
    setEmergencyRelationship('');
    setShowEmergencyContact(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return '#27ae60';
      case 'rejected': return '#e74c3c';
      case 'cancelled': return '#95a5a6';
      default: return '#f39c12';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return 'checkmark-circle';
      case 'rejected': return 'close-circle';
      case 'cancelled': return 'ban';
      default: return 'time';
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-PH', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const calculateDays = (start, end) => {
    const s = new Date(start);
    const e = new Date(end);
    return Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;
  };

  // Filter history
  const filteredHistory = statusFilter === 'all' 
    ? history 
    : history.filter(h => h.status === statusFilter);

  // Simple Calendar Component
  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const dateStr = date.toISOString().split('T')[0];
      const isPast = date < today;
      const isSelectedStart = selectedStartDate === dateStr;
      const isSelectedEnd = selectedEndDate === dateStr;
      const isInRange = selectedStartDate && selectedEndDate && dateStr > selectedStartDate && dateStr < selectedEndDate;
      const isToday = date.toDateString() === today.toDateString();
      
      let bg = 'transparent';
      let txtColor = isPast ? '#ccc' : '#333';

      if (isSelectedStart || isSelectedEnd) {
        bg = colors.primary;
        txtColor = '#fff';
      } else if (isInRange) {
        bg = colors.primary + '30';
      } else if (isToday) {
        bg = '#f0f0f0';
      }

      days.push(
        <TouchableOpacity
          key={i}
          style={[styles.dayCell, { backgroundColor: bg }]}
          onPress={() => !isPast && handleDatePress(dateStr)}
          disabled={isPast}
        >
          <Text style={{ color: txtColor, fontWeight: isToday ? '700' : '400' }}>{i}</Text>
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.calendarContainer}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity onPress={() => setCurrentMonth(new Date(year, month - 1, 1))} style={styles.calendarNavBtn}>
            <Ionicons name="chevron-back" size={20} color="#333" />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>
            {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </Text>
          <TouchableOpacity onPress={() => setCurrentMonth(new Date(year, month + 1, 1))} style={styles.calendarNavBtn}>
            <Ionicons name="chevron-forward" size={20} color="#333" />
          </TouchableOpacity>
        </View>
        <View style={styles.weekDays}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
            <Text key={idx} style={styles.weekDayText}>{d}</Text>
          ))}
        </View>
        <View style={styles.daysGrid}>
          {days}
        </View>
      </View>
    );
  };

  const handleDatePress = (dateStr) => {
    if (!selectedStartDate || (selectedStartDate && selectedEndDate)) {
      setSelectedStartDate(dateStr);
      setSelectedEndDate(null);
    } else {
      if (dateStr < selectedStartDate) {
        setSelectedStartDate(dateStr);
      } else {
        setSelectedEndDate(dateStr);
      }
    }
  };

  // Detail Modal
  const renderDetailModal = () => (
    <Modal
      visible={showDetailModal}
      animationType="slide"
      transparent
      onRequestClose={() => setShowDetailModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Sick Leave Details</Text>
            <TouchableOpacity onPress={() => setShowDetailModal(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {selectedLeave && (
            <ScrollView style={styles.modalBody}>
              {/* Status Badge */}
              <View style={[styles.statusBadgeLarge, { backgroundColor: getStatusColor(selectedLeave.status) + '20' }]}>
                <Ionicons name={getStatusIcon(selectedLeave.status)} size={24} color={getStatusColor(selectedLeave.status)} />
                <Text style={[styles.statusTextLarge, { color: getStatusColor(selectedLeave.status) }]}>
                  {selectedLeave.status.toUpperCase()}
                </Text>
              </View>

              {/* Dates */}
              <View style={styles.detailRow}>
                <Ionicons name="calendar" size={20} color="#666" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Duration</Text>
                  <Text style={styles.detailValue}>
                    {formatDate(selectedLeave.startDate)} - {formatDate(selectedLeave.endDate)}
                  </Text>
                  <Text style={styles.detailSubValue}>
                    {calculateDays(selectedLeave.startDate, selectedLeave.endDate)} day(s)
                  </Text>
                </View>
              </View>

              {/* Reason */}
              <View style={styles.detailRow}>
                <Ionicons name="document-text" size={20} color="#666" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Reason</Text>
                  <Text style={styles.detailValue}>{selectedLeave.reason}</Text>
                </View>
              </View>

              {/* Rejection Reason */}
              {selectedLeave.status === 'rejected' && selectedLeave.rejectionReason && (
                <View style={[styles.detailRow, { backgroundColor: '#fee' }]}>
                  <Ionicons name="alert-circle" size={20} color="#e74c3c" />
                  <View style={styles.detailTextContainer}>
                    <Text style={[styles.detailLabel, { color: '#e74c3c' }]}>Rejection Reason</Text>
                    <Text style={styles.detailValue}>{selectedLeave.rejectionReason}</Text>
                  </View>
                </View>
              )}

              {/* Reviewed By */}
              {selectedLeave.reviewedBy && (
                <View style={styles.detailRow}>
                  <Ionicons name="person" size={20} color="#666" />
                  <View style={styles.detailTextContainer}>
                    <Text style={styles.detailLabel}>Reviewed By</Text>
                    <Text style={styles.detailValue}>
                      {selectedLeave.reviewedBy.firstname} {selectedLeave.reviewedBy.lastname}
                    </Text>
                    {selectedLeave.reviewedAt && (
                      <Text style={styles.detailSubValue}>
                        on {formatDate(selectedLeave.reviewedAt)}
                      </Text>
                    )}
                  </View>
                </View>
              )}

              {/* Medical Certificate */}
              {selectedLeave.medicalCertificate?.url && (
                <View style={styles.detailRow}>
                  <MaterialCommunityIcons name="file-document" size={20} color="#666" />
                  <View style={styles.detailTextContainer}>
                    <Text style={styles.detailLabel}>Medical Certificate</Text>
                    <Image 
                      source={{ uri: selectedLeave.medicalCertificate.url }} 
                      style={styles.certificateImage}
                      resizeMode="contain"
                    />
                  </View>
                </View>
              )}

              {/* Emergency Contact */}
              {selectedLeave.emergencyContact?.name && (
                <View style={styles.detailRow}>
                  <Ionicons name="call" size={20} color="#666" />
                  <View style={styles.detailTextContainer}>
                    <Text style={styles.detailLabel}>Emergency Contact</Text>
                    <Text style={styles.detailValue}>{selectedLeave.emergencyContact.name}</Text>
                    <Text style={styles.detailSubValue}>
                      {selectedLeave.emergencyContact.phone} ({selectedLeave.emergencyContact.relationship})
                    </Text>
                  </View>
                </View>
              )}

              {/* Submitted Date */}
              <View style={styles.detailRow}>
                <Ionicons name="time" size={20} color="#666" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Submitted</Text>
                  <Text style={styles.detailValue}>{formatDate(selectedLeave.createdAt)}</Text>
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Sick Leave</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Statistics Cards */}
        {statistics && (
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: '#e3f2fd' }]}>
              <Text style={[styles.statNumber, { color: '#1976d2' }]}>{statistics.totalDaysUsed}</Text>
              <Text style={styles.statLabel}>Days Used</Text>
              <Text style={styles.statYear}>{statistics.year}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#fff3e0' }]}>
              <Text style={[styles.statNumber, { color: '#f57c00' }]}>{statistics.pendingRequests}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#e8f5e9' }]}>
              <Text style={[styles.statNumber, { color: '#388e3c' }]}>{statistics.approvedCount}</Text>
              <Text style={styles.statLabel}>Approved</Text>
            </View>
          </View>
        )}

        {/* Assignment Warning */}
        {!hasAssignment && (
          <View style={styles.warningBox}>
            <Ionicons name="alert-circle" size={24} color="#d32f2f" />
            <Text style={styles.warningText}>
              You are not assigned to any tricycle/operator. You cannot file a sick leave.
            </Text>
          </View>
        )}

        {/* New Request Form */}
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="add-circle" size={18} color={colors.primary} /> New Request
          </Text>
          
          {renderCalendar()}
          
          {/* Selected Dates Display */}
          <View style={styles.dateDisplay}>
            <View style={styles.dateBox}>
              <Text style={styles.dateBoxLabel}>Start Date</Text>
              <Text style={styles.dateBoxValue}>
                {selectedStartDate ? formatDate(selectedStartDate) : 'Select'}
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color="#999" />
            <View style={styles.dateBox}>
              <Text style={styles.dateBoxLabel}>End Date</Text>
              <Text style={styles.dateBoxValue}>
                {selectedEndDate ? formatDate(selectedEndDate) : 'Select'}
              </Text>
            </View>
            {selectedStartDate && selectedEndDate && (
              <View style={styles.daysBox}>
                <Text style={styles.daysBoxValue}>
                  {calculateDays(selectedStartDate, selectedEndDate)}
                </Text>
                <Text style={styles.daysBoxLabel}>day(s)</Text>
              </View>
            )}
          </View>

          {/* Reason */}
          <Text style={styles.inputLabel}>Reason *</Text>
          <TextInput
            style={[styles.input, styles.textArea, !hasAssignment && styles.inputDisabled]}
            placeholder="Describe your illness or reason for sick leave..."
            multiline
            numberOfLines={3}
            value={reason}
            onChangeText={setReason}
            editable={hasAssignment}
          />

          {/* Medical Certificate Upload */}
          <Text style={styles.inputLabel}>Medical Certificate (Optional)</Text>
          <TouchableOpacity 
            style={styles.uploadBtn}
            onPress={pickMedicalCertificate}
            disabled={!hasAssignment}
          >
            {medicalCertificate ? (
              <View style={styles.uploadedContainer}>
                <Image source={{ uri: medicalCertificate }} style={styles.uploadedImage} />
                <TouchableOpacity 
                  style={styles.removeImageBtn}
                  onPress={() => { setMedicalCertificate(null); setMedicalCertificateBase64(null); }}
                >
                  <Ionicons name="close-circle" size={24} color="#e74c3c" />
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <MaterialCommunityIcons name="file-upload-outline" size={32} color={colors.primary} />
                <Text style={styles.uploadText}>Tap to upload medical certificate</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Emergency Contact Toggle */}
          <TouchableOpacity 
            style={styles.toggleRow}
            onPress={() => setShowEmergencyContact(!showEmergencyContact)}
          >
            <Ionicons 
              name={showEmergencyContact ? "checkbox" : "square-outline"} 
              size={22} 
              color={colors.primary} 
            />
            <Text style={styles.toggleText}>Add Emergency Contact</Text>
          </TouchableOpacity>

          {showEmergencyContact && (
            <View style={styles.emergencySection}>
              <TextInput
                style={styles.input}
                placeholder="Contact Name"
                value={emergencyName}
                onChangeText={setEmergencyName}
              />
              <TextInput
                style={styles.input}
                placeholder="Phone Number"
                value={emergencyPhone}
                onChangeText={setEmergencyPhone}
                keyboardType="phone-pad"
              />
              <TextInput
                style={styles.input}
                placeholder="Relationship (e.g., Spouse, Parent)"
                value={emergencyRelationship}
                onChangeText={setEmergencyRelationship}
              />
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity 
            style={[styles.submitBtn, (loading || !hasAssignment) && styles.submitBtnDisabled]} 
            onPress={handleSubmit}
            disabled={loading || !hasAssignment}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={18} color="#fff" />
                <Text style={styles.submitBtnText}>Submit Request</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* History Section */}
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="time" size={18} color={colors.primary} /> Request History
          </Text>

          {/* Filter Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            {['all', 'pending', 'approved', 'rejected', 'cancelled'].map(status => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.filterChip,
                  statusFilter === status && styles.filterChipActive
                ]}
                onPress={() => setStatusFilter(status)}
              >
                <Text style={[
                  styles.filterChipText,
                  statusFilter === status && styles.filterChipTextActive
                ]}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {filteredHistory.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No sick leave requests</Text>
            </View>
          ) : (
            filteredHistory.map((item) => (
              <TouchableOpacity 
                key={item._id} 
                style={[styles.historyItem, { borderLeftColor: getStatusColor(item.status) }]}
                onPress={() => { setSelectedLeave(item); setShowDetailModal(true); }}
              >
                <View style={styles.historyItemHeader}>
                  <View style={styles.historyItemDates}>
                    <Text style={styles.historyDate}>
                      {formatDate(item.startDate)} - {formatDate(item.endDate)}
                    </Text>
                    <Text style={styles.historyDays}>
                      {calculateDays(item.startDate, item.endDate)} day(s)
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                    <Ionicons name={getStatusIcon(item.status)} size={14} color={getStatusColor(item.status)} />
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                      {item.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.historyReason} numberOfLines={2}>{item.reason}</Text>
                
                {/* Cancel button for pending */}
                {item.status === 'pending' && (
                  <TouchableOpacity 
                    style={styles.cancelBtn}
                    onPress={() => handleCancel(item._id)}
                  >
                    <Ionicons name="close-circle-outline" size={16} color="#e74c3c" />
                    <Text style={styles.cancelBtnText}>Cancel Request</Text>
                  </TouchableOpacity>
                )}

                {/* Show rejection reason preview */}
                {item.status === 'rejected' && item.rejectionReason && (
                  <View style={styles.rejectionPreview}>
                    <Ionicons name="information-circle" size={14} color="#e74c3c" />
                    <Text style={styles.rejectionPreviewText} numberOfLines={1}>
                      {item.rejectionReason}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {renderDetailModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.medium,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700', color: '#333' },
  content: { padding: spacing.medium, paddingBottom: 40 },
  
  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statNumber: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 11, color: '#666', marginTop: 2 },
  statYear: { fontSize: 10, color: '#999' },

  // Warning
  warningBox: {
    backgroundColor: '#ffebee',
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  warningText: { color: '#d32f2f', flex: 1, fontWeight: '500', fontSize: 13 },

  // Form Card
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: '#333' },
  
  // Calendar
  calendarContainer: { backgroundColor: '#fafafa', borderRadius: 10, padding: 10, marginBottom: 12 },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  calendarNavBtn: { padding: 6 },
  monthTitle: { fontSize: 15, fontWeight: '600', color: '#333' },
  weekDays: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 6 },
  weekDayText: { width: 36, textAlign: 'center', color: '#888', fontSize: 12, fontWeight: '600' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { 
    width: '14.28%', 
    aspectRatio: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderRadius: 18 
  },
  
  // Date Display
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  dateBox: { flex: 1 },
  dateBoxLabel: { fontSize: 10, color: '#888', marginBottom: 2 },
  dateBoxValue: { fontSize: 13, fontWeight: '600', color: '#333' },
  daysBox: { 
    backgroundColor: colors.primary, 
    borderRadius: 8, 
    padding: 8, 
    alignItems: 'center',
    minWidth: 50,
  },
  daysBoxValue: { fontSize: 18, fontWeight: '700', color: '#fff' },
  daysBoxLabel: { fontSize: 9, color: '#fff' },

  // Inputs
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  inputDisabled: { backgroundColor: '#f0f0f0', color: '#999' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },

  // Upload
  uploadBtn: {
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  uploadText: { color: '#888', marginTop: 8, fontSize: 13 },
  uploadedContainer: { position: 'relative', width: '100%' },
  uploadedImage: { width: '100%', height: 150, borderRadius: 8 },
  removeImageBtn: { position: 'absolute', top: -8, right: -8 },

  // Toggle
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 12 },
  toggleText: { fontSize: 14, color: '#333' },

  // Emergency Contact
  emergencySection: { 
    backgroundColor: '#f9f9f9', 
    borderRadius: 8, 
    padding: 12, 
    marginBottom: 12 
  },

  // Submit
  submitBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 10,
    gap: 8,
    marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // History
  historySection: { marginTop: 8 },
  filterScroll: { marginBottom: 12 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: 12, color: '#666', fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },

  historyItem: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  historyItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  historyItemDates: { flex: 1 },
  historyDate: { fontWeight: '600', fontSize: 14, color: '#333' },
  historyDays: { fontSize: 12, color: '#888', marginTop: 2 },
  historyReason: { color: '#555', fontSize: 13, lineHeight: 18 },
  
  statusBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 12,
    gap: 4,
  },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 4,
  },
  cancelBtnText: { color: '#e74c3c', fontSize: 13, fontWeight: '600' },

  rejectionPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#fee',
    padding: 8,
    borderRadius: 6,
    gap: 6,
  },
  rejectionPreviewText: { color: '#e74c3c', fontSize: 12, flex: 1 },

  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { color: '#999', marginTop: 12, fontSize: 14 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  modalBody: { padding: 16 },

  statusBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 20,
  },
  statusTextLarge: { fontSize: 16, fontWeight: '700' },

  detailRow: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    marginBottom: 10,
    gap: 12,
  },
  detailTextContainer: { flex: 1 },
  detailLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  detailValue: { fontSize: 15, fontWeight: '600', color: '#333' },
  detailSubValue: { fontSize: 12, color: '#666', marginTop: 2 },

  certificateImage: { width: '100%', height: 200, borderRadius: 8, marginTop: 8 },
});

export default SickLeaveScreen;
