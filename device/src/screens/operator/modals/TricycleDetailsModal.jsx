import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  TextInput,
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

// Fallback maintenance schedule (used when server config is unavailable)
const FALLBACK_SCHEDULE = [
  {
    id: 'weekly', title: 'Weekly (or every 300–500 km)', intervalKm: 500, baselineDays: 7, reminderLabel: 'Weekly',
    items: [
      { key: 'tire_pressure', name: 'Tire Pressure', notes: 'Recheck and inflate, check for uneven wear' },
      { key: 'chain', name: 'Chain', notes: 'Clean, lubricate, and adjust' },
      { key: 'battery_water', name: 'Battery Water', notes: 'Top up with distilled water (non-MF)' },
      { key: 'air_filter_clean', name: 'Air Filter (Clean)', notes: 'Clean using compressed air' },
      { key: 'brake_check', name: 'Brake System', notes: 'Check pads/shoes for wear' },
      { key: 'cables', name: 'Cables', notes: 'Lubricate clutch/throttle cables' },
    ],
  },
  {
    id: '1000', title: 'Every 1,000 km (monthly heavy use)', intervalKm: 1000, baselineDays: 30, reminderLabel: 'Monthly',
    items: [
      { key: 'engine_oil', name: 'Engine Oil', notes: 'Replace (SAE 10W-40 or 20W-50)' },
      { key: 'spark_plug', name: 'Spark Plug', notes: 'Inspect/clean or replace; gap 0.7–0.8 mm' },
      { key: 'carburetor', name: 'Carburetor', notes: 'Check idle & mixture' },
      { key: 'chain_sprockets', name: 'Chain & Sprockets', notes: 'Inspect for wear' },
    ],
  },
  {
    id: '3000-5000', title: 'Every 3,000–5,000 km', intervalKm: 4000, baselineDays: 90, reminderLabel: 'Quarterly',
    items: [
      { key: 'oil_filter', name: 'Oil Filter', notes: 'Replace if equipped' },
      { key: 'air_filter_replace', name: 'Air Filter (Replace)', notes: 'Replace if dusty/oily' },
      { key: 'valve_clearance', name: 'Valve Clearance', notes: 'Adjust per spec' },
      { key: 'battery_test', name: 'Battery Test', notes: 'Test voltage; replace if weak' },
    ],
  },
  {
    id: '10000', title: 'Every 10,000–12,000 km (or annually)', intervalKm: 11000, baselineDays: 365, reminderLabel: 'Annual',
    items: [
      { key: 'brake_fluid_flush', name: 'Brake Fluid', notes: 'Flush & replace' },
      { key: 'clutch_plates', name: 'Clutch Plates', notes: 'Inspect & replace if slipping' },
      { key: 'suspension', name: 'Suspension', notes: 'Inspect fork oil & shocks' },
    ],
  },
  {
    id: '20000', title: 'Major service — Every 20,000 km', intervalKm: 20000, baselineDays: 730, reminderLabel: 'Bi-Annual',
    items: [
      { key: 'engine_overhaul', name: 'Engine Overhaul', notes: 'Check rings, valves, gaskets' },
      { key: 'transmission_oil', name: 'Transmission Oil', notes: 'Replace if applicable' },
      { key: 'wiring_harness', name: 'Wiring Harness', notes: 'Replace brittle wiring' },
    ],
  },
];

