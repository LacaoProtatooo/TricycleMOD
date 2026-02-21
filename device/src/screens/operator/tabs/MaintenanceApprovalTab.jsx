import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../../components/common/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const TILE_GAP = 12;
const TILE_WIDTH = (screenWidth - spacing.medium * 2 - TILE_GAP) / 2;

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

  // Tile detail modal
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedTricycle, setSelectedTricycle] = useState(null); // plate number key

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

  // Group approvals by tricycle plate number
  const groupedByTricycle = useMemo(() => {
    const groups = {};
    pendingApprovals.forEach(item => {
      const plate = item.plateNumber || 'Unknown';
      if (!groups[plate]) {
        groups[plate] = {
          plateNumber: plate,
          driverName: item.completedBy
            ? `${item.completedBy.firstName || ''} ${item.completedBy.lastName || ''}`.trim()
            : 'Unknown Driver',
          records: [],
        };
      }
      groups[plate].records.push(item);
    });
    // Sort records within each group by date descending
    Object.values(groups).forEach(g => {
      g.records.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
    });
    return Object.values(groups);
  }, [pendingApprovals]);

  // Records for the currently selected tricycle
  const selectedRecords = useMemo(() => {
    if (!selectedTricycle) return [];
    const group = groupedByTricycle.find(g => g.plateNumber === selectedTricycle);
    return group ? group.records : [];
  }, [selectedTricycle, groupedByTricycle]);

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

  const openTricycleDetail = (plateNumber) => {
    setSelectedTricycle(plateNumber);
    setDetailModalVisible(true);
  };

  // Track previous pendingApprovals length to detect actual changes (approve/reject)
  const prevApprovalCountRef = React.useRef(pendingApprovals.length);

  // Close detail modal only after an approval/rejection causes all records for that tricycle to be removed
  useEffect(() => {
    if (detailModalVisible && selectedTricycle) {
      // Only check for auto-close if pendingApprovals count actually decreased (an approve/reject happened)
      if (pendingApprovals.length < prevApprovalCountRef.current) {
        const remaining = pendingApprovals.filter(p => p.plateNumber === selectedTricycle);
        if (remaining.length === 0) {
          setDetailModalVisible(false);
          setSelectedTricycle(null);
        }
      }
    }
    prevApprovalCountRef.current = pendingApprovals.length;
  }, [pendingApprovals, detailModalVisible, selectedTricycle]);

  // ── Tile for each tricycle ──
  const renderTile = ({ item }) => {
    const count = item.records.length;
    const latestDate = item.records[0]?.completedAt;
    // Collect unique group names for a preview
    const uniqueGroups = [...new Set(item.records.map(r => r.groupName).filter(Boolean))];

    return (
      <TouchableOpacity
        style={styles.tile}
        activeOpacity={0.7}
        onPress={() => openTricycleDetail(item.plateNumber)}
      >
        {/* Count badge */}
        <View style={styles.tileBadge}>
          <Text style={styles.tileBadgeText}>{count}</Text>
        </View>

        {/* Icon */}
        <View style={styles.tileIconWrap}>
          <Ionicons name="bicycle" size={28} color={colors.primary} />
        </View>

        {/* Plate */}
        <Text style={styles.tilePlate} numberOfLines={1}>{item.plateNumber}</Text>

        {/* Driver */}
        <Text style={styles.tileDriver} numberOfLines={1}>{item.driverName}</Text>

        {/* Group names preview */}
        <View style={styles.tileChips}>
          {uniqueGroups.slice(0, 2).map((g, i) => (
            <View key={i} style={styles.tileChip}>
              <Text style={styles.tileChipText} numberOfLines={1}>{g}</Text>
            </View>
          ))}
          {uniqueGroups.length > 2 && (
            <Text style={styles.tileMore}>+{uniqueGroups.length - 2}</Text>
          )}
        </View>

        {/* Date */}
        {latestDate && (
          <Text style={styles.tileDate}>{formatDate(latestDate)}</Text>
        )}
      </TouchableOpacity>
    );
  };

  // ── Record card inside the detail modal ──
  const renderDetailRecord = (item) => {
    const isApproving = approving === item._id;
    const isRejecting = rejecting === item._id;
    const hasProofImage = item.proofImageUrl;

    return (
      <View key={item._id} style={styles.detailCard}>
        {/* Item header */}
        <View style={styles.detailCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.detailItemName}>{item.itemName}</Text>
            <Text style={styles.detailGroupName}>{item.groupName}</Text>
          </View>
          <View style={styles.statusBadge}>
            <Ionicons name="time" size={12} color="#f59e0b" />
            <Text style={styles.statusText}>Pending</Text>
          </View>
        </View>

        {/* Details */}
        <View style={styles.detailBody}>
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

          {item.notes ? (
            <View style={styles.notesContainer}>
              <Ionicons name="document-text-outline" size={14} color="#64748b" />
              <Text style={styles.notesText} numberOfLines={3}>{item.notes}</Text>
            </View>
          ) : null}

          {item.cost ? (
            <View style={styles.costContainer}>
              <Ionicons name="cash-outline" size={14} color="#22c55e" />
              <Text style={styles.costText}>₱{item.cost.toFixed(2)}</Text>
            </View>
          ) : null}

          {/* Proof Image */}
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
              <Text style={styles.noProofText}>No proof photo</Text>
            </View>
          )}

          {/* Meta */}
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

        {/* Actions */}
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

  // ── Empty state ──
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
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Maintenance Approvals</Text>
          <Text style={styles.headerSubtitle}>
            {groupedByTricycle.length} tricycle{groupedByTricycle.length !== 1 ? 's' : ''} · {pendingApprovals.length} pending
          </Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{pendingApprovals.length}</Text>
        </View>
      </View>

      {/* Tile Grid */}
      <FlatList
        data={groupedByTricycle}
        renderItem={renderTile}
        keyExtractor={(item) => item.plateNumber}
        numColumns={2}
        columnWrapperStyle={styles.tileRow}
        contentContainerStyle={[
          styles.tileGrid,
          groupedByTricycle.length === 0 && styles.emptyList,
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

      {/* ── Tricycle Detail Modal ── */}
      <Modal
        visible={detailModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { setDetailModalVisible(false); setSelectedTricycle(null); }}
      >
        <View style={styles.detailModalOverlay}>
          <View style={styles.detailModalContent}>
            {/* Modal handle */}
            <View style={styles.modalHandle} />

            {/* Modal header */}
            <View style={styles.detailModalHeader}>
              <View style={styles.detailModalPlateRow}>
                <Ionicons name="bicycle" size={22} color={colors.primary} />
                <Text style={styles.detailModalPlate}>{selectedTricycle}</Text>
              </View>
              <TouchableOpacity
                onPress={() => { setDetailModalVisible(false); setSelectedTricycle(null); }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={28} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.detailModalCount}>
              {selectedRecords.length} pending maintenance record{selectedRecords.length !== 1 ? 's' : ''}
            </Text>

            {/* Scrollable record list */}
            <ScrollView
              style={styles.detailModalScroll}
              contentContainerStyle={{ paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
            >
              {selectedRecords.length > 0 ? (
                selectedRecords.map(renderDetailRecord)
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Ionicons name="document-text-outline" size={48} color="#cbd5e1" />
                  <Text style={{ fontSize: 14, color: '#94a3b8', marginTop: 12 }}>No pending records found</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Reject Modal ── */}
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

      {/* ── Image Viewer Modal ── */}
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

// ─────────────── Styles ───────────────
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
  headerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
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

  // ── Tile Grid ──
  tileGrid: {
    padding: spacing.medium,
    paddingBottom: 100,
  },
  tileRow: {
    justifyContent: 'space-between',
    marginBottom: TILE_GAP,
  },
  tile: {
    width: TILE_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
  },
  tileBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ef4444',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  tileIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tilePlate: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 2,
    textAlign: 'center',
  },
  tileDriver: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 8,
    textAlign: 'center',
  },
  tileChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 6,
  },
  tileChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tileChipText: {
    fontSize: 9,
    color: '#475569',
    fontWeight: '500',
    maxWidth: 70,
  },
  tileMore: {
    fontSize: 9,
    color: '#94a3b8',
    alignSelf: 'center',
  },
  tileDate: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },

  // ── Detail Modal ──
  detailModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  detailModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: spacing.medium,
    paddingTop: 10,
    height: screenHeight * 0.8,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginBottom: 10,
  },
  detailModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detailModalPlateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailModalPlate: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
  },
  detailModalCount: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 14,
  },
  detailModalScroll: {
    flex: 1,
  },

  // ── Detail Record Card ──
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  detailCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  detailItemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  detailGroupName: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  detailBody: {
    padding: 12,
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

  // ── Empty / Loading ──
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyList: {
    flex: 1,
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

  // ── Reject Modal ──
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

  // ── Proof Image ──
  proofImageSection: {
    position: 'relative',
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 10,
    overflow: 'hidden',
  },
  proofThumbnail: {
    width: '100%',
    height: 140,
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
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  noProofText: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '500',
  },

  // ── Image Viewer Modal ──
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
