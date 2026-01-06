/**
 * ServiceHistory.jsx - Service History & Documentation
 * 
 * Features:
 * - Complete maintenance history timeline
 * - Service records with details
 * - Export to PDF/CSV functionality
 * - Filter by date, part, or category
 * - Statistics and insights
 * - Share capability
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Share,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { spacing } from '../common/theme';

// Storage keys
const MAINTENANCE_HISTORY_KEY = 'maintenance_history_v2';

// Part definitions for display
const PART_INFO = {
  tire_pressure: { name: 'Tire Pressure', category: 'Safety', icon: 'speedometer' },
  chain: { name: 'Chain', category: 'Drivetrain', icon: 'link' },
  battery_water: { name: 'Battery Water', category: 'Electrical', icon: 'battery-charging' },
  air_filter_clean: { name: 'Air Filter (Clean)', category: 'Engine', icon: 'cloud' },
  brake_check: { name: 'Brake System', category: 'Safety', icon: 'stop-circle' },
  cables: { name: 'Control Cables', category: 'Controls', icon: 'git-branch' },
  engine_oil: { name: 'Engine Oil', category: 'Engine', icon: 'water' },
  spark_plug: { name: 'Spark Plug', category: 'Ignition', icon: 'flash' },
  carburetor: { name: 'Carburetor', category: 'Fuel System', icon: 'git-merge' },
  chain_sprockets: { name: 'Chain & Sprockets', category: 'Drivetrain', icon: 'link' },
  oil_filter: { name: 'Oil Filter', category: 'Engine', icon: 'funnel' },
  air_filter_replace: { name: 'Air Filter (Replace)', category: 'Engine', icon: 'cloud' },
  valve_clearance: { name: 'Valve Clearance', category: 'Engine', icon: 'settings' },
  battery_test: { name: 'Battery Test', category: 'Electrical', icon: 'battery-full' },
  brake_fluid_flush: { name: 'Brake Fluid', category: 'Safety', icon: 'water' },
  clutch_plates: { name: 'Clutch Plates', category: 'Drivetrain', icon: 'disc' },
  suspension: { name: 'Suspension', category: 'Chassis', icon: 'resize' },
  engine_overhaul: { name: 'Engine Overhaul', category: 'Engine', icon: 'construct' },
  transmission_oil: { name: 'Transmission Oil', category: 'Drivetrain', icon: 'water' },
  wiring_harness: { name: 'Wiring Harness', category: 'Electrical', icon: 'git-network' },
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

// Format date for display
const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Service Record Card Component
const ServiceRecordCard = ({ record, onPress }) => {
  const partInfo = PART_INFO[record.itemKey] || { 
    name: record.itemKey, 
    category: 'Other', 
    icon: 'build' 
  };
  const categoryColor = CATEGORY_COLORS[partInfo.category] || '#64748b';

  return (
    <TouchableOpacity style={styles.recordCard} onPress={onPress}>
      <View style={[styles.recordIcon, { backgroundColor: categoryColor + '20' }]}>
        <Ionicons name={partInfo.icon} size={20} color={categoryColor} />
      </View>
      <View style={styles.recordContent}>
        <View style={styles.recordHeader}>
          <Text style={styles.recordName}>{partInfo.name}</Text>
          <View style={[styles.categoryBadge, { backgroundColor: categoryColor + '20' }]}>
            <Text style={[styles.categoryText, { color: categoryColor }]}>{partInfo.category}</Text>
          </View>
        </View>
        <View style={styles.recordDetails}>
          <View style={styles.recordDetail}>
            <Ionicons name="speedometer-outline" size={12} color="#64748b" />
            <Text style={styles.recordDetailText}>{record.km?.toLocaleString() || 0} km</Text>
          </View>
          <View style={styles.recordDetail}>
            <Ionicons name="calendar-outline" size={12} color="#64748b" />
            <Text style={styles.recordDetailText}>{formatDate(record.date)}</Text>
          </View>
        </View>
        {record.notes ? (
          <Text style={styles.recordNotes} numberOfLines={2}>{record.notes}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color="#475569" />
    </TouchableOpacity>
  );
};

// Statistics Card Component
const StatCard = ({ icon, value, label, color }) => (
  <View style={styles.statCard}>
    <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon} size={18} color={color} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// Filter Modal Component
const FilterModal = ({ visible, filters, onApply, onClose }) => {
  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const categories = [...new Set(Object.values(PART_INFO).map(p => p.category))];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.filterModalContent}>
          <View style={styles.filterHeader}>
            <Text style={styles.filterTitle}>Filter History</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.filterBody}>
            {/* Date Range */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Date Range</Text>
              <View style={styles.dateButtons}>
                {[
                  { label: 'All Time', value: 'all' },
                  { label: 'Last 30 Days', value: '30' },
                  { label: 'Last 90 Days', value: '90' },
                  { label: 'This Year', value: 'year' },
                ].map(option => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.dateButton,
                      localFilters.dateRange === option.value && styles.dateButtonActive,
                    ]}
                    onPress={() => setLocalFilters(prev => ({ ...prev, dateRange: option.value }))}
                  >
                    <Text style={[
                      styles.dateButtonText,
                      localFilters.dateRange === option.value && styles.dateButtonTextActive,
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Category Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Category</Text>
              <View style={styles.categoryButtons}>
                <TouchableOpacity
                  style={[
                    styles.categoryButton,
                    localFilters.category === 'all' && styles.categoryButtonActive,
                  ]}
                  onPress={() => setLocalFilters(prev => ({ ...prev, category: 'all' }))}
                >
                  <Text style={[
                    styles.categoryButtonText,
                    localFilters.category === 'all' && styles.categoryButtonTextActive,
                  ]}>All</Text>
                </TouchableOpacity>
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryButton,
                      localFilters.category === cat && styles.categoryButtonActive,
                      { borderColor: CATEGORY_COLORS[cat] || '#64748b' },
                    ]}
                    onPress={() => setLocalFilters(prev => ({ ...prev, category: cat }))}
                  >
                    <Text style={[
                      styles.categoryButtonText,
                      localFilters.category === cat && styles.categoryButtonTextActive,
                    ]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Sort Order */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Sort By</Text>
              <View style={styles.dateButtons}>
                {[
                  { label: 'Newest First', value: 'newest' },
                  { label: 'Oldest First', value: 'oldest' },
                  { label: 'Highest KM', value: 'km_high' },
                  { label: 'Lowest KM', value: 'km_low' },
                ].map(option => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.dateButton,
                      localFilters.sortBy === option.value && styles.dateButtonActive,
                    ]}
                    onPress={() => setLocalFilters(prev => ({ ...prev, sortBy: option.value }))}
                  >
                    <Text style={[
                      styles.dateButtonText,
                      localFilters.sortBy === option.value && styles.dateButtonTextActive,
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={styles.filterActions}>
            <TouchableOpacity
              style={styles.resetBtn}
              onPress={() => setLocalFilters({ dateRange: 'all', category: 'all', sortBy: 'newest' })}
            >
              <Text style={styles.resetBtnText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.applyBtn}
              onPress={() => {
                onApply(localFilters);
                onClose();
              }}
            >
              <Text style={styles.applyBtnText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Record Detail Modal Component
const RecordDetailModal = ({ visible, record, onClose }) => {
  if (!record) return null;

  const partInfo = PART_INFO[record.itemKey] || { 
    name: record.itemKey, 
    category: 'Other', 
    icon: 'build' 
  };
  const categoryColor = CATEGORY_COLORS[partInfo.category] || '#64748b';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.detailModalContent}>
          <View style={[styles.detailHeader, { borderBottomColor: categoryColor }]}>
            <View style={styles.detailHeaderLeft}>
              <View style={[styles.detailIcon, { backgroundColor: categoryColor + '20' }]}>
                <Ionicons name={partInfo.icon} size={28} color={categoryColor} />
              </View>
              <View>
                <Text style={styles.detailTitle}>{partInfo.name}</Text>
                <View style={[styles.categoryBadge, { backgroundColor: categoryColor + '20' }]}>
                  <Text style={[styles.categoryText, { color: categoryColor }]}>{partInfo.category}</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.detailBody}>
            {/* Service Info */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Service Information</Text>
              <View style={styles.detailGrid}>
                <View style={styles.detailItem}>
                  <Ionicons name="calendar" size={16} color="#60a5fa" />
                  <View>
                    <Text style={styles.detailItemLabel}>Date</Text>
                    <Text style={styles.detailItemValue}>{formatDateTime(record.date)}</Text>
                  </View>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="speedometer" size={16} color="#22c55e" />
                  <View>
                    <Text style={styles.detailItemLabel}>Odometer</Text>
                    <Text style={styles.detailItemValue}>{record.km?.toLocaleString() || 0} km</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Notes */}
            {record.notes ? (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Notes</Text>
                <View style={styles.notesBox}>
                  <Text style={styles.notesText}>{record.notes}</Text>
                </View>
              </View>
            ) : null}

            {/* Previous Services for this part */}
            {record.previousServices && record.previousServices.length > 0 ? (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Previous Services</Text>
                {record.previousServices.slice(0, 3).map((prev, idx) => (
                  <View key={idx} style={styles.prevServiceItem}>
                    <Text style={styles.prevServiceDate}>{formatDate(prev.date)}</Text>
                    <Text style={styles.prevServiceKm}>{prev.km?.toLocaleString() || 0} km</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// Main Service History Component
const ServiceHistory = ({ tricycleId, plateNumber, maintenanceData }) => {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [filters, setFilters] = useState({ dateRange: 'all', category: 'all', sortBy: 'newest' });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load maintenance history
  useEffect(() => {
    loadHistory();
  }, [tricycleId]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const historyKey = tricycleId 
        ? `${MAINTENANCE_HISTORY_KEY}_${tricycleId}` 
        : MAINTENANCE_HISTORY_KEY;
      const historyStr = await AsyncStorage.getItem(historyKey);
      
      if (historyStr) {
        const parsed = JSON.parse(historyStr);
        setHistory(Array.isArray(parsed) ? parsed : []);
      } else {
        setHistory([]);
      }
    } catch (error) {
      console.warn('Error loading history:', error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort history
  const filteredHistory = useMemo(() => {
    let result = [...history];

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(record => {
        const partInfo = PART_INFO[record.itemKey];
        const partName = partInfo?.name?.toLowerCase() || record.itemKey.toLowerCase();
        const category = partInfo?.category?.toLowerCase() || '';
        const notes = record.notes?.toLowerCase() || '';
        return partName.includes(query) || category.includes(query) || notes.includes(query);
      });
    }

    // Apply date filter
    if (filters.dateRange !== 'all') {
      const now = new Date();
      let cutoffDate;
      
      if (filters.dateRange === '30') {
        cutoffDate = new Date(now.setDate(now.getDate() - 30));
      } else if (filters.dateRange === '90') {
        cutoffDate = new Date(now.setDate(now.getDate() - 90));
      } else if (filters.dateRange === 'year') {
        cutoffDate = new Date(now.getFullYear(), 0, 1);
      }
      
      if (cutoffDate) {
        result = result.filter(record => new Date(record.date) >= cutoffDate);
      }
    }

    // Apply category filter
    if (filters.category !== 'all') {
      result = result.filter(record => {
        const partInfo = PART_INFO[record.itemKey];
        return partInfo?.category === filters.category;
      });
    }

    // Apply sort
    result.sort((a, b) => {
      if (filters.sortBy === 'newest') {
        return new Date(b.date) - new Date(a.date);
      } else if (filters.sortBy === 'oldest') {
        return new Date(a.date) - new Date(b.date);
      } else if (filters.sortBy === 'km_high') {
        return (b.km || 0) - (a.km || 0);
      } else if (filters.sortBy === 'km_low') {
        return (a.km || 0) - (b.km || 0);
      }
      return 0;
    });

    return result;
  }, [history, filters, searchQuery]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalServices = history.length;
    const categories = {};
    let lastServiceDate = null;
    let totalKmServiced = 0;

    history.forEach(record => {
      const partInfo = PART_INFO[record.itemKey];
      const cat = partInfo?.category || 'Other';
      categories[cat] = (categories[cat] || 0) + 1;
      
      if (!lastServiceDate || new Date(record.date) > new Date(lastServiceDate)) {
        lastServiceDate = record.date;
      }
      
      totalKmServiced += record.km || 0;
    });

    const mostServicedCategory = Object.entries(categories)
      .sort((a, b) => b[1] - a[1])[0];

    return {
      totalServices,
      lastServiceDate,
      avgKmPerService: totalServices > 0 ? Math.round(totalKmServiced / totalServices) : 0,
      mostServicedCategory: mostServicedCategory ? mostServicedCategory[0] : 'N/A',
      categoryCounts: categories,
    };
  }, [history]);

  // Generate CSV content
  const generateCSV = useCallback(() => {
    const headers = ['Date', 'Part', 'Category', 'Odometer (km)', 'Notes'];
    const rows = filteredHistory.map(record => {
      const partInfo = PART_INFO[record.itemKey] || { name: record.itemKey, category: 'Other' };
      return [
        formatDateTime(record.date),
        partInfo.name,
        partInfo.category,
        record.km || 0,
        `"${(record.notes || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }, [filteredHistory]);

  // Generate text report
  const generateTextReport = useCallback(() => {
    const lines = [
      '═══════════════════════════════════════════',
      '       MAINTENANCE SERVICE HISTORY REPORT',
      '═══════════════════════════════════════════',
      '',
      `Vehicle: ${plateNumber || 'Unknown'}`,
      `Generated: ${formatDateTime(new Date().toISOString())}`,
      `Total Records: ${filteredHistory.length}`,
      '',
      '───────────────────────────────────────────',
      '                 SUMMARY',
      '───────────────────────────────────────────',
      `Total Services: ${stats.totalServices}`,
      `Last Service: ${formatDate(stats.lastServiceDate)}`,
      `Avg. KM per Service: ${stats.avgKmPerService.toLocaleString()} km`,
      `Most Serviced: ${stats.mostServicedCategory}`,
      '',
      '───────────────────────────────────────────',
      '              SERVICE RECORDS',
      '───────────────────────────────────────────',
      '',
    ];

    filteredHistory.forEach((record, idx) => {
      const partInfo = PART_INFO[record.itemKey] || { name: record.itemKey, category: 'Other' };
      lines.push(`${idx + 1}. ${partInfo.name}`);
      lines.push(`   Category: ${partInfo.category}`);
      lines.push(`   Date: ${formatDateTime(record.date)}`);
      lines.push(`   Odometer: ${(record.km || 0).toLocaleString()} km`);
      if (record.notes) {
        lines.push(`   Notes: ${record.notes}`);
      }
      lines.push('');
    });

    lines.push('═══════════════════════════════════════════');
    lines.push('         END OF REPORT');
    lines.push('═══════════════════════════════════════════');

    return lines.join('\n');
  }, [filteredHistory, plateNumber, stats]);

  // Export functionality - using Share API
  const handleExport = async (format) => {
    try {
      setExporting(true);

      let content;

      if (format === 'csv') {
        content = generateCSV();
      } else {
        content = generateTextReport();
      }

      await Share.share({
        message: content,
        title: format === 'csv' ? 'Maintenance History (CSV)' : 'Maintenance History Report',
      });
    } catch (error) {
      console.error('Export error:', error);
      if (error.message !== 'User did not share') {
        Alert.alert('Export Failed', 'Could not export the maintenance history.');
      }
    } finally {
      setExporting(false);
    }
  };

  // Share via text
  const handleShare = async () => {
    try {
      const report = generateTextReport();
      await Share.share({
        message: report,
        title: 'Maintenance History Report',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#60a5fa" />
        <Text style={styles.loadingText}>Loading service history...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="document-text" size={22} color="#60a5fa" />
          <View>
            <Text style={styles.title}>Service History</Text>
            <Text style={styles.subtitle}>{history.length} records</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setShowFilters(true)}
          >
            <Ionicons name="filter" size={18} color="#60a5fa" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={handleShare}
          >
            <Ionicons name="share-outline" size={18} color="#60a5fa" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Statistics */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScroll}>
        <View style={styles.statsRow}>
          <StatCard
            icon="construct"
            value={stats.totalServices}
            label="Total Services"
            color="#3b82f6"
          />
          <StatCard
            icon="calendar"
            value={stats.lastServiceDate ? formatDate(stats.lastServiceDate).split(',')[0] : 'N/A'}
            label="Last Service"
            color="#22c55e"
          />
          <StatCard
            icon="speedometer"
            value={`${stats.avgKmPerService.toLocaleString()}`}
            label="Avg. KM/Service"
            color="#f97316"
          />
          <StatCard
            icon="trophy"
            value={stats.mostServicedCategory}
            label="Most Serviced"
            color="#a855f7"
          />
        </View>
      </ScrollView>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#64748b" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search parts, categories..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#64748b" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Active Filters Badge */}
      {(filters.dateRange !== 'all' || filters.category !== 'all') ? (
        <View style={styles.activeFilters}>
          <Text style={styles.activeFiltersText}>
            Filters active: {filters.dateRange !== 'all' && filters.dateRange} {filters.category !== 'all' && filters.category}
          </Text>
          <TouchableOpacity
            onPress={() => setFilters({ dateRange: 'all', category: 'all', sortBy: 'newest' })}
          >
            <Text style={styles.clearFiltersText}>Clear</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Export Buttons */}
      <View style={styles.exportContainer}>
        <TouchableOpacity
          style={[styles.exportBtn, exporting && styles.exportBtnDisabled]}
          onPress={() => handleExport('txt')}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="document-text-outline" size={16} color="#fff" />
              <Text style={styles.exportBtnText}>Export Report</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.exportBtn, styles.exportBtnSecondary, exporting && styles.exportBtnDisabled]}
          onPress={() => handleExport('csv')}
          disabled={exporting}
        >
          <Ionicons name="grid-outline" size={16} color="#60a5fa" />
          <Text style={[styles.exportBtnText, styles.exportBtnTextSecondary]}>Export CSV</Text>
        </TouchableOpacity>
      </View>

      {/* Records List */}
      <View style={styles.recordsContainer}>
        <Text style={styles.recordsTitle}>
          {filteredHistory.length} Record{filteredHistory.length !== 1 ? 's' : ''} Found
        </Text>
        
        {filteredHistory.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={48} color="#475569" />
            <Text style={styles.emptyTitle}>No Records Found</Text>
            <Text style={styles.emptyText}>
              {searchQuery || filters.category !== 'all' || filters.dateRange !== 'all'
                ? 'Try adjusting your filters'
                : 'Complete maintenance tasks to build your service history'}
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.recordsList} showsVerticalScrollIndicator={false}>
            {filteredHistory.map((record, idx) => (
              <ServiceRecordCard
                key={`${record.itemKey}-${record.date}-${idx}`}
                record={record}
                onPress={() => setSelectedRecord(record)}
              />
            ))}
            <View style={{ height: 20 }} />
          </ScrollView>
        )}
      </View>

      {/* Filter Modal */}
      <FilterModal
        visible={showFilters}
        filters={filters}
        onApply={setFilters}
        onClose={() => setShowFilters(false)}
      />

      {/* Record Detail Modal */}
      <RecordDetailModal
        visible={!!selectedRecord}
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: spacing.medium,
    borderWidth: 1,
    borderColor: '#1e3a5f',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 16,
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    padding: 8,
    backgroundColor: '#1e293b',
    borderRadius: 8,
  },

  // Stats
  statsScroll: {
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  statsRow: {
    flexDirection: 'row',
    padding: spacing.medium,
    gap: 10,
  },
  statCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    minWidth: 90,
    alignItems: 'center',
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f1f5f9',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 2,
    textAlign: 'center',
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.medium,
    marginBottom: spacing.small,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: '#f1f5f9',
    fontSize: 14,
  },

  // Active Filters
  activeFilters: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.medium,
    marginBottom: spacing.small,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#3b82f620',
    borderRadius: 8,
  },
  activeFiltersText: {
    fontSize: 12,
    color: '#60a5fa',
  },
  clearFiltersText: {
    fontSize: 12,
    color: '#60a5fa',
    fontWeight: '600',
  },

  // Export
  exportContainer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: spacing.medium,
    marginBottom: spacing.medium,
  },
  exportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  exportBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  exportBtnDisabled: {
    opacity: 0.6,
  },
  exportBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  exportBtnTextSecondary: {
    color: '#60a5fa',
  },

  // Records
  recordsContainer: {
    padding: spacing.medium,
    paddingTop: 0,
  },
  recordsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 10,
  },
  recordsList: {
    maxHeight: 400,
  },
  recordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  recordIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordContent: {
    flex: 1,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  recordName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f1f5f9',
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
  recordDetails: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  recordDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recordDetailText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  recordNotes: {
    fontSize: 11,
    color: '#64748b',
    fontStyle: 'italic',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 12,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },

  // Filter Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  filterModalContent: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#1e3a5f',
    borderBottomWidth: 0,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  filterBody: {
    padding: spacing.medium,
  },
  filterSection: {
    marginBottom: 20,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 10,
  },
  dateButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dateButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  dateButtonText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  dateButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  categoryButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  categoryButtonActive: {
    backgroundColor: '#3b82f620',
  },
  categoryButtonText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  categoryButtonTextActive: {
    fontWeight: '600',
  },
  filterActions: {
    flexDirection: 'row',
    padding: spacing.medium,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  resetBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    alignItems: 'center',
  },
  resetBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  applyBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Detail Modal
  detailModalContent: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: '#1e3a5f',
    borderBottomWidth: 0,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.medium,
    borderBottomWidth: 3,
  },
  detailHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 4,
  },
  detailBody: {
    padding: spacing.medium,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 10,
  },
  detailGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  detailItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 10,
  },
  detailItemLabel: {
    fontSize: 10,
    color: '#64748b',
  },
  detailItemValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  notesBox: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 10,
  },
  notesText: {
    fontSize: 13,
    color: '#cbd5e1',
    lineHeight: 20,
  },
  prevServiceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  prevServiceDate: {
    fontSize: 12,
    color: '#94a3b8',
  },
  prevServiceKm: {
    fontSize: 12,
    color: '#64748b',
  },
});

export default ServiceHistory;
export { PART_INFO, CATEGORY_COLORS, formatDate, formatDateTime };