// Maintenance part icons for display
const PART_ICONS = {
  tire_pressure: 'ellipse', chain: 'link', battery_water: 'battery-half',
  air_filter_clean: 'cloud', brake_check: 'hand-left', cables: 'git-branch',
  engine_oil: 'water', spark_plug: 'flash', carburetor: 'settings',
  chain_sprockets: 'cog', oil_filter: 'funnel', air_filter_replace: 'swap-vertical',
  valve_clearance: 'options', battery_test: 'pulse', brake_fluid_flush: 'beaker',
  clutch_plates: 'disc', suspension: 'resize', engine_overhaul: 'construct',
  transmission_oil: 'shuffle', wiring_harness: 'git-network',
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
  
  // Manual odometer input state
  const [showOdometerModal, setShowOdometerModal] = useState(false);
  const [manualOdometer, setManualOdometer] = useState('');
  const [savingOdometer, setSavingOdometer] = useState(false);

  // Maintenance schedule state
  const [maintenanceSchedule, setMaintenanceSchedule] = useState(FALLBACK_SCHEDULE);
  const [maintenanceStatusMap, setMaintenanceStatusMap] = useState({}); // { itemKey: { lastServiceKm, lastServiceDate } }
  const [markingDone, setMarkingDone] = useState(null); // itemKey currently being marked

  // Get tricycle ID (handle both id and _id)
  const tricycleId = selectedTricycle?._id || selectedTricycle?.id;

  // Fetch maintenance config from server
  const fetchMaintenanceConfig = useCallback(async () => {
    try {
      const token = await getToken(db);
      const res = await fetch(`${BACKEND}/api/maintenance/config`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const config = await res.json();
        const data = config.data || config;
        if (data.schedule && data.schedule.length > 0) {
          setMaintenanceSchedule(data.schedule);
        }
      }
    } catch (e) {
      console.warn('Error fetching maintenance config:', e);
    }
  }, [db]);

  // Fetch maintenance status for this tricycle
  const fetchMaintenanceStatus = useCallback(async () => {
    if (!tricycleId) return;
    try {
      const token = await getToken(db);
      const res = await fetch(`${BACKEND}/api/maintenance/tricycle/${tricycleId}/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const result = await res.json();
        if (result.data) {
          setMaintenanceStatusMap(result.data);
        }
      }
    } catch (e) {
      console.warn('Error fetching maintenance status:', e);
    }
  }, [tricycleId, db]);

  // Fetch fresh tricycle data when modal opens
  useEffect(() => {
    if (visible && tricycleId) {
      fetchTricycleData();
      fetchMaintenanceConfig();
      fetchMaintenanceStatus();
    }
    if (!visible) {
      setActiveTab('info');
      setTricycleData(null);
      setMaintenanceStatusMap({});
      setMarkingDone(null);
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

  // Get current tricycle ID for API calls
  const currentTricycleId = tricycle?._id || tricycle?.id || tricycleId;

  // Calculate parts status from schedule + maintenance status map
  const partsStatus = useMemo(() => {
    const status = {};
    maintenanceSchedule.forEach(group => {
      group.items.forEach(item => {
        const statusData = maintenanceStatusMap[item.key];
        const lastServiceKm = statusData?.lastServiceKm || 0;
        const lastServiceDate = statusData?.lastServiceDate || null;
        const diff = Math.max(0, currentOdometer - lastServiceKm);
        const kmProgress = Math.min(100, Math.round((diff / group.intervalKm) * 100));

        let timeProgress = 0;
        let daysRemaining = null;
        if (lastServiceDate && group.baselineDays) {
          const daysSince = Math.floor((Date.now() - new Date(lastServiceDate)) / (1000 * 60 * 60 * 24));
          timeProgress = Math.min(100, Math.round((daysSince / group.baselineDays) * 100));
          daysRemaining = group.baselineDays - daysSince;
        }

        const overallProgress = Math.max(kmProgress, timeProgress);
        status[item.key] = {
          progress: overallProgress,
          kmProgress,
          timeProgress,
          lastServiceKm,
          lastServiceDate,
          daysRemaining,
          intervalKm: group.intervalKm,
          baselineDays: group.baselineDays,
        };
      });
    });
    return status;
  }, [maintenanceSchedule, maintenanceStatusMap, currentOdometer]);

  // Count critical items
  const criticalCount = useMemo(() => {
    return Object.values(partsStatus).filter(p => p.progress >= 80).length;
  }, [partsStatus]);

  // Handle marking maintenance as done (uses proper maintenance log endpoint, auto-approved for operator)
  const handleMarkDone = (itemKey, itemName) => {
    if (!currentTricycleId) return;

    Alert.alert(
      'Mark as Serviced',
      `Are you sure you want to mark "${itemName}" as serviced at ${Math.round(currentOdometer)} km?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Mark Done',
          style: 'default',
          onPress: () => doMarkDone(itemKey, itemName),
        },
      ]
    );
  };

  const doMarkDone = async (itemKey, itemName) => {
    if (!currentTricycleId) return;
    setMarkingDone(itemKey);

    try {
      const token = await getToken(db);
      const res = await fetch(`${BACKEND}/api/maintenance/tricycle/${currentTricycleId}/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          itemKey,
          lastServiceKm: currentOdometer,
          status: 'completed',
          notes: 'Serviced by operator',
          completedAt: new Date().toISOString(),
        }),
      });

      const result = await res.json();
      if (res.ok && result.success) {
        Alert.alert('Done', `"${itemName}" has been marked as serviced.`);
        // Refresh data
        fetchTricycleData();
        fetchMaintenanceStatus();
        if (onTricycleUpdated) onTricycleUpdated();
      } else {
        Alert.alert('Error', result.message || 'Failed to record maintenance.');
      }
    } catch (error) {
      console.error('Error marking maintenance:', error);
      Alert.alert('Error', 'Failed to record maintenance. Please try again.');
    } finally {
      setMarkingDone(null);
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

  // ==================== MANUAL ODOMETER UPDATE ====================
  const openOdometerModal = () => {
    setManualOdometer(currentOdometer ? String(Math.round(currentOdometer)) : '');
    setShowOdometerModal(true);
  };

  const handleSaveOdometer = async () => {
    const newOdometer = parseFloat(manualOdometer);
    
    if (isNaN(newOdometer) || newOdometer < 0) {
      Alert.alert('Invalid Input', 'Please enter a valid odometer reading.');
      return;
    }
    
    // Block if odometer is being set lower than current (illegal)
    if (currentOdometer && newOdometer < currentOdometer) {
      Alert.alert(
        'Invalid Reading',
        `The new reading (${newOdometer} km) cannot be lower than the current reading (${Math.round(currentOdometer)} km). Odometer rollback is not allowed.`
      );
      return;
    }
    
    await saveOdometerReading(newOdometer);
  };

  const saveOdometerReading = async (newOdometer) => {
    if (!currentTricycleId) {
      Alert.alert('Error', 'No tricycle selected');
      return;
    }
    
    setSavingOdometer(true);
    
    try {
      const token = await getToken(db);
      const res = await fetch(`${BACKEND}/api/tricycles/${currentTricycleId}/odometer`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ odometer: newOdometer })
      });
      
      const data = await res.json();
      if (data.success) {
        Alert.alert('Success', `Odometer updated to ${Math.round(newOdometer)} km`);
        setShowOdometerModal(false);
        fetchTricycleData();
        // Notify parent to refresh
        if (onTricycleUpdated) {
          onTricycleUpdated();
        }
      } else {
        Alert.alert('Error', data.message || 'Failed to update odometer');
      }
    } catch (error) {
      console.error('Error updating odometer:', error);
      Alert.alert('Error', 'Failed to update odometer');
    } finally {
      setSavingOdometer(false);
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
        <TouchableOpacity 
          style={localStyles.odometerCard}
          onPress={openOdometerModal}
          activeOpacity={0.7}
        >
          <Ionicons name="speedometer" size={24} color={colors.primary} />
          <Text style={localStyles.odometerValue}>{Math.round(currentOdometer)}</Text>
          <Text style={localStyles.odometerUnit}>km</Text>
          <Ionicons name="create-outline" size={14} color={colors.primary} style={{ position: 'absolute', top: 4, right: 4 }} />
        </TouchableOpacity>
      </View>

      {/* Quick Stats */}
      <View style={localStyles.statsRow}>
        <View style={localStyles.statBox}>
          <Text style={localStyles.statValue}>{Object.keys(maintenanceStatusMap).length}</Text>
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
    return (
      <ScrollView 
        style={localStyles.tabContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              onRefresh();
              fetchMaintenanceStatus();
            }}
            colors={[colors.primary]}
          />
        }
      >
        {/* Odometer Display - Tap to Edit */}
        <TouchableOpacity 
          style={localStyles.odometerHeader}
          onPress={openOdometerModal}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <Text style={localStyles.odometerLabel}>Current Odometer</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: colors.primary, marginRight: 4 }}>Tap to edit</Text>
              <Ionicons name="create-outline" size={14} color={colors.primary} />
            </View>
          </View>
          <View style={localStyles.odometerDisplay}>
            <Ionicons name="speedometer" size={28} color={colors.primary} />
            <Text style={localStyles.odometerBig}>{Math.round(currentOdometer)}</Text>
            <Text style={localStyles.odometerKm}>km</Text>
          </View>
        </TouchableOpacity>

        {/* Quick Stats */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          <View style={[localStyles.statBox, criticalCount > 0 && localStyles.statBoxAlert, { flex: 1 }]}>
            <Text style={[localStyles.statValue, criticalCount > 0 && { color: '#EF4444' }]}>{criticalCount}</Text>
            <Text style={localStyles.statLabel}>Critical</Text>
          </View>
          <View style={[localStyles.statBox, { flex: 1 }]}>
            <Text style={localStyles.statValue}>
              {Object.values(partsStatus).filter(p => p.progress >= 60 && p.progress < 80).length}
            </Text>
            <Text style={localStyles.statLabel}>Approaching</Text>
          </View>
          <View style={[localStyles.statBox, { flex: 1 }]}>
            <Text style={[localStyles.statValue, { color: '#22C55E' }]}>
              {Object.values(partsStatus).filter(p => p.progress < 60).length}
            </Text>
            <Text style={localStyles.statLabel}>Good</Text>
          </View>
        </View>

        {/* Vehicle Diagnostic View */}
        <VehicleDiagnostic partsStatus={partsStatus} />

        {/* Schedule Groups */}
        <Text style={localStyles.scheduleTitle}>Maintenance Schedule</Text>
        <Text style={localStyles.scheduleHint}>
          <Ionicons name="information-circle-outline" size={12} color={colors.orangeShade5} />{' '}
          Tap the checkmark to mark an item as serviced
        </Text>

        {maintenanceSchedule.map((group) => {
          // Count critical in this group
          const groupCritical = group.items.filter(it => (partsStatus[it.key]?.progress || 0) >= 80).length;

          return (
            <View key={group.id} style={localStyles.scheduleGroup}>
              {/* Group Header */}
              <View style={localStyles.scheduleGroupHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={localStyles.scheduleGroupTitle}>{group.title}</Text>
                </View>
                <View style={localStyles.reminderBadge}>
                  <Ionicons name="notifications-outline" size={11} color={colors.primary} />
                  <Text style={localStyles.reminderBadgeText}>{group.reminderLabel}</Text>
                </View>
                {groupCritical > 0 && (
                  <View style={localStyles.groupCriticalBadge}>
                    <Text style={localStyles.groupCriticalBadgeText}>{groupCritical}</Text>
                  </View>
                )}
              </View>

              {/* Items in group */}
              {group.items.map((it) => {
                const status = partsStatus[it.key] || {};
                const kmProgress = status.kmProgress || 0;
                const timeProgress = status.timeProgress || 0;
                const overallProgress = status.progress || 0;
                const overallColor = getWearColor(overallProgress);
                const kmColor = getWearColor(kmProgress);
                const lastKm = status.lastServiceKm || 0;
                const dueKm = lastKm + group.intervalKm;
                const remainingKm = Math.max(0, dueKm - currentOdometer);
                const lastDate = status.lastServiceDate;
                const daysRemaining = status.daysRemaining;
                const isBeingMarked = markingDone === it.key;

                let timeColor = '#22C55E';
                if (timeProgress >= 100) timeColor = '#DC2626';
                else if (timeProgress >= 80) timeColor = '#F59E0B';
                else if (timeProgress >= 60) timeColor = '#FBBF24';

                return (
                  <View key={it.key} style={localStyles.scheduleCard}>
                    {/* Status indicator bar */}
                    <View style={[localStyles.scheduleStatusBar, { backgroundColor: overallColor }]} />

                    {/* Icon */}
                    <View style={[localStyles.scheduleIcon, { backgroundColor: overallColor + '18' }]}>
                      <Ionicons name={PART_ICONS[it.key] || 'build'} size={18} color={overallColor} />
                    </View>

                    {/* Info */}
                    <View style={localStyles.scheduleInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={localStyles.scheduleItemName}>{it.name}</Text>
                        <Text style={[localStyles.scheduleStatusLabel, { color: overallColor }]}>
                          {overallProgress < 30 ? '✓ Good' : overallProgress < 60 ? '⚠ Fair' : overallProgress < 80 ? '⚠ Worn' : '⛔ Critical'}
                        </Text>
                      </View>
                      <Text style={localStyles.scheduleItemNotes}>{it.notes}</Text>

                      {/* KM info */}
                      <Text style={localStyles.scheduleSmallText}>
                        <Ionicons name="speedometer-outline" size={11} color={colors.orangeShade5} />{' '}
                        Last: {lastKm} km · Next: {dueKm} km
                        {remainingKm > 0 ? ` · ${remainingKm} km left` : ' · Overdue!'}
                      </Text>

                      {/* Time info */}
                      {lastDate ? (
                        <Text style={[localStyles.scheduleSmallText, { color: timeColor }]}>
                          <Ionicons name="calendar-outline" size={11} color={timeColor} />{' '}
                          {new Date(lastDate).toLocaleDateString()}
                          {daysRemaining !== null && (
                            daysRemaining > 0
                              ? ` · ${daysRemaining}d until due`
                              : ` · ${Math.abs(daysRemaining)}d overdue!`
                          )}
                        </Text>
                      ) : (
                        <Text style={[localStyles.scheduleSmallText, { color: '#F59E0B' }]}>
                          <Ionicons name="alert-circle-outline" size={11} color="#F59E0B" /> No service date recorded
                        </Text>
                      )}

                      {/* KM Progress Bar */}
                      <View style={localStyles.progressSection}>
                        <Text style={localStyles.progressLabel}>KM</Text>
                        <View style={localStyles.progressBarSmall}>
                          <View style={[localStyles.progressFillSmall, { width: `${kmProgress}%`, backgroundColor: kmColor }]} />
                        </View>
                        <Text style={[localStyles.progressPercent, { color: kmColor }]}>{kmProgress}%</Text>
                      </View>

                      {/* Time Progress Bar */}
                      {group.baselineDays && (
                        <View style={localStyles.progressSection}>
                          <Text style={localStyles.progressLabel}>Time</Text>
                          <View style={localStyles.progressBarSmall}>
                            <View style={[localStyles.progressFillSmall, { width: `${timeProgress}%`, backgroundColor: timeColor }]} />
                          </View>
                          <Text style={[localStyles.progressPercent, { color: timeColor }]}>{timeProgress}%</Text>
                        </View>
                      )}
                    </View>

                    {/* Mark Done Button */}
                    <TouchableOpacity
                      style={[
                        localStyles.markDoneBtn,
                        overallProgress >= 80 && localStyles.markDoneBtnUrgent,
                        isBeingMarked && { opacity: 0.5 },
                      ]}
                      onPress={() => handleMarkDone(it.key, it.name)}
                      disabled={isBeingMarked}
                      activeOpacity={0.7}
                    >
                      {isBeingMarked ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <Ionicons name="checkmark-done" size={18} color={colors.white} />
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          );
        })}

        <View style={{ height: 30 }} />
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

      {/* Manual Odometer Input Modal */}
      <Modal visible={showOdometerModal} animationType="fade" transparent>
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.9)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}>
          <View style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 20,
            width: '100%',
            maxWidth: 340,
            elevation: 10,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
          }}>
            <View style={localStyles.pickerHeader}>
              <Ionicons name="speedometer" size={24} color={colors.primary} />
              <Text style={[localStyles.pickerTitle, { marginLeft: 8 }]}>Update Odometer</Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={() => setShowOdometerModal(false)}>
                <Ionicons name="close" size={24} color={colors.orangeShade6} />
              </TouchableOpacity>
            </View>
            <Text style={localStyles.pickerSubtitle}>
              Enter the current odometer reading from the tricycle's dashboard
            </Text>
            
            <View style={{ marginVertical: 16 }}>
              <Text style={{ fontSize: 12, color: colors.orangeShade5, marginBottom: 4 }}>
                Current Reading: {currentOdometer ? `${Math.round(currentOdometer)} km` : 'Not set'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  style={{
                    flex: 1,
                    backgroundColor: '#F9FAFB',
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 10,
                    borderWidth: 1.5,
                    borderColor: colors.orangeShade3,
                    fontSize: 20,
                    fontWeight: '700',
                    color: colors.orangeShade7,
                  }}
                  value={manualOdometer}
                  onChangeText={setManualOdometer}
                  keyboardType="numeric"
                  placeholder="Enter kilometers"
                  placeholderTextColor={colors.orangeShade4}
                  editable={!savingOdometer}
                />
                <Text style={{ marginLeft: 10, fontSize: 18, color: colors.orangeShade6, fontWeight: '700' }}>
                  km
                </Text>
              </View>
            </View>
            
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={[localStyles.pickerCancelBtn, { flex: 1, marginTop: 0 }]}
                onPress={() => setShowOdometerModal(false)}
                disabled={savingOdometer}
              >
                <Text style={localStyles.pickerCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: colors.primary,
                  paddingVertical: 14,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  opacity: savingOdometer ? 0.7 : 1,
                }}
                onPress={handleSaveOdometer}
                disabled={savingOdometer}
              >
                {savingOdometer ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color={colors.white} />
                    <Text style={{ color: colors.white, fontWeight: '700', fontSize: 15, marginLeft: 6 }}>
                      Save
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const localStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: screenHeight * 0.92,
    overflow: 'hidden',
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

  // Schedule group styles (driver-like layout)
  scheduleTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.orangeShade7,
    marginTop: 14,
    marginBottom: 4,
  },
  scheduleHint: {
    fontSize: 11,
    color: colors.orangeShade5,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  scheduleGroup: {
    marginBottom: 16,
  },
  scheduleGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  scheduleGroupTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.orangeShade7,
  },
  reminderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
    gap: 3,
  },
  reminderBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary,
  },
  groupCriticalBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    paddingHorizontal: 5,
  },
  groupCriticalBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFF',
  },
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    marginBottom: 8,
    padding: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  scheduleStatusBar: {
    width: 4,
    height: '100%',
    borderRadius: 2,
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  scheduleIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  scheduleInfo: {
    flex: 1,
    marginLeft: 10,
  },
  scheduleItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.orangeShade7,
    flex: 1,
  },
  scheduleStatusLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  scheduleItemNotes: {
    fontSize: 11,
    color: colors.orangeShade5,
    marginTop: 1,
    marginBottom: 4,
  },
  scheduleSmallText: {
    fontSize: 10,
    color: colors.orangeShade5,
    marginTop: 2,
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  progressLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.orangeShade5,
    width: 28,
  },
  progressBarSmall: {
    flex: 1,
    height: 5,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFillSmall: {
    height: '100%',
    borderRadius: 3,
  },
  progressPercent: {
    fontSize: 10,
    fontWeight: '700',
    width: 32,
    textAlign: 'right',
  },
  markDoneBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
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