import React, { useState, useMemo, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../../components/common/theme';
import VehicleDiagnostic, { getWearColor } from '../../../components/home/VehicleDiagnostic';
import { getCodingDayName, isTodayCodingDay } from '../../../utils/codingDayUtils';
import { getToken } from '../../../utils/jwtStorage';
import { useAsyncSQLiteContext } from '../../../utils/asyncSQliteProvider';
import { API_URL } from '../../../utils/config';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const BACKEND = API_URL;

// Coding days for picker
const CODING_DAYS = [
  { value: null, label: 'No Coding Day' },
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

// Maintenance schedule intervals
const MAINTENANCE_INTERVALS = {
  tire_pressure: { interval: 500, name: 'Tire Pressure', icon: 'ellipse' },
  chain: { interval: 500, name: 'Chain', icon: 'link' },
  battery_water: { interval: 500, name: 'Battery Water', icon: 'battery-half' },
  air_filter_clean: { interval: 500, name: 'Air Filter (Clean)', icon: 'cloud' },
  brake_check: { interval: 500, name: 'Brakes', icon: 'hand-left' },
  cables: { interval: 500, name: 'Cables', icon: 'git-branch' },
  engine_oil: { interval: 1000, name: 'Engine Oil', icon: 'water' },
  spark_plug: { interval: 1000, name: 'Spark Plug', icon: 'flash' },
  carburetor: { interval: 1000, name: 'Carburetor', icon: 'settings' },
  chain_sprockets: { interval: 1000, name: 'Chain & Sprockets', icon: 'cog' },
  oil_filter: { interval: 4000, name: 'Oil Filter', icon: 'funnel' },
  air_filter_replace: { interval: 4000, name: 'Air Filter (Replace)', icon: 'swap-vertical' },
  valve_clearance: { interval: 4000, name: 'Valve Clearance', icon: 'options' },
  battery_test: { interval: 4000, name: 'Battery Test', icon: 'pulse' },
  brake_fluid_flush: { interval: 11000, name: 'Brake Fluid', icon: 'beaker' },
  clutch_plates: { interval: 11000, name: 'Clutch Plates', icon: 'disc' },
  suspension: { interval: 11000, name: 'Suspension', icon: 'resize' },
  engine_overhaul: { interval: 20000, name: 'Engine Overhaul', icon: 'construct' },
  transmission_oil: { interval: 20000, name: 'Transmission Oil', icon: 'shuffle' },
  wiring_harness: { interval: 20000, name: 'Wiring', icon: 'git-network' },
};

// Tab Button Component
const TabButton = ({ label, icon, isActive, onPress, badge }) => (
  <TouchableOpacity
    style={[localStyles.tabButton, isActive && localStyles.activeTabButton]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={localStyles.tabButtonContent}>
      <Ionicons 
        name={icon} 
        size={18} 
        color={isActive ? colors.white : colors.orangeShade6} 
      />
      <Text style={[localStyles.tabButtonText, isActive && localStyles.activeTabButtonText]}>
        {label}
      </Text>
      {badge > 0 && (
        <View style={[localStyles.badge, isActive && localStyles.activeBadge]}>
          <Text style={localStyles.badgeText}>{badge}</Text>
        </View>
      )}
    </View>
  </TouchableOpacity>
);

// Maintenance Item Card
const MaintenanceItemCard = ({ itemKey, currentKm, lastServiceKm, onMarkDone }) => {
  const item = MAINTENANCE_INTERVALS[itemKey];
  if (!item) return null;

  const diff = Math.max(0, currentKm - (lastServiceKm || 0));
  const progress = Math.min(100, Math.round((diff / item.interval) * 100));
  const remaining = Math.max(0, item.interval - diff);
  const color = getWearColor(progress);

  return (
    <View style={localStyles.maintenanceCard}>
      <View style={[localStyles.maintenanceIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={item.icon} size={20} color={color} />
      </View>
      <View style={localStyles.maintenanceInfo}>
        <Text style={localStyles.maintenanceName}>{item.name}</Text>
        <View style={localStyles.progressContainer}>
          <View style={localStyles.progressBar}>
            <View style={[localStyles.progressFill, { width: `${progress}%`, backgroundColor: color }]} />
          </View>
          <Text style={[localStyles.progressText, { color }]}>{progress}%</Text>
        </View>
        <Text style={localStyles.maintenanceDetails}>
          {remaining > 0 ? `${remaining} km remaining` : 'Service overdue!'}
          {lastServiceKm > 0 && ` • Last: ${Math.round(lastServiceKm)} km`}
        </Text>
      </View>
      <TouchableOpacity 
        style={[localStyles.markDoneBtn, progress >= 80 && localStyles.markDoneBtnUrgent]}
        onPress={() => onMarkDone(itemKey)}
      >
        <Ionicons name="checkmark" size={16} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
};

export default function TricycleDetailsModal({
  visible,
  onClose,
  selectedTricycle,
  onTricycleUpdated
}) {
  const db = useAsyncSQLiteContext();
  const [activeTab, setActiveTab] = useState('info');
  const [tricycleData, setTricycleData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showCodingDayPicker, setShowCodingDayPicker] = useState(false);
  const [updatingCodingDay, setUpdatingCodingDay] = useState(false);

  // Get tricycle ID (handle both id and _id)
  const tricycleId = selectedTricycle?._id || selectedTricycle?.id;

  // Fetch fresh tricycle data when modal opens
  useEffect(() => {
    if (visible && tricycleId) {
      fetchTricycleData();
    }
    if (!visible) {
      setActiveTab('info');
      setTricycleData(null);
    }
  }, [visible, tricycleId]);

  const fetchTricycleData = async () => {
    if (!tricycleId) return;
    
    setLoading(true);
    try {
      const token = await getToken(db);
      const res = await fetch(`${BACKEND}/api/tricycles/${tricycleId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setTricycleData(data.data);
      } else {
        // Use the passed data if fetch fails
        setTricycleData(selectedTricycle);
      }
    } catch (error) {
      console.error('Error fetching tricycle:', error);
      setTricycleData(selectedTricycle);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTricycleData();
  };

  // Use fetched data or fall back to passed data
  const tricycle = tricycleData || selectedTricycle;
  const currentOdometer = tricycle?.currentOdometer || 0;
  const maintenanceHistory = tricycle?.maintenanceHistory || [];

  // Calculate parts status
  const partsStatus = useMemo(() => {
    const status = {};
    Object.keys(MAINTENANCE_INTERVALS).forEach(key => {
      const history = maintenanceHistory.find(h => h.itemKey === key);
      const lastServiceKm = history?.lastServiceKm || 0;
      const diff = Math.max(0, currentOdometer - lastServiceKm);
      const progress = Math.min(100, Math.round((diff / MAINTENANCE_INTERVALS[key].interval) * 100));
      status[key] = { progress, lastServiceKm };
    });
    return status;
  }, [maintenanceHistory, currentOdometer]);

  // Count critical items
  const criticalCount = useMemo(() => {
    return Object.values(partsStatus).filter(p => p.progress >= 80).length;
  }, [partsStatus]);

  // Get current tricycle ID for API calls
  const currentTricycleId = tricycle?._id || tricycle?.id || tricycleId;

  // Handle marking maintenance as done
  const handleMarkDone = async (itemKey) => {
    if (!currentTricycleId) return;
    
    try {
      const token = await getToken(db);
      await fetch(`${BACKEND}/api/tricycles/${currentTricycleId}/maintenance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          itemKey,
          lastServiceKm: currentOdometer,
          notes: 'Marked done by operator'
        })
      });
      // Refresh data
      fetchTricycleData();
    } catch (error) {
      console.error('Error marking maintenance:', error);
    }
  };

  // Handle updating coding day
  const handleUpdateCodingDay = async (newCodingDay) => {
    if (!currentTricycleId) return;
    
    setUpdatingCodingDay(true);
    try {
      const token = await getToken(db);
      const res = await fetch(`${BACKEND}/api/tricycles/${currentTricycleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          codingDay: newCodingDay
        })
      });
      
      const data = await res.json();
      if (data.success) {
        Alert.alert('Success', `Coding day updated to ${newCodingDay !== null ? getCodingDayName(newCodingDay) : 'None'}`);
        setShowCodingDayPicker(false);
        fetchTricycleData();
        // Notify parent to refresh
        if (onTricycleUpdated) {
          onTricycleUpdated();
        }
      } else {
        Alert.alert('Error', data.message || 'Failed to update coding day');
      }
    } catch (error) {
      console.error('Error updating coding day:', error);
      Alert.alert('Error', 'Failed to update coding day');
    } finally {
      setUpdatingCodingDay(false);
    }
  };

  const renderInfoTab = () => (
    <ScrollView 
      style={localStyles.tabContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
      }
    >
      {/* Vehicle Card */}
      <View style={localStyles.vehicleCard}>
        <View style={localStyles.vehicleIconWrap}>
          <Ionicons name="bicycle" size={40} color={colors.primary} />
        </View>
        <View style={localStyles.vehicleDetails}>
          <Text style={localStyles.plateNumber}>
            {tricycle?.plate || tricycle?.plateNumber}
          </Text>
          <Text style={localStyles.modelText}>{tricycle?.model}</Text>
          {tricycle?.bodyNumber && (
            <Text style={localStyles.bodyNumber}>Body #{tricycle.bodyNumber}</Text>
          )}
        </View>
        <View style={localStyles.odometerCard}>
          <Ionicons name="speedometer" size={24} color={colors.primary} />
          <Text style={localStyles.odometerValue}>{Math.round(currentOdometer)}</Text>
          <Text style={localStyles.odometerUnit}>km</Text>
        </View>
      </View>

      {/* Quick Stats */}
      <View style={localStyles.statsRow}>
        <View style={localStyles.statBox}>
          <Text style={localStyles.statValue}>{maintenanceHistory.length}</Text>
          <Text style={localStyles.statLabel}>Services</Text>
        </View>
        <View style={[localStyles.statBox, criticalCount > 0 && localStyles.statBoxAlert]}>
          <Text style={[localStyles.statValue, criticalCount > 0 && { color: '#EF4444' }]}>
            {criticalCount}
          </Text>
          <Text style={localStyles.statLabel}>Critical</Text>
        </View>
        <View style={localStyles.statBox}>
          <Text style={localStyles.statValue}>
            {tricycle?.schedules?.length || 0}
          </Text>
          <Text style={localStyles.statLabel}>Drivers</Text>
        </View>
      </View>

      {/* Primary Driver */}
      <View style={localStyles.section}>
        <Text style={localStyles.sectionTitle}>
          <Ionicons name="person" size={16} color={colors.orangeShade6} /> Primary Driver
        </Text>
        {tricycle?.driver ? (
          <View style={localStyles.driverCard}>
            {tricycle.driver.image?.url ? (
              <Image source={{ uri: tricycle.driver.image.url }} style={localStyles.avatar} />
            ) : (
              <View style={localStyles.avatarPlaceholder}>
                <Ionicons name="person" size={28} color={colors.orangeShade5} />
              </View>
            )}
            <View style={localStyles.driverInfo}>
              <Text style={localStyles.driverName}>
                {tricycle.driver.firstname} {tricycle.driver.lastname}
              </Text>
              <Text style={localStyles.driverUsername}>@{tricycle.driver.username}</Text>
            </View>
            <TouchableOpacity style={localStyles.messageBtn}>
              <Ionicons name="chatbubble" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={localStyles.emptyCard}>
            <Ionicons name="person-outline" size={24} color={colors.orangeShade4} />
            <Text style={localStyles.emptyText}>No driver assigned</Text>
          </View>
        )}
      </View>

      {/* Scheduled Drivers */}
      {tricycle?.schedules?.length > 0 && (
        <View style={localStyles.section}>
          <Text style={localStyles.sectionTitle}>
            <Ionicons name="calendar" size={16} color={colors.orangeShade6} /> Schedule
          </Text>
          {tricycle.schedules.map((sch, idx) => (
            <View key={idx} style={localStyles.scheduleItem}>
              <View style={localStyles.scheduleAvatar}>
                {sch.driver?.image?.url ? (
                  <Image source={{ uri: sch.driver.image.url }} style={localStyles.smallAvatar} />
                ) : (
                  <Ionicons name="person" size={16} color={colors.orangeShade5} />
                )}
              </View>
              <View style={localStyles.scheduleInfo}>
                <Text style={localStyles.scheduleName}>
                  {sch.driver?.firstname} {sch.driver?.lastname}
                </Text>
                <Text style={localStyles.scheduleTime}>
                  {sch.days?.join(', ')} • {sch.startTime}-{sch.endTime}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Coding Day Section */}
      <View style={localStyles.section}>
        <Text style={localStyles.sectionTitle}>
          <Ionicons name="ban" size={16} color={colors.orangeShade6} /> Coding Day Restriction
        </Text>
        <View style={[
          localStyles.codingDayCard,
          isTodayCodingDay(tricycle?.codingDay) && localStyles.codingDayCardActive
        ]}>
          <View style={localStyles.codingDayInfo}>
            <Text style={localStyles.codingDayLabel}>
              {tricycle?.codingDay !== null && tricycle?.codingDay !== undefined
                ? `Every ${getCodingDayName(tricycle.codingDay)}`
                : 'No coding day set'}
            </Text>
            {isTodayCodingDay(tricycle?.codingDay) && (
              <View style={localStyles.codingTodayBadge}>
                <Ionicons name="warning" size={12} color="#721c24" />
                <Text style={localStyles.codingTodayText}>CODING TODAY</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={localStyles.codingDayEditBtn}
            onPress={() => setShowCodingDayPicker(true)}
          >
            <Ionicons name="create-outline" size={18} color={colors.primary} />
            <Text style={localStyles.codingDayEditText}>Edit</Text>
          </TouchableOpacity>
        </View>
        <Text style={localStyles.codingDayHint}>
          The driver cannot operate this tricycle on the coding day.
        </Text>
      </View>
    </ScrollView>
  );

  const renderMaintenanceTab = () => {
    // Group by urgency
    const critical = [];
    const warning = [];
    const normal = [];

    Object.entries(partsStatus).forEach(([key, value]) => {
      const item = { key, ...value };
      if (value.progress >= 80) critical.push(item);
      else if (value.progress >= 60) warning.push(item);
      else normal.push(item);
    });

    return (
      <ScrollView 
        style={localStyles.tabContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {/* Odometer Display */}
        <View style={localStyles.odometerHeader}>
          <Text style={localStyles.odometerLabel}>Current Odometer</Text>
          <View style={localStyles.odometerDisplay}>
            <Ionicons name="speedometer" size={28} color={colors.primary} />
            <Text style={localStyles.odometerBig}>{Math.round(currentOdometer)}</Text>
            <Text style={localStyles.odometerKm}>km</Text>
          </View>
        </View>

        {/* Critical Items */}
        {critical.length > 0 && (
          <View style={localStyles.maintenanceSection}>
            <View style={localStyles.sectionHeader}>
              <Ionicons name="warning" size={18} color="#EF4444" />
              <Text style={[localStyles.sectionHeaderText, { color: '#EF4444' }]}>
                Critical ({critical.length})
              </Text>
            </View>
            {critical.map(item => (
              <MaintenanceItemCard
                key={item.key}
                itemKey={item.key}
                currentKm={currentOdometer}
                lastServiceKm={item.lastServiceKm}
                onMarkDone={handleMarkDone}
              />
            ))}
          </View>
        )}

        {/* Warning Items */}
        {warning.length > 0 && (
          <View style={localStyles.maintenanceSection}>
            <View style={localStyles.sectionHeader}>
              <Ionicons name="alert-circle" size={18} color="#F59E0B" />
              <Text style={[localStyles.sectionHeaderText, { color: '#F59E0B' }]}>
                Approaching ({warning.length})
              </Text>
            </View>
            {warning.map(item => (
              <MaintenanceItemCard
                key={item.key}
                itemKey={item.key}
                currentKm={currentOdometer}
                lastServiceKm={item.lastServiceKm}
                onMarkDone={handleMarkDone}
              />
            ))}
          </View>
        )}

        {/* Normal Items */}
        {normal.length > 0 && (
          <View style={localStyles.maintenanceSection}>
            <View style={localStyles.sectionHeader}>
              <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
              <Text style={[localStyles.sectionHeaderText, { color: '#22C55E' }]}>
                Good Condition ({normal.length})
              </Text>
            </View>
            {normal.map(item => (
              <MaintenanceItemCard
                key={item.key}
                itemKey={item.key}
                currentKm={currentOdometer}
                lastServiceKm={item.lastServiceKm}
                onMarkDone={handleMarkDone}
              />
            ))}
          </View>
        )}
      </ScrollView>
    );
  };

  const renderDiagnosticTab = () => (
    <ScrollView 
      style={localStyles.tabContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
      }
    >
      <VehicleDiagnostic partsStatus={partsStatus} />
      
      {/* Legend */}
      <View style={localStyles.legend}>
        <Text style={localStyles.legendTitle}>Status Legend</Text>
        <View style={localStyles.legendRow}>
          <View style={[localStyles.legendDot, { backgroundColor: '#22C55E' }]} />
          <Text style={localStyles.legendText}>Good (0-30%)</Text>
          <View style={[localStyles.legendDot, { backgroundColor: '#84CC16' }]} />
          <Text style={localStyles.legendText}>Fair (30-60%)</Text>
        </View>
        <View style={localStyles.legendRow}>
          <View style={[localStyles.legendDot, { backgroundColor: '#F59E0B' }]} />
          <Text style={localStyles.legendText}>Worn (60-80%)</Text>
          <View style={[localStyles.legendDot, { backgroundColor: '#EF4444' }]} />
          <Text style={localStyles.legendText}>Critical (80%+)</Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderContent = () => {
    if (loading && !tricycleData) {
      return (
        <View style={localStyles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={localStyles.loadingText}>Loading vehicle data...</Text>
        </View>
      );
    }

    switch (activeTab) {
      case 'maintenance':
        return renderMaintenanceTab();
      case 'diagnostic':
        return renderDiagnosticTab();
      case 'info':
      default:
        return renderInfoTab();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={localStyles.modalOverlay}>
        <View style={localStyles.modalContainer}>
          {/* Handle Bar */}
          <View style={localStyles.handleBar} />

          {/* Header */}
          <View style={localStyles.header}>
            <View>
              <Text style={localStyles.headerTitle}>Vehicle Details</Text>
              <Text style={localStyles.headerSubtitle}>
                {tricycle?.plate || tricycle?.plateNumber} • {tricycle?.model}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={localStyles.closeButton}>
              <Ionicons name="close-circle" size={32} color={colors.orangeShade5} />
            </TouchableOpacity>
          </View>

          {/* Tab Navigation */}
          <View style={localStyles.tabNav}>
            <TabButton
              label="Overview"
              icon="information-circle"
              isActive={activeTab === 'info'}
              onPress={() => setActiveTab('info')}
            />
            <TabButton
              label="Maintenance"
              icon="build"
              isActive={activeTab === 'maintenance'}
              onPress={() => setActiveTab('maintenance')}
              badge={criticalCount}
            />
            <TabButton
              label="Diagnostic"
              icon="analytics"
              isActive={activeTab === 'diagnostic'}
              onPress={() => setActiveTab('diagnostic')}
            />
          </View>

          {/* Content */}
          <View style={localStyles.content}>
            {renderContent()}
          </View>
        </View>
      </View>

      {/* Coding Day Picker Modal */}
      <Modal visible={showCodingDayPicker} animationType="slide" transparent>
        <View style={localStyles.pickerOverlay}>
          <View style={localStyles.pickerContainer}>
            <View style={localStyles.pickerHeader}>
              <Text style={localStyles.pickerTitle}>Select Coding Day</Text>
              <TouchableOpacity onPress={() => setShowCodingDayPicker(false)}>
                <Ionicons name="close" size={24} color={colors.orangeShade6} />
              </TouchableOpacity>
            </View>
            <Text style={localStyles.pickerSubtitle}>
              Choose the day when this tricycle cannot operate
            </Text>
            <ScrollView style={localStyles.pickerList}>
              {CODING_DAYS.map((day) => (
                <TouchableOpacity
                  key={day.value === null ? 'none' : day.value}
                  style={[
                    localStyles.pickerItem,
                    tricycle?.codingDay === day.value && localStyles.pickerItemSelected
                  ]}
                  onPress={() => handleUpdateCodingDay(day.value)}
                  disabled={updatingCodingDay}
                >
                  <Text style={[
                    localStyles.pickerItemText,
                    tricycle?.codingDay === day.value && localStyles.pickerItemTextSelected
                  ]}>
                    {day.label}
                  </Text>
                  {tricycle?.codingDay === day.value && (
                    <Ionicons name="checkmark-circle" size={22} color="#fff" />
                  )}
                  {updatingCodingDay && tricycle?.codingDay !== day.value && (
                    <ActivityIndicator size="small" color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={localStyles.pickerCancelBtn}
              onPress={() => setShowCodingDayPicker(false)}
            >
              <Text style={localStyles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const localStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FAFAFA',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: screenHeight * 0.92,
    minHeight: screenHeight * 0.75,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.orangeShade7,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.orangeShade5,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  tabNav: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  activeTabButton: {
    backgroundColor: colors.primary,
  },
  tabButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.orangeShade6,
  },
  activeTabButtonText: {
    color: colors.white,
  },
  badge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  activeBadge: {
    backgroundColor: colors.white,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.white,
  },
  content: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    color: colors.orangeShade5,
    fontSize: 14,
  },

  // Vehicle Card
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  vehicleIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleDetails: {
    flex: 1,
    marginLeft: 14,
  },
  plateNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.orangeShade7,
  },
  modelText: {
    fontSize: 14,
    color: colors.orangeShade5,
    marginTop: 2,
  },
  bodyNumber: {
    fontSize: 12,
    color: colors.orangeShade4,
    marginTop: 2,
  },
  odometerCard: {
    alignItems: 'center',
    backgroundColor: colors.primary + '10',
    padding: 12,
    borderRadius: 12,
  },
  odometerValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 2,
  },
  odometerUnit: {
    fontSize: 10,
    color: colors.orangeShade5,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.white,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  statBoxAlert: {
    backgroundColor: '#FEF2F2',
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.orangeShade7,
  },
  statLabel: {
    fontSize: 11,
    color: colors.orangeShade5,
    marginTop: 2,
  },

  // Section
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.orangeShade6,
    marginBottom: 10,
  },

  // Driver Card
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 14,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverInfo: {
    flex: 1,
    marginLeft: 14,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.orangeShade7,
  },
  driverUsername: {
    fontSize: 12,
    color: colors.orangeShade5,
    marginTop: 2,
  },
  messageBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    color: colors.orangeShade4,
    fontStyle: 'italic',
  },

  // Schedule
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  scheduleAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  scheduleInfo: {
    flex: 1,
    marginLeft: 12,
  },
  scheduleName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.orangeShade7,
  },
  scheduleTime: {
    fontSize: 11,
    color: colors.orangeShade5,
    marginTop: 2,
  },

  // Maintenance Tab
  odometerHeader: {
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  odometerLabel: {
    fontSize: 12,
    color: colors.orangeShade5,
    marginBottom: 8,
  },
  odometerDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  odometerBig: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.orangeShade7,
  },
  odometerKm: {
    fontSize: 16,
    color: colors.orangeShade5,
  },
  maintenanceSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '600',
  },
  maintenanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  maintenanceIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  maintenanceInfo: {
    flex: 1,
    marginLeft: 12,
  },
  maintenanceName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.orangeShade7,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    width: 36,
    textAlign: 'right',
  },
  maintenanceDetails: {
    fontSize: 11,
    color: colors.orangeShade5,
    marginTop: 4,
  },
  markDoneBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  markDoneBtnUrgent: {
    backgroundColor: '#EF4444',
  },

  // Legend
  legend: {
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 20,
  },
  legendTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.orangeShade6,
    marginBottom: 10,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: colors.orangeShade5,
    marginRight: 16,
  },

  // Coding Day Styles
  codingDayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e3e5',
  },
  codingDayCardActive: {
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
  },
  codingDayInfo: {
    flex: 1,
  },
  codingDayLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.orangeShade7,
  },
  codingTodayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5c6cb',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  codingTodayText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#721c24',
    marginLeft: 4,
  },
  codingDayEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ivory3,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  codingDayEditText: {
    fontSize: 13,
    color: colors.primary,
    marginLeft: 4,
    fontWeight: '500',
  },
  codingDayHint: {
    fontSize: 11,
    color: colors.orangeShade5,
    marginTop: 8,
    fontStyle: 'italic',
  },

  // Coding Day Picker Modal
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerContainer: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    maxHeight: '70%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.orangeShade7,
  },
  pickerSubtitle: {
    fontSize: 13,
    color: colors.orangeShade5,
    marginBottom: 16,
  },
  pickerList: {
    maxHeight: 300,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    marginBottom: 8,
  },
  pickerItemSelected: {
    backgroundColor: colors.primary,
  },
  pickerItemText: {
    fontSize: 16,
    color: '#333',
  },
  pickerItemTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  pickerCancelBtn: {
    marginTop: 12,
    padding: 14,
    alignItems: 'center',
    backgroundColor: '#6c757d',
    borderRadius: 10,
  },
  pickerCancelText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});