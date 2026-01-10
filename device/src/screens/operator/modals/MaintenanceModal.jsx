import React, { useState, useMemo, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Share,
  Alert,
  TextInput,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../../components/common/theme';
import styles from '../operatorStyles';

// Part definitions for display
const PART_INFO = {
  tire_pressure: { name: 'Tire Pressure', category: 'Safety' },
  chain: { name: 'Chain', category: 'Drivetrain' },
  battery_water: { name: 'Battery Water', category: 'Electrical' },
  air_filter_clean: { name: 'Air Filter (Clean)', category: 'Engine' },
  brake_check: { name: 'Brake System', category: 'Safety' },
  cables: { name: 'Control Cables', category: 'Controls' },
  engine_oil: { name: 'Engine Oil', category: 'Engine' },
  spark_plug: { name: 'Spark Plug', category: 'Ignition' },
  carburetor: { name: 'Carburetor', category: 'Fuel System' },
  chain_sprockets: { name: 'Chain & Sprockets', category: 'Drivetrain' },
  oil_filter: { name: 'Oil Filter', category: 'Engine' },
  air_filter_replace: { name: 'Air Filter (Replace)', category: 'Engine' },
  valve_clearance: { name: 'Valve Clearance', category: 'Engine' },
  battery_test: { name: 'Battery Test', category: 'Electrical' },
  brake_fluid_flush: { name: 'Brake Fluid', category: 'Safety' },
  clutch_plates: { name: 'Clutch Plates', category: 'Drivetrain' },
  suspension: { name: 'Suspension', category: 'Chassis' },
  engine_overhaul: { name: 'Engine Overhaul', category: 'Engine' },
  transmission_oil: { name: 'Transmission Oil', category: 'Drivetrain' },
  wiring_harness: { name: 'Wiring Harness', category: 'Electrical' },
};

// Category colors
const CATEGORY_COLORS = {
  Safety: '#ef4444',
  Engine: '#f97316',
  Drivetrain: '#eab308',
  Electrical: '#22c55e',
  'Fuel System': '#14b8a6',
  Ignition: '#3b82f6',
  Controls: '#8b5cf6',
  Chassis: '#ec4899',
};

// Format date
const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function MaintenanceModal({
  visible,
  onClose,
  selectedTricycle,
  history
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [exporting, setExporting] = useState(false);

  const plateNumber = selectedTricycle?.plate || selectedTricycle?.plateNumber || 'Unknown';

  // Filter and sort history
  const filteredHistory = useMemo(() => {
    let result = [...(history || [])];

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(record => {
        const partInfo = PART_INFO[record.itemKey];
        const partName = partInfo?.name?.toLowerCase() || record.itemKey?.toLowerCase() || '';
        const category = partInfo?.category?.toLowerCase() || '';
        const notes = record.notes?.toLowerCase() || '';
        return partName.includes(query) || category.includes(query) || notes.includes(query);
      });
    }

    // Apply sort
    result.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.completedAt) - new Date(a.completedAt);
      if (sortBy === 'oldest') return new Date(a.completedAt) - new Date(b.completedAt);
      return 0;
    });

    return result;
  }, [history, searchQuery, sortBy]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = history?.length || 0;
    let lastDate = null;
    history?.forEach(h => {
      if (!lastDate || new Date(h.completedAt) > new Date(lastDate)) {
        lastDate = h.completedAt;
      }
    });
    return { total, lastDate };
  }, [history]);

  // Generate CSV
  const generateCSV = useCallback(() => {
    const headers = ['Date', 'Part', 'Category', 'Service KM', 'Notes'];
    const rows = filteredHistory.map(record => {
      const partInfo = PART_INFO[record.itemKey] || { name: record.itemKey, category: 'Other' };
      return [
        formatDateTime(record.completedAt),
        partInfo.name,
        partInfo.category,
        record.lastServiceKm || 0,
        `"${(record.notes || '').replace(/"/g, '""')}"`,
      ].join(',');
    });
    return [headers.join(','), ...rows].join('\n');
  }, [filteredHistory]);

  // Generate text report
  const generateTextReport = useCallback(() => {
    const lines = [
      '═══════════════════════════════════════════',
      '    MAINTENANCE SERVICE HISTORY REPORT',
      '═══════════════════════════════════════════',
      '',
      `Vehicle: ${plateNumber}`,
      `Odometer: ${Math.round(selectedTricycle?.currentOdometer || 0).toLocaleString()} km`,
      `Generated: ${formatDateTime(new Date().toISOString())}`,
      `Total Records: ${filteredHistory.length}`,
      '',
      '───────────────────────────────────────────',
      '            SERVICE RECORDS',
      '───────────────────────────────────────────',
      '',
    ];

    filteredHistory.forEach((record, idx) => {
      const partInfo = PART_INFO[record.itemKey] || { name: record.itemKey, category: 'Other' };
      lines.push(`${idx + 1}. ${partInfo.name}`);
      lines.push(`   Category: ${partInfo.category}`);
      lines.push(`   Date: ${formatDateTime(record.completedAt)}`);
      lines.push(`   Service KM: ${(record.lastServiceKm || 0).toLocaleString()} km`);
      if (record.notes) {
        lines.push(`   Notes: ${record.notes}`);
      }
      lines.push('');
    });

    lines.push('═══════════════════════════════════════════');
    lines.push('           END OF REPORT');
    lines.push('═══════════════════════════════════════════');

    return lines.join('\n');
  }, [filteredHistory, plateNumber, selectedTricycle]);

  // Export handlers
  const handleExportReport = async () => {
    try {
      setExporting(true);
      const report = generateTextReport();
      await Share.share({
        message: report,
        title: `Maintenance Report - ${plateNumber}`,
      });
    } catch (error) {
      if (error.message !== 'User did not share') {
        Alert.alert('Export Failed', 'Could not export the report.');
      }
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const csv = generateCSV();
      await Share.share({
        message: csv,
        title: `Maintenance CSV - ${plateNumber}`,
      });
    } catch (error) {
      if (error.message !== 'User did not share') {
        Alert.alert('Export Failed', 'Could not export the CSV.');
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalContainer}>
        <View style={[styles.modalContent, { maxHeight: '90%', flex: 0 }]}>
          {/* Header */}
          <View style={modalStyles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Maintenance History</Text>
              <Text style={styles.modalSub}>
                {plateNumber} • {Math.round(selectedTricycle?.currentOdometer || 0).toLocaleString()} km
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.orangeShade5} />
            </TouchableOpacity>
          </View>

          {/* Stats Row */}
          <View style={modalStyles.statsRow}>
            <View style={modalStyles.statItem}>
              <Text style={modalStyles.statValue}>{stats.total}</Text>
              <Text style={modalStyles.statLabel}>Total Services</Text>
            </View>
            <View style={modalStyles.statItem}>
              <Text style={modalStyles.statValue}>
                {stats.lastDate ? formatDate(stats.lastDate).split(',')[0] : 'N/A'}
              </Text>
              <Text style={modalStyles.statLabel}>Last Service</Text>
            </View>
          </View>

          {/* Export Buttons */}
          <View style={modalStyles.exportRow}>
            <TouchableOpacity
              style={modalStyles.exportBtn}
              onPress={handleExportReport}
              disabled={exporting || filteredHistory.length === 0}
            >
              {exporting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="document-text-outline" size={16} color="#fff" />
                  <Text style={modalStyles.exportBtnText}>Export Report</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[modalStyles.exportBtn, modalStyles.exportBtnSecondary]}
              onPress={handleExportCSV}
              disabled={exporting || filteredHistory.length === 0}
            >
              <Ionicons name="grid-outline" size={16} color={colors.primary} />
              <Text style={[modalStyles.exportBtnText, { color: colors.primary }]}>Export CSV</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={modalStyles.searchContainer}>
            <Ionicons name="search" size={18} color="#999" />
            <TextInput
              style={modalStyles.searchInput}
              placeholder="Search parts..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#999" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Sort Toggle */}
          <View style={modalStyles.sortRow}>
            <Text style={modalStyles.resultsText}>
              {filteredHistory.length} record{filteredHistory.length !== 1 ? 's' : ''}
            </Text>
            <TouchableOpacity
              style={modalStyles.sortBtn}
              onPress={() => setSortBy(sortBy === 'newest' ? 'oldest' : 'newest')}
            >
              <Ionicons 
                name={sortBy === 'newest' ? 'arrow-down' : 'arrow-up'} 
                size={14} 
                color={colors.primary} 
              />
              <Text style={modalStyles.sortBtnText}>
                {sortBy === 'newest' ? 'Newest First' : 'Oldest First'}
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Records List */}
          <ScrollView 
            style={modalStyles.recordsList}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            {filteredHistory.length === 0 ? (
              <View style={modalStyles.emptyState}>
                <Ionicons name="folder-open-outline" size={48} color="#ccc" />
                <Text style={modalStyles.emptyTitle}>No Records Found</Text>
                <Text style={modalStyles.emptyText}>
                  {searchQuery ? 'Try a different search term' : 'No maintenance history recorded yet'}
                </Text>
              </View>
            ) : (
              filteredHistory.map((log, index) => {
                const partInfo = PART_INFO[log.itemKey] || { name: log.itemKey, category: 'Other' };
                const categoryColor = CATEGORY_COLORS[partInfo.category] || '#64748b';
                
                return (
                  <View key={index} style={modalStyles.logItem}>
                    <View style={[modalStyles.categoryIndicator, { backgroundColor: categoryColor }]} />
                    <View style={{ flex: 1 }}>
                      <View style={modalStyles.logHeader}>
                        <Text style={modalStyles.logPartName}>{partInfo.name}</Text>
                        <View style={[modalStyles.categoryBadge, { backgroundColor: categoryColor + '20' }]}>
                          <Text style={[modalStyles.categoryText, { color: categoryColor }]}>
                            {partInfo.category}
                          </Text>
                        </View>
                      </View>
                      
                      <View style={modalStyles.logDetails}>
                        <View style={modalStyles.logDetail}>
                          <Ionicons name="calendar-outline" size={12} color="#999" />
                          <Text style={modalStyles.logDetailText}>
                            {formatDate(log.completedAt)}
                          </Text>
                        </View>
                        <View style={modalStyles.logDetail}>
                          <Ionicons name="speedometer-outline" size={12} color="#999" />
                          <Text style={modalStyles.logDetailText}>
                            {(log.lastServiceKm || 0).toLocaleString()} km
                          </Text>
                        </View>
                      </View>
                      
                      {log.notes ? (
                        <Text style={modalStyles.logNotes}>"{log.notes}"</Text>
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}
            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Close Button */}
          <TouchableOpacity 
            style={[styles.modalBtn, { backgroundColor: '#6c757d', marginTop: 12 }]} 
            onPress={onClose}
          >
            <Text style={styles.modalBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = {
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  closeBtn: {
    padding: 4,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.orangeShade7,
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  exportRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  exportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  exportBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  exportBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: colors.orangeShade7,
    fontSize: 14,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  resultsText: {
    fontSize: 12,
    color: '#999',
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortBtnText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  recordsList: {
    maxHeight: 300,
    minHeight: 150,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginTop: 12,
  },
  emptyText: {
    fontSize: 13,
    color: '#bbb',
    marginTop: 4,
  },
  logItem: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fafafa',
    borderRadius: 10,
    marginBottom: 8,
  },
  categoryIndicator: {
    width: 4,
    borderRadius: 2,
    marginRight: 10,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  logPartName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.orangeShade7,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '500',
  },
  logDetails: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  logDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  logDetailText: {
    fontSize: 11,
    color: '#999',
  },
  logNotes: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#777',
    marginTop: 4,
  },
};