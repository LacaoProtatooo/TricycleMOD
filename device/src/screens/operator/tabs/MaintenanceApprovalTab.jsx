import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../../components/common/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const MaintenanceApprovalTab = ({ token, BACKEND }) => {
  const insets = useSafeAreaInsets();
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [approving, setApproving] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const fetchPendingApprovals = useCallback(async () => {
    if (!token) return;
    
    try {
      const response = await fetch(`${BACKEND}/api/maintenance/operator/pending-approvals`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        setPendingApprovals(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, BACKEND]);

  useEffect(() => {
    fetchPendingApprovals();
  }, [fetchPendingApprovals]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPendingApprovals();
  };

  const handleApprove = async (record) => {
    setApproving(record._id);
    
    try {
      const response = await fetch(`${BACKEND}/api/maintenance/operator/approve/${record._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        Alert.alert('Success', 'Maintenance record approved');
        setPendingApprovals(prev => prev.filter(p => p._id !== record._id));
      } else {
        const error = await response.json();
        Alert.alert('Error', error.message || 'Failed to approve');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setApproving(null);
    }
  };

  const openRejectModal = (record) => {
    setSelectedRecord(record);
    setRejectReason('');
    setRejectModalVisible(true);
  };

  const handleReject = async () => {
    if (!selectedRecord) return;
    
    setRejecting(selectedRecord._id);
    
    try {
      const response = await fetch(`${BACKEND}/api/maintenance/operator/reject/${selectedRecord._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: rejectReason || 'No reason provided' })
      });
      
      if (response.ok) {
        Alert.alert('Rejected', 'Maintenance record has been rejected');
        setPendingApprovals(prev => prev.filter(p => p._id !== selectedRecord._id));
        setRejectModalVisible(false);
        setSelectedRecord(null);
      } else {
        const error = await response.json();
        Alert.alert('Error', error.message || 'Failed to reject');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setRejecting(null);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const openImageModal = (imageUrl) => {
    setSelectedImage(imageUrl);
    setImageModalVisible(true);
  };

  const renderApprovalCard = ({ item }) => {
    const isApproving = approving === item._id;
    const isRejecting = rejecting === item._id;
    const hasProofImage = item.proofImageUrl;
    
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.plateContainer}>
            <Ionicons name="car" size={18} color={colors.primary} />
            <Text style={styles.plateNumber}>{item.plateNumber}</Text>
          </View>
          <View style={styles.statusBadge}>
            <Ionicons name="time" size={12} color="#f59e0b" />
            <Text style={styles.statusText}>Pending</Text>
          </View>
        </View>
        
        <View style={styles.cardBody}>
          <Text style={styles.itemName}>{item.itemName}</Text>
          <Text style={styles.groupName}>{item.groupName}</Text>
          
          <View style={styles.detailsRow}>
            <View style={styles.detail}>
              <Ionicons name="speedometer-outline" size={14} color="#64748b" />
              <Text style={styles.detailText}>{item.lastServiceKm} km</Text>
            </View>
            <View style={styles.detail}>
              <Ionicons name="checkmark-circle-outline" size={14} color="#64748b" />
              <Text style={styles.detailText}>{item.status}</Text>
            </View>
          </View>
          
          {item.notes && (
            <View style={styles.notesContainer}>
              <Ionicons name="document-text-outline" size={14} color="#64748b" />
              <Text style={styles.notesText} numberOfLines={2}>{item.notes}</Text>
            </View>
          )}
          
          {item.cost && (
            <View style={styles.costContainer}>
              <Ionicons name="cash-outline" size={14} color="#22c55e" />
              <Text style={styles.costText}>₱{item.cost.toFixed(2)}</Text>
            </View>
          )}

          {/* Proof Image Section */}
          {hasProofImage ? (
            <TouchableOpacity 
              style={styles.proofImageSection}
              onPress={() => openImageModal(`${BACKEND}${item.proofImageUrl}`)}
            >
              <Image 
                source={{ uri: `${BACKEND}${item.proofImageUrl}` }} 
                style={styles.proofThumbnail}
              />
              <View style={styles.proofBadge}>
                <Ionicons name="camera" size={12} color="#fff" />
                <Text style={styles.proofBadgeText}>Proof Photo</Text>
              </View>
              <View style={styles.proofOverlay}>
                <Ionicons name="expand" size={20} color="#fff" />
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.noProofContainer}>
              <Ionicons name="image-outline" size={16} color="#f59e0b" />
              <Text style={styles.noProofText}>No proof photo provided</Text>
            </View>
          )}
          
          <View style={styles.metaRow}>
            <View style={styles.submittedBy}>
              <Ionicons name="person-outline" size={12} color="#94a3b8" />
              <Text style={styles.metaText}>
                {item.completedBy?.firstName} {item.completedBy?.lastName}
              </Text>
            </View>
            <Text style={styles.dateText}>{formatDate(item.completedAt)}</Text>
          </View>
        </View>
        
        <View style={styles.cardActions}>
          <TouchableOpacity 
            style={[styles.actionBtn, styles.rejectBtn]}
            onPress={() => openRejectModal(item)}
            disabled={isApproving || isRejecting}
          >
            {isRejecting ? (
              <ActivityIndicator size="small" color="#ef4444" />
            ) : (
              <>
                <Ionicons name="close-circle" size={18} color="#ef4444" />
                <Text style={styles.rejectText}>Reject</Text>
              </>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionBtn, styles.approveBtn]}
            onPress={() => handleApprove(item)}
            disabled={isApproving || isRejecting}
          >
            {isApproving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={styles.approveText}>Approve</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="checkmark-done-circle" size={64} color="#22c55e" />
      <Text style={styles.emptyTitle}>All Caught Up!</Text>
      <Text style={styles.emptyText}>No pending maintenance approvals</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading pending approvals...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Maintenance Approvals</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{pendingApprovals.length}</Text>
        </View>
      </View>
      
      <FlatList
        data={pendingApprovals}
        renderItem={renderApprovalCard}
        keyExtractor={(item) => item._id}
        contentContainerStyle={[
          styles.listContent,
          pendingApprovals.length === 0 && styles.emptyList
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />
      
      {/* Reject Modal */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reject Maintenance Record</Text>
            <Text style={styles.modalSubtitle}>
              {selectedRecord?.itemName} - {selectedRecord?.plateNumber}
            </Text>
            
            <TextInput
              style={styles.reasonInput}
              placeholder="Reason for rejection (optional)"
              placeholderTextColor="#94a3b8"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalCancelBtn}
                onPress={() => setRejectModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalRejectBtn}
                onPress={handleReject}
                disabled={rejecting}
              >
                {rejecting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalRejectText}>Reject</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Viewer Modal */}
      <Modal
        visible={imageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity 
            style={styles.imageModalClose}
            onPress={() => setImageModalVisible(false)}
          >
            <Ionicons name="close-circle" size={36} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.imageModalHeader}>
            <Ionicons name="camera" size={20} color="#fff" />
            <Text style={styles.imageModalTitle}>Proof Photo</Text>
          </View>
          
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
          
          <Text style={styles.imageModalHint}>Tap X to close</Text>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.medium,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
  },
  countBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  listContent: {
    padding: spacing.medium,
    paddingBottom: 100,
  },
  emptyList: {
    flex: 1,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: spacing.medium,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.medium,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  plateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  plateNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f59e0b',
  },
  cardBody: {
    padding: spacing.medium,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  groupName: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 13,
    color: '#475569',
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  notesText: {
    flex: 1,
    fontSize: 12,
    color: '#64748b',
  },
  costContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  costText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  submittedBy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  dateText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  rejectBtn: {
    backgroundColor: '#fef2f2',
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
  },
  approveBtn: {
    backgroundColor: '#22c55e',
  },
  rejectText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  approveText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.medium,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: spacing.large,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
  },
  reasonInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#1e293b',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  modalRejectBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    alignItems: 'center',
  },
  modalRejectText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  // Proof Image styles
  proofImageSection: {
    position: 'relative',
    marginTop: 12,
    marginBottom: 12,
    borderRadius: 10,
    overflow: 'hidden',
  },
  proofThumbnail: {
    width: '100%',
    height: 150,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  proofBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  proofBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  proofOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 6,
    borderRadius: 20,
  },
  noProofContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fef3c7',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 12,
  },
  noProofText: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '500',
  },
  // Image Modal styles
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  imageModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  imageModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  fullImage: {
    width: screenWidth - 40,
    height: screenHeight * 0.6,
    borderRadius: 12,
  },
  imageModalHint: {
    marginTop: 16,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
});

export default MaintenanceApprovalTab;
