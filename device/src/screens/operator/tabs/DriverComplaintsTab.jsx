import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Modal,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useSelector } from 'react-redux';

const DriverComplaintsTab = ({ token, BACKEND }) => {
  const { user } = useSelector((state) => state.auth);
  const [complaints, setComplaints] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, resolved: 0, dismissed: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [responseModalVisible, setResponseModalVisible] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');

  const categoryLabels = {
    rude_behavior: 'Rude Behavior',
    overcharging: 'Overcharging',
    unsafe_driving: 'Unsafe Driving',
    route_deviation: 'Route Deviation',
    vehicle_condition: 'Vehicle Condition',
    refusal_of_service: 'Refusal of Service',
    harassment: 'Harassment',
    discrimination: 'Discrimination',
    intoxicated_driving: 'Intoxicated Driving',
    other: 'Other',
  };

  const statusColors = {
    pending: '#F59E0B',
    under_review: '#3B82F6',
    investigating: '#8B5CF6',
    resolved: '#10B981',
    dismissed: '#6B7280',
    withdrawn: '#9CA3AF',
  };

  const statusLabels = {
    pending: 'Pending',
    under_review: 'Under Review',
    investigating: 'Investigating',
    resolved: 'Resolved',
    dismissed: 'Dismissed',
    withdrawn: 'Withdrawn',
  };

  const fetchComplaints = useCallback(async () => {
    try {
      const params = {};
      if (selectedFilter !== 'all') {
        params.status = selectedFilter;
      }
      
      const response = await axios.get(`${BACKEND}/api/complaints/operator/my-drivers`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      
      if (response.data.success) {
        setComplaints(response.data.complaints);
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error fetching complaints:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, selectedFilter]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchComplaints();
  }, [fetchComplaints]);

  const fetchComplaintDetails = async (complaintId) => {
    try {
      const response = await axios.get(`${BACKEND}/api/complaints/operator/${complaintId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.data.success) {
        setSelectedComplaint(response.data.complaint);
        setDetailModalVisible(true);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load complaint details');
    }
  };

  const submitResponse = async () => {
    if (!responseText || responseText.length < 20) {
      Alert.alert('Error', 'Please provide a detailed response (at least 20 characters)');
      return;
    }

    setSubmitting(true);
    try {
      const response = await axios.post(
        `${BACKEND}/api/complaints/operator/${selectedComplaint._id}/response`,
        { response: responseText },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        Alert.alert('Success', 'Your response has been submitted');
        setResponseModalVisible(false);
        setResponseText('');
        fetchComplaintDetails(selectedComplaint._id);
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSeverityColor = (category) => {
    const critical = ['harassment', 'intoxicated_driving', 'discrimination'];
    const high = ['unsafe_driving'];
    if (critical.includes(category)) return '#EF4444';
    if (high.includes(category)) return '#F59E0B';
    return '#6B7280';
  };

  const renderStatsCard = () => (
    <View style={styles.statsContainer}>
      <View style={[styles.statCard, { backgroundColor: '#FEF3C7' }]}>
        <Text style={[styles.statNumber, { color: '#D97706' }]}>{stats.pending}</Text>
        <Text style={styles.statLabel}>Pending</Text>
      </View>
      <View style={[styles.statCard, { backgroundColor: '#D1FAE5' }]}>
        <Text style={[styles.statNumber, { color: '#059669' }]}>{stats.resolved}</Text>
        <Text style={styles.statLabel}>Resolved</Text>
      </View>
      <View style={[styles.statCard, { backgroundColor: '#F3F4F6' }]}>
        <Text style={[styles.statNumber, { color: '#6B7280' }]}>{stats.dismissed}</Text>
        <Text style={styles.statLabel}>Dismissed</Text>
      </View>
      <View style={[styles.statCard, { backgroundColor: '#FEE2E2' }]}>
        <Text style={[styles.statNumber, { color: '#DC2626' }]}>{stats.total}</Text>
        <Text style={styles.statLabel}>Total</Text>
      </View>
    </View>
  );

  const renderFilterTabs = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
      {['all', 'pending', 'under_review', 'investigating', 'resolved', 'dismissed'].map((filter) => (
        <TouchableOpacity
          key={filter}
          style={[
            styles.filterTab,
            selectedFilter === filter && styles.filterTabActive,
          ]}
          onPress={() => setSelectedFilter(filter)}
        >
          <Text
            style={[
              styles.filterTabText,
              selectedFilter === filter && styles.filterTabTextActive,
            ]}
          >
            {filter === 'all' ? 'All' : statusLabels[filter]}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderComplaintItem = ({ item }) => (
    <TouchableOpacity
      style={styles.complaintCard}
      onPress={() => fetchComplaintDetails(item._id)}
    >
      <View style={styles.complaintHeader}>
        <View style={styles.driverInfo}>
          <View style={styles.driverAvatar}>
            {item.driver?.image?.url ? (
              <Image source={{ uri: item.driver.image.url }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {item.driver?.firstname?.[0]}{item.driver?.lastname?.[0]}
              </Text>
            )}
          </View>
          <View>
            <Text style={styles.driverName}>
              {item.driver?.firstname} {item.driver?.lastname}
            </Text>
            <Text style={styles.complaintDate}>{formatDate(item.createdAt)}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] + '20' }]}>
          <Text style={[styles.statusText, { color: statusColors[item.status] }]}>
            {statusLabels[item.status]}
          </Text>
        </View>
      </View>

      <View style={styles.categoryRow}>
        <View style={[styles.severityDot, { backgroundColor: getSeverityColor(item.category) }]} />
        <Text style={styles.categoryText}>{categoryLabels[item.category]}</Text>
      </View>

      <Text style={styles.descriptionPreview} numberOfLines={2}>
        {item.description}
      </Text>

      <View style={styles.complaintFooter}>
        <View style={styles.complainantInfo}>
          <Ionicons name="person-outline" size={14} color="#6B7280" />
          <Text style={styles.complainantName}>
            {item.complainant?.firstname} {item.complainant?.lastname}
          </Text>
        </View>
        <View style={styles.evidenceCount}>
          <Ionicons name="images-outline" size={14} color="#6B7280" />
          <Text style={styles.evidenceText}>{item.evidence?.length || 0}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderDetailModal = () => (
    <Modal
      visible={detailModalVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setDetailModalVisible(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Complaint Details</Text>
          <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        {selectedComplaint && (
          <ScrollView style={styles.modalContent}>
            {/* Status Badge */}
            <View style={[styles.detailStatusBadge, { backgroundColor: statusColors[selectedComplaint.status] }]}>
              <Text style={styles.detailStatusText}>{statusLabels[selectedComplaint.status]}</Text>
            </View>

            {/* Driver Info */}
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Driver</Text>
              <View style={styles.personCard}>
                <View style={styles.personAvatar}>
                  {selectedComplaint.driver?.image?.url ? (
                    <Image source={{ uri: selectedComplaint.driver.image.url }} style={styles.personImage} />
                  ) : (
                    <Ionicons name="person" size={24} color="#9CA3AF" />
                  )}
                </View>
                <View>
                  <Text style={styles.personName}>
                    {selectedComplaint.driver?.firstname} {selectedComplaint.driver?.lastname}
                  </Text>
                  <Text style={styles.personDetail}>@{selectedComplaint.driver?.username}</Text>
                </View>
              </View>
            </View>

            {/* Complainant Info */}
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Complainant</Text>
              <View style={styles.personCard}>
                <View style={styles.personAvatar}>
                  {selectedComplaint.complainant?.image?.url ? (
                    <Image source={{ uri: selectedComplaint.complainant.image.url }} style={styles.personImage} />
                  ) : (
                    <Ionicons name="person" size={24} color="#9CA3AF" />
                  )}
                </View>
                <View>
                  <Text style={styles.personName}>
                    {selectedComplaint.complainant?.firstname} {selectedComplaint.complainant?.lastname}
                  </Text>
                  <Text style={styles.personDetail}>{selectedComplaint.complainant?.email}</Text>
                </View>
              </View>
            </View>

            {/* Complaint Details */}
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Complaint</Text>
              <View style={styles.detailCard}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Category:</Text>
                  <Text style={[styles.detailValue, { color: getSeverityColor(selectedComplaint.category) }]}>
                    {categoryLabels[selectedComplaint.category]}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Incident Date:</Text>
                  <Text style={styles.detailValue}>{formatDate(selectedComplaint.incidentDate)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Filed:</Text>
                  <Text style={styles.detailValue}>{formatDate(selectedComplaint.createdAt)}</Text>
                </View>
              </View>
              <View style={styles.descriptionBox}>
                <Text style={styles.descriptionTitle}>Description</Text>
                <Text style={styles.fullDescription}>{selectedComplaint.description}</Text>
              </View>
            </View>

            {/* Evidence */}
            {selectedComplaint.evidence?.length > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Evidence ({selectedComplaint.evidence.length})</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {selectedComplaint.evidence.map((item, index) => (
                    <Image
                      key={index}
                      source={{ uri: item.url }}
                      style={styles.evidenceImage}
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Admin Notes */}
            {selectedComplaint.adminNotes?.length > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Notes & Updates</Text>
                {selectedComplaint.adminNotes.map((note, index) => (
                  <View key={index} style={styles.noteCard}>
                    <Text style={styles.noteText}>{note.note}</Text>
                    <Text style={styles.noteDate}>{formatDate(note.addedAt)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Response Button */}
            {!['resolved', 'dismissed', 'withdrawn'].includes(selectedComplaint.status) && (
              <TouchableOpacity
                style={styles.responseButton}
                onPress={() => setResponseModalVisible(true)}
              >
                <Ionicons name="chatbubble-outline" size={20} color="#fff" />
                <Text style={styles.responseButtonText}>Add Response</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );

  const renderResponseModal = () => (
    <Modal
      visible={responseModalVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setResponseModalVisible(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Add Response</Text>
          <TouchableOpacity onPress={() => setResponseModalVisible(false)}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        <View style={styles.responseContent}>
          <Text style={styles.responseLabel}>
            Provide your response or statement regarding this complaint:
          </Text>
          <TextInput
            style={styles.responseInput}
            multiline
            numberOfLines={6}
            placeholder="Enter your response here... (minimum 20 characters)"
            value={responseText}
            onChangeText={setResponseText}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{responseText.length} characters</Text>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color="#F59E0B" />
            <Text style={styles.infoText}>
              Your response will be visible to admins reviewing this complaint.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={submitResponse}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>Submit Response</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F97316" />
        <Text style={styles.loadingText}>Loading complaints...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderStatsCard()}
      {renderFilterTabs()}

      {complaints.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-circle-outline" size={64} color="#10B981" />
          <Text style={styles.emptyTitle}>No Complaints</Text>
          <Text style={styles.emptyText}>
            {selectedFilter === 'all'
              ? 'Great news! None of your drivers have any complaints.'
              : `No ${statusLabels[selectedFilter]?.toLowerCase()} complaints found.`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={complaints}
          renderItem={renderComplaintItem}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#F97316']} />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {renderDetailModal()}
      {renderResponseModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  filterContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterTabActive: {
    backgroundColor: '#F97316',
    borderColor: '#F97316',
  },
  filterTabText: {
    fontSize: 13,
    color: '#6B7280',
  },
  filterTabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  complaintCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  complaintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  driverName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  complaintDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  descriptionPreview: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 12,
  },
  complaintFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  complainantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  complainantName: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 6,
  },
  evidenceCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  evidenceText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  detailStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 20,
  },
  detailStatusText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  detailSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  personCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
  },
  personAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  personImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  personName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  personDetail: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  detailCard: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1F2937',
  },
  descriptionBox: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 12,
  },
  descriptionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 8,
  },
  fullDescription: {
    fontSize: 14,
    color: '#78350F',
    lineHeight: 20,
  },
  evidenceImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
    marginRight: 12,
  },
  noteCard: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  noteText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  noteDate: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 6,
  },
  responseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F97316',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 32,
  },
  responseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  responseContent: {
    padding: 16,
  },
  responseLabel: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 12,
  },
  responseInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    minHeight: 150,
    backgroundColor: '#F9FAFB',
  },
  charCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    marginLeft: 8,
    lineHeight: 18,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F97316',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default DriverComplaintsTab;
