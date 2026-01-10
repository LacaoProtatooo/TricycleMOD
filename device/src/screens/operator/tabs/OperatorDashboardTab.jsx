import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../../components/common/theme';
import MaintenanceTracker from '../../../components/home/MaintenanceTracker';
import VehicleDiagnostic from '../../../components/home/VehicleDiagnostic';
import PredictiveMaintenance from '../../../components/home/PredictiveMaintenance';
import LoadingScreen from '../../../components/common/LoadingScreen';
import EmptyState from '../../../components/common/EmptyState';

const { width: screenWidth } = Dimensions.get('window');

// Tricycle Card Component for horizontal list
const TricycleCard = ({ tricycle, isSelected, onSelect }) => {
  const driverName = tricycle.driver?.firstName 
    ? `${tricycle.driver.firstName} ${tricycle.driver.lastName || ''}`
    : tricycle.driverId?.firstName 
      ? `${tricycle.driverId.firstName} ${tricycle.driverId.lastName || ''}`
      : 'No Driver';
  
  const statusColor = tricycle.status === 'available' || tricycle.status === 'active' 
    ? colors.success 
    : colors.warning;

  return (
    <TouchableOpacity
      style={[
        localStyles.tricycleCard,
        isSelected && localStyles.selectedCard
      ]}
      onPress={() => onSelect(tricycle)}
      activeOpacity={0.7}
    >
      <View style={[localStyles.statusDot, { backgroundColor: statusColor }]} />
      <Ionicons 
        name="bicycle" 
        size={28} 
        color={isSelected ? colors.primary : colors.orangeShade5} 
      />
      <Text style={[localStyles.plateText, isSelected && localStyles.selectedText]}>
        {tricycle.plateNumber}
      </Text>
      <Text style={localStyles.modelText} numberOfLines={1}>
        {tricycle.model || 'Unknown'}
      </Text>
      <Text style={localStyles.driverText} numberOfLines={1}>
        {driverName}
      </Text>
      {isSelected && (
        <View style={localStyles.selectedIndicator}>
          <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
        </View>
      )}
    </TouchableOpacity>
  );
};

// Tab Button Component
const TabButton = ({ label, icon, isActive, onPress }) => (
  <TouchableOpacity
    style={[localStyles.tabButton, isActive && localStyles.activeTabButton]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Ionicons 
      name={icon} 
      size={18} 
      color={isActive ? colors.white : colors.orangeShade5} 
    />
    <Text style={[localStyles.tabButtonText, isActive && localStyles.activeTabButtonText]}>
      {label}
    </Text>
  </TouchableOpacity>
);

export default function OperatorDashboardTab({
  loading,
  refreshing,
  tricycles,
  onRefresh,
}) {
  const [selectedTricycle, setSelectedTricycle] = useState(null);
  const [activeView, setActiveView] = useState('maintenance'); // 'maintenance' | 'diagnostic' | 'predictive'

  // Auto-select first tricycle if none selected
  React.useEffect(() => {
    if (tricycles.length > 0 && !selectedTricycle) {
      setSelectedTricycle(tricycles[0]);
    }
    // Update selected tricycle data if tricycles list updates
    if (selectedTricycle) {
      const updated = tricycles.find(t => t._id === selectedTricycle._id);
      if (updated) {
        setSelectedTricycle(updated);
      }
    }
  }, [tricycles]);

  // Calculate parts status for VehicleDiagnostic
  const partsStatus = useMemo(() => {
    if (!selectedTricycle?.maintenanceHistory) return {};
    
    const status = {};
    const currentKm = selectedTricycle.currentOdometer || 0;
    
    // Default maintenance intervals
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

    // Calculate progress for each part
    Object.keys(intervals).forEach(key => {
      const history = selectedTricycle.maintenanceHistory.find(h => h.itemKey === key);
      const lastServiceKm = history?.lastServiceKm || 0;
      const diff = Math.max(0, currentKm - lastServiceKm);
      const progress = Math.min(100, Math.round((diff / intervals[key]) * 100));
      status[key] = { progress, lastServiceKm };
    });

    return status;
  }, [selectedTricycle]);

  // Get wear patterns for predictive maintenance
  const wearPatterns = useMemo(() => {
    if (!selectedTricycle?.maintenanceHistory) return {};
    
    const patterns = {};
    selectedTricycle.maintenanceHistory.forEach(log => {
      if (!patterns[log.itemKey]) {
        patterns[log.itemKey] = [];
      }
      patterns[log.itemKey].push({
        km: log.lastServiceKm,
        wearLevel: log.wearLevel || 50,
        date: log.date
      });
    });
    
    return patterns;
  }, [selectedTricycle]);

  if (loading) {
    return <LoadingScreen message="Loading tricycles..." />;
  }

  if (tricycles.length === 0) {
    return (
      <EmptyState
        icon="bicycle"
        title="No Tricycles"
        message="You haven't added any tricycles yet. Add your first tricycle to start tracking maintenance."
      />
    );
  }

  const renderContent = () => {
    if (!selectedTricycle) {
      return (
        <View style={localStyles.selectPrompt}>
          <Ionicons name="hand-left" size={48} color={colors.orangeShade5} />
          <Text style={localStyles.selectPromptText}>
            Select a tricycle above to view details
          </Text>
        </View>
      );
    }

    switch (activeView) {
      case 'diagnostic':
        return (
          <ScrollView 
            style={localStyles.contentScroll}
            showsVerticalScrollIndicator={false}
          >
            <VehicleDiagnostic partsStatus={partsStatus} />
          </ScrollView>
        );
      
      case 'predictive':
        return (
          <ScrollView 
            style={localStyles.contentScroll}
            showsVerticalScrollIndicator={false}
          >
            <PredictiveMaintenance
              tricycleId={selectedTricycle._id}
              currentOdometer={selectedTricycle.currentOdometer || 0}
              maintenanceData={partsStatus}
              wearPatterns={wearPatterns}
            />
          </ScrollView>
        );
      
      case 'maintenance':
      default:
        return (
          <ScrollView 
            style={localStyles.contentScroll}
            showsVerticalScrollIndicator={false}
          >
            <MaintenanceTracker
              tricycleId={selectedTricycle._id}
              serverHistory={selectedTricycle.maintenanceHistory || []}
            />
          </ScrollView>
        );
    }
  };

  return (
    <View style={localStyles.container}>
      {/* Header */}
      <View style={localStyles.header}>
        <Text style={localStyles.headerTitle}>Fleet Dashboard</Text>
        <Text style={localStyles.headerSubtitle}>
          {tricycles.length} tricycle{tricycles.length !== 1 ? 's' : ''} in fleet
        </Text>
      </View>

      {/* Horizontal Tricycle List */}
      <View style={localStyles.tricycleListContainer}>
        <Text style={localStyles.sectionTitle}>Select Tricycle</Text>
        <FlatList
          data={tricycles}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <TricycleCard
              tricycle={item}
              isSelected={selectedTricycle?._id === item._id}
              onSelect={setSelectedTricycle}
            />
          )}
          contentContainerStyle={localStyles.tricycleList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        />
      </View>

      {/* Selected Tricycle Info */}
      {selectedTricycle && (
        <View style={localStyles.selectedInfo}>
          <View style={localStyles.selectedHeader}>
            <Ionicons name="bicycle" size={24} color={colors.primary} />
            <View style={localStyles.selectedDetails}>
              <Text style={localStyles.selectedPlate}>{selectedTricycle.plateNumber}</Text>
              <Text style={localStyles.selectedModel}>{selectedTricycle.model}</Text>
            </View>
            <View style={localStyles.odometerBadge}>
              <Ionicons name="speedometer-outline" size={14} color={colors.orangeShade5} />
              <Text style={localStyles.odometerText}>
                {Math.round(selectedTricycle.currentOdometer || 0)} km
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Tab Buttons */}
      <View style={localStyles.tabContainer}>
        <TabButton
          label="Maintenance"
          icon="build"
          isActive={activeView === 'maintenance'}
          onPress={() => setActiveView('maintenance')}
        />
        <TabButton
          label="Diagnostic"
          icon="pulse"
          isActive={activeView === 'diagnostic'}
          onPress={() => setActiveView('diagnostic')}
        />
        <TabButton
          label="Predictions"
          icon="analytics"
          isActive={activeView === 'predictive'}
          onPress={() => setActiveView('predictive')}
        />
      </View>

      {/* Content Area */}
      <View style={localStyles.contentContainer}>
        {renderContent()}
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.white,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.orangeShade5,
    marginTop: 4,
  },
  tricycleListContainer: {
    paddingTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.orangeShade5,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  tricycleList: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  tricycleCard: {
    width: 100,
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: spacing.sm,
    marginRight: spacing.sm,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  selectedCard: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '15',
  },
  statusDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  plateText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.white,
    marginTop: spacing.xs,
  },
  selectedText: {
    color: colors.primary,
  },
  modelText: {
    fontSize: 10,
    color: colors.orangeShade5,
    marginTop: 2,
  },
  driverText: {
    fontSize: 9,
    color: colors.orangeShade4,
    marginTop: 2,
  },
  selectedIndicator: {
    position: 'absolute',
    top: -6,
    left: -6,
    backgroundColor: colors.cardBackground,
    borderRadius: 10,
  },
  selectedInfo: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: spacing.md,
  },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedDetails: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  selectedPlate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.white,
  },
  selectedModel: {
    fontSize: 12,
    color: colors.orangeShade5,
  },
  odometerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  odometerText: {
    fontSize: 12,
    color: colors.orangeShade5,
    marginLeft: 4,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 10,
    gap: 6,
  },
  activeTabButton: {
    backgroundColor: colors.primary,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.orangeShade5,
  },
  activeTabButtonText: {
    color: colors.white,
  },
  contentContainer: {
    flex: 1,
    marginTop: spacing.md,
  },
  contentScroll: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  selectPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  selectPromptText: {
    fontSize: 16,
    color: colors.orangeShade5,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
