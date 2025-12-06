import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../components/common/theme';
import { useAsyncSQLiteContext } from '../../utils/asyncSQliteProvider';
import { getToken } from '../../utils/jwtStorage';
import Constants from 'expo-constants';

const BACKEND = Constants.expoConfig?.extra?.BACKEND_URL || 'http://192.168.254.105:5000';

const SickLeaveScreen = ({ navigation }) => {
  const db = useAsyncSQLiteContext();
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [hasAssignment, setHasAssignment] = useState(true);
  
  // Form state
  const [reason, setReason] = useState('');
  const [selectedStartDate, setSelectedStartDate] = useState(null);
  const [selectedEndDate, setSelectedEndDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

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
      }
    } catch (error) {
      console.error('Error fetching sick leave history:', error);
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
      const res = await fetch(`${BACKEND}/api/sick-leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          startDate: selectedStartDate,
          endDate: selectedEndDate,
          reason
        })
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Success', 'Sick leave request submitted.');
        setReason('');
        setSelectedStartDate(null);
        setSelectedEndDate(null);
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

  // Simple Calendar Component
  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay(); // 0 = Sunday

    const days = [];
    // Empty slots for previous month
    for (let i = 0; i < startingDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = new Date(year, month, i).toISOString().split('T')[0];
      const isSelectedStart = selectedStartDate === dateStr;
      const isSelectedEnd = selectedEndDate === dateStr;
      const isInRange = selectedStartDate && selectedEndDate && dateStr > selectedStartDate && dateStr < selectedEndDate;
      
      let bg = 'transparent';
      let txtColor = '#333';

      if (isSelectedStart || isSelectedEnd) {
        bg = colors.primary;
        txtColor = '#fff';
      } else if (isInRange) {
        bg = '#e6f0ff';
      }

      days.push(
        <TouchableOpacity
          key={i}
          style={[styles.dayCell, { backgroundColor: bg }]}
          onPress={() => handleDatePress(dateStr)}
        >
          <Text style={{ color: txtColor }}>{i}</Text>
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.calendarContainer}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity onPress={() => setCurrentMonth(new Date(year, month - 1, 1))}>
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</Text>
          <TouchableOpacity onPress={() => setCurrentMonth(new Date(year, month + 1, 1))}>
            <Ionicons name="chevron-forward" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        <View style={styles.weekDays}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <Text key={d} style={styles.weekDayText}>{d}</Text>
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Sick Leave Request</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!hasAssignment && (
            <View style={{ backgroundColor: '#ffebee', padding: 12, borderRadius: 8, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="alert-circle" size={24} color="#d32f2f" style={{ marginRight: 10 }} />
                <Text style={{ color: '#d32f2f', flex: 1, fontWeight: '500' }}>
                    You are not assigned to any tricycle/operator. You cannot file a sick leave.
                </Text>
            </View>
        )}

        <Text style={styles.sectionTitle}>Select Dates</Text>
        {renderCalendar()}
        
        <View style={styles.dateDisplay}>
            <Text>Start: {selectedStartDate || '-'}</Text>
            <Text>End: {selectedEndDate || '-'}</Text>
        </View>

        <Text style={styles.sectionTitle}>Reason</Text>
        <TextInput
          style={[styles.input, !hasAssignment && { backgroundColor: '#f0f0f0', color: '#999' }]}
          placeholder="Why are you taking sick leave?"
          multiline
          numberOfLines={3}
          value={reason}
          onChangeText={setReason}
          editable={hasAssignment}
        />

        <TouchableOpacity 
            style={[styles.submitBtn, (loading || !hasAssignment) && { opacity: 0.5 }]} 
            onPress={handleSubmit}
            disabled={loading || !hasAssignment}
        >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit Request</Text>}
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>History</Text>
        {history.length === 0 ? (
            <Text style={styles.emptyText}>No sick leave history</Text>
        ) : (
            history.map((item) => (
                <View key={item._id} style={styles.historyItem}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={styles.historyDate}>
                            {new Date(item.startDate).toLocaleDateString()} - {new Date(item.endDate).toLocaleDateString()}
                        </Text>
                        <Text style={[styles.status, 
                            item.status === 'approved' ? { color: 'green' } : 
                            item.status === 'rejected' ? { color: 'red' } : { color: 'orange' }
                        ]}>
                            {item.status.toUpperCase()}
                        </Text>
                    </View>
                    <Text style={styles.historyReason}>{item.reason}</Text>
                </View>
            ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.medium,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  title: { fontSize: 18, fontWeight: '700' },
  content: { padding: spacing.medium },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  
  calendarContainer: { backgroundColor: '#fff', borderRadius: 8, padding: 8, elevation: 2 },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  monthTitle: { fontSize: 16, fontWeight: '600' },
  weekDays: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 4 },
  weekDayText: { width: 40, textAlign: 'center', color: '#666', fontSize: 12 },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 20 },
  
  dateDisplay: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, padding: 8, backgroundColor: '#f0f0f0', borderRadius: 4 },
  
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    textAlignVertical: 'top'
  },
  submitBtn: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  
  historyItem: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary
  },
  historyDate: { fontWeight: '600' },
  historyReason: { color: '#666', marginTop: 4 },
  status: { fontSize: 12, fontWeight: '700' },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 16 }
});

export default SickLeaveScreen;
