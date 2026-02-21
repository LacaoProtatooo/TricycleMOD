import React, { useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  FlatList, 
  RefreshControl,
  ScrollView,
  StyleSheet,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../../components/common/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import TricycleListItem from '../TricycleListItem';
import ErrorDisplay from '../../../components/common/ErrorDisplay';
import EmptyState from '../../../components/common/EmptyState';
import LoadingScreen from '../../../components/common/LoadingScreen';
import WeatherWidget from '../../../components/home/WeatherWidget';
import styles from '../operatorStyles';

const { width: screenWidth } = Dimensions.get('window');

// Day abbreviations mapping
const DAY_ABBREVS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Check if a driver has a schedule for today
const isDriverScheduledToday = (tricycle) => {
  const today = DAY_ABBREVS[new Date().getDay()];
  if (tricycle.schedules && tricycle.schedules.length > 0) {
    return tricycle.schedules.some(sch => sch.days && sch.days.includes(today));
  }
  return true;
};

// Check if tricycle is effectively available today (no driver scheduled)
const isTricycleAvailableToday = (tricycle) => {
  const hasDriver = tricycle.driverId || tricycle.driver;
  if (!hasDriver) return true; // no driver = unassigned = available
  if (tricycle.schedules && tricycle.schedules.length > 0) {
    return !isDriverScheduledToday(tricycle);
  }
  return false;
};

// Stats Card Component
const StatCard = ({ icon, label, value, color, onPress, isActive }) => (
  <TouchableOpacity 
    style={[
      localStyles.statCard, 
      isActive && { borderColor: color, borderWidth: 2 }
    ]} 
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={[localStyles.statIconWrap, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <Text style={localStyles.statValue}>{value}</Text>
    <Text style={localStyles.statLabel}>{label}</Text>
  </TouchableOpacity>
);

// Alert Card Component
const AlertCard = ({ icon, title, count, color, onPress }) => (
  <TouchableOpacity style={[localStyles.alertCard, { borderLeftColor: color }]} onPress={onPress}>
    <Ionicons name={icon} size={24} color={color} />
    <View style={localStyles.alertInfo}>
      <Text style={localStyles.alertTitle}>{title}</Text>
      <Text style={[localStyles.alertCount, { color }]}>{count} tricycle(s)</Text>
    </View>
    <Ionicons name="chevron-forward" size={20} color={colors.orangeShade5} />
  </TouchableOpacity>
);

export default function OverviewTab({
  loading,
  refreshing,
  error,
  tricycles,
  onRefresh,
  onAddTricycle,
  onOpenAssignModal,
  onUnassignDriver,
  onOpenMessage,
  onOpenMaintenance,
  onOpenDetails
}) {
  const [activeFilter, setActiveFilter] = useState('all');

  // Calculate statistics
  const stats = useMemo(() => {
    const total = tricycles.length;
    const assigned = tricycles.filter(t => t.driverId || t.driver).length;
    const unassigned = tricycles.filter(t => !t.driverId && !t.driver).length;
    // Tricycles that have a driver but no schedule today (effectively available)
    const availableToday = tricycles.filter(t => {
      const hasDriver = t.driverId || t.driver;
      return hasDriver && isTricycleAvailableToday(t);
    }).length;
    
    // Check maintenance status
    const needsMaintenance = tricycles.filter(t => {
      if (!t.maintenanceHistory || t.maintenanceHistory.length === 0) return false;
      const currentKm = t.currentOdometer || 0;
      return t.maintenanceHistory.some(item => {
        const lastKm = item.lastServiceKm || 0;
        const intervalKm = getIntervalForItem(item.itemKey);
        const progress = Math.min(100, Math.round(((currentKm - lastKm) / intervalKm) * 100));
        return progress >= 80;
      });
    }).length;

    return { total, assigned, unassigned, availableToday, needsMaintenance };
  }, [tricycles]);

  // Filter tricycles based on active filter
  const filteredTricycles = useMemo(() => {
    switch (activeFilter) {
      case 'assigned':
        return tricycles.filter(t => t.driverId || t.driver);
      case 'unassigned':
        return tricycles.filter(t => !t.driverId && !t.driver);
      case 'availableToday':
        return tricycles.filter(t => {
          const hasDriver = t.driverId || t.driver;
          return hasDriver && isTricycleAvailableToday(t);
        });
      case 'maintenance':
        return tricycles.filter(t => {
          if (!t.maintenanceHistory || t.maintenanceHistory.length === 0) return false;
          const currentKm = t.currentOdometer || 0;
          return t.maintenanceHistory.some(item => {
            const lastKm = item.lastServiceKm || 0;
            const intervalKm = getIntervalForItem(item.itemKey);
            const progress = Math.min(100, Math.round(((currentKm - lastKm) / intervalKm) * 100));
            return progress >= 80;
          });
        });
      default:
        return tricycles;
    }
  }, [tricycles, activeFilter]);

  if (loading && !refreshing) return <LoadingScreen />;
  
  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={filteredTricycles}
        keyExtractor={(item) => item.id || item._id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTop}>
                <View>
                  <Text style={styles.title}>Tricycle Overview</Text>
                  <Text style={styles.subtitle}>Manage your tricycles and drivers</Text>
                </View>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={onAddTricycle}
                >
                  <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {error && <ErrorDisplay error={error} onRetry={onRefresh} />}

            {/* Weather Widget */}
            <View style={localStyles.weatherContainer}>
              <WeatherWidget />
            </View>

            {/* Stats Cards (fill width) */}
            <View style={localStyles.statsRow}>
              <StatCard 
                icon="car-sport" 
                label="Total" 
                value={stats.total}
                color="#3B82F6"
                onPress={() => setActiveFilter('all')}
                isActive={activeFilter === 'all'}
              />
              <StatCard 
                icon="person" 
                label="Assigned" 
                value={stats.assigned}
                color="#8B5CF6"
                onPress={() => setActiveFilter('assigned')}
                isActive={activeFilter === 'assigned'}
              />
              <StatCard 
                icon="person-outline" 
                label="Unassigned" 
                value={stats.unassigned}
                color="#F59E0B"
                onPress={() => setActiveFilter('unassigned')}
                isActive={activeFilter === 'unassigned'}
              />
              {stats.availableToday > 0 && (
                <StatCard 
                  icon="calendar-outline" 
                  label="Free Today" 
                  value={stats.availableToday}
                  color="#22C55E"
                  onPress={() => setActiveFilter('availableToday')}
                  isActive={activeFilter === 'availableToday'}
                />
              )}
            </View>

            {/* Maintenance Alert */}
            {stats.needsMaintenance > 0 && (
              <AlertCard
                icon="warning"
                title="Maintenance Required"
                count={stats.needsMaintenance}
                color="#EF4444"
                onPress={() => setActiveFilter('maintenance')}
              />
            )}

            {/* Filter indicator */}
            {activeFilter !== 'all' && (
              <View style={localStyles.filterIndicator}>
                <Text style={localStyles.filterText}>
                  Showing: {activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)} ({filteredTricycles.length})
                </Text>
                <TouchableOpacity onPress={() => setActiveFilter('all')}>
                  <Text style={localStyles.clearFilter}>Clear filter</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Section Header */}
            <View style={localStyles.sectionHeader}>
              <Text style={localStyles.sectionTitle}>Your Fleet</Text>
              <Text style={localStyles.sectionCount}>{filteredTricycles.length} tricycle(s)</Text>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <TricycleListItem
            tricycle={item}
            onAssign={onOpenAssignModal}
            onUnassign={onUnassignDriver}
            onMessage={onOpenMessage}
            onMaintenance={onOpenMaintenance}
            onDetails={onOpenDetails}
          />
        )}
        ListEmptyComponent={
          !loading && (
            <EmptyState
              icon="car-outline"
              title={activeFilter === 'all' ? "No tricycles yet" : `No ${activeFilter} tricycles`}
              subtitle={activeFilter === 'all' ? "Tap the + button to add a tricycle" : "Try a different filter"}
            />
          )
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </SafeAreaView>
  );
}

// Helper function to get interval for maintenance items
const getIntervalForItem = (itemKey) => {
  const intervals = {
    tire_pressure: 500,
    chain: 500,
    battery_water: 500,
    air_filter_clean: 500,
    brake_check: 500,
    cables: 500,
    engine_oil: 1000,
    spark_plug: 1000,
    carburetor: 1000,
    chain_sprockets: 1000,
    oil_filter: 4000,
    air_filter_replace: 4000,
    valve_clearance: 4000,
    battery_test: 4000,
    brake_fluid_flush: 11000,
    clutch_plates: 11000,
    suspension: 11000,
    engine_overhaul: 20000,
    transmission_oil: 20000,
    wiring_harness: 20000,
  };
  return intervals[itemKey] || 5000;
};

const localStyles = StyleSheet.create({
  weatherContainer: {
    paddingHorizontal: spacing.medium,
    paddingTop: spacing.small,
    paddingBottom: spacing.small,
  },
  statsContainer: {
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    gap: 10,
  },
  statCard: {
    backgroundColor: colors.ivory1,
    borderRadius: 12,
    paddingVertical: spacing.medium,
    paddingHorizontal: 6,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: colors.ivory3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    minWidth: 0,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.orangeShade7,
  },
  statLabel: {
    fontSize: 10,
    color: colors.orangeShade5,
    marginTop: 2,
    textAlign: 'center',
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    marginHorizontal: spacing.medium,
    marginVertical: spacing.small,
    padding: spacing.medium,
    borderRadius: 10,
    borderLeftWidth: 4,
  },
  alertInfo: {
    flex: 1,
    marginLeft: spacing.small,
  },
  alertTitle: {
    fontWeight: '600',
    color: colors.orangeShade7,
    fontSize: 14,
  },
  alertCount: {
    fontSize: 12,
    marginTop: 2,
  },
  filterIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: spacing.medium,
    marginTop: spacing.small,
    padding: spacing.small,
    backgroundColor: colors.ivory2,
    borderRadius: 8,
  },
  filterText: {
    color: colors.orangeShade6,
    fontSize: 13,
    fontWeight: '500',
  },
  clearFilter: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.medium,
    paddingTop: spacing.medium,
    paddingBottom: spacing.small,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.orangeShade7,
  },
  sectionCount: {
    fontSize: 12,
    color: colors.orangeShade5,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.small,
  },
});