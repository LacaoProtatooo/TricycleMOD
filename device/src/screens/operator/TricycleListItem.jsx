import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import styles from './operatorStyles';
import { colors, spacing } from '../../components/common/theme';

// Tricycle logo
const TricycleLogo = require('../../../assets/webttrac_logo_bgrm.png');

// Helper function to get interval for maintenance items
const getIntervalForItem = (itemKey) => {
  const intervals = {
    tire_pressure: 500, chain: 500, battery_water: 500, air_filter_clean: 500,
    brake_check: 500, cables: 500, engine_oil: 1000, spark_plug: 1000,
    carburetor: 1000, chain_sprockets: 1000, oil_filter: 4000,
    air_filter_replace: 4000, valve_clearance: 4000, battery_test: 4000,
    brake_fluid_flush: 11000, clutch_plates: 11000, suspension: 11000,
    engine_overhaul: 20000, transmission_oil: 20000, wiring_harness: 20000,
  };
  return intervals[itemKey] || 5000;
};

// Get maintenance health status
const getMaintenanceHealth = (tricycle) => {
  if (!tricycle.maintenanceHistory || tricycle.maintenanceHistory.length === 0) {
    return { status: 'unknown', color: '#9CA3AF', icon: 'help-circle' };
  }
  
  const currentKm = tricycle.currentOdometer || 0;
  let worstProgress = 0;
  
  tricycle.maintenanceHistory.forEach(item => {
    const lastKm = item.lastServiceKm || 0;
    const intervalKm = getIntervalForItem(item.itemKey);
    const progress = Math.min(100, Math.round(((currentKm - lastKm) / intervalKm) * 100));
    if (progress > worstProgress) worstProgress = progress;
  });
  
  if (worstProgress >= 80) return { status: 'critical', color: '#EF4444', icon: 'warning' };
  if (worstProgress >= 60) return { status: 'worn', color: '#F59E0B', icon: 'alert-circle' };
  if (worstProgress >= 30) return { status: 'fair', color: '#84CC16', icon: 'checkmark-circle' };
  return { status: 'good', color: '#22C55E', icon: 'checkmark-circle' };
};

export default function TricycleListItem({
  tricycle,
  onAssign,
  onUnassign,
  onMessage,
  onMaintenance,
  onDetails
}) {
  const driverName = tricycle.driverName || 
    (tricycle.driver ? `${tricycle.driver.firstname} ${tricycle.driver.lastname}` : 'Unassigned');
  const hasDriver = tricycle.driverId || tricycle.driver;
  
  // Calculate maintenance health
  const maintenanceHealth = useMemo(() => getMaintenanceHealth(tricycle), [tricycle]);
  
  // Get status color
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'available':
      case 'active':
        return '#22C55E';
      case 'unavailable':
      case 'inactive':
        return '#EF4444';
      case 'maintenance':
        return '#F59E0B';
      default:
        return '#9CA3AF';
    }
  };

  return (
    <View style={styles.itemWrap}>
      <TouchableOpacity 
        style={styles.item} 
        onPress={() => onDetails(tricycle)}
      >
        {/* Status indicator strip */}
        <View style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          backgroundColor: getStatusColor(tricycle.status),
          borderTopLeftRadius: 10,
          borderBottomLeftRadius: 10,
        }} />
        
        <View style={[styles.iconWrap, { marginLeft: 8, backgroundColor: '#fff' }]}>
          <Image 
            source={TricycleLogo} 
            style={{ width: 36, height: 36 }} 
            resizeMode="contain"
          />
        </View>
        <View style={styles.info}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.plate}>{tricycle.plate || tricycle.plateNumber}</Text>
            {/* Maintenance health indicator */}
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              backgroundColor: maintenanceHealth.color + '20',
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 10,
            }}>
              <Ionicons name={maintenanceHealth.icon} size={12} color={maintenanceHealth.color} />
              <Text style={{ 
                fontSize: 10, 
                color: maintenanceHealth.color, 
                marginLeft: 3,
                fontWeight: '600',
                textTransform: 'capitalize'
              }}>
                {maintenanceHealth.status}
              </Text>
            </View>
          </View>
          {!!tricycle.bodyNumber && (
            <Text style={styles.meta}>Body No.: {tricycle.bodyNumber}</Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Ionicons 
              name={hasDriver ? "person" : "person-outline"} 
              size={12} 
              color={hasDriver ? colors.primary : colors.orangeShade5} 
            />
            <Text style={[styles.driver, { marginLeft: 4, marginTop: 0 }]}>{driverName}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ 
                width: 8, 
                height: 8, 
                borderRadius: 4, 
                backgroundColor: getStatusColor(tricycle.status),
                marginRight: 4 
              }} />
              <Text style={styles.meta}>{tricycle.status || 'unavailable'}</Text>
            </View>
            <Text style={styles.meta}>•</Text>
            <Text style={styles.meta}>{tricycle.model || 'N/A'}</Text>
            {tricycle.currentOdometer > 0 && (
              <>
                <Text style={styles.meta}>•</Text>
                <Text style={styles.meta}>{Math.round(tricycle.currentOdometer)} km</Text>
              </>
            )}
          </View>
        </View>
        <View style={styles.right}>
          <Ionicons name="chevron-forward" size={20} color={colors.orangeShade5} />
        </View>
      </TouchableOpacity>

      <View style={styles.actionsRow}>
        {hasDriver ? (
          <>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.assignBtn]} 
              onPress={() => onAssign(tricycle)}
            >
              <Ionicons name="person-outline" size={16} color="#fff" />
              <Text style={styles.actionBtnText}>Change</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.unassignBtn]} 
              onPress={() => onUnassign(tricycle)}
            >
              <Ionicons name="person-remove-outline" size={16} color="#fff" />
              <Text style={styles.actionBtnText}>Unassign</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity 
            style={[styles.actionBtn, styles.assignBtn]} 
            onPress={() => onAssign(tricycle)}
          >
            <Ionicons name="person-add-outline" size={16} color="#fff" />
            <Text style={styles.actionBtnText}>Assign</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={[styles.actionBtn, styles.messageBtn]} 
          onPress={() => onMessage(tricycle)}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={16} color="#fff" />
          <Text style={styles.actionBtnText}>Message</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[
            styles.actionBtn, 
            { backgroundColor: maintenanceHealth.status === 'critical' ? '#EF4444' : '#17a2b8' }
          ]} 
          onPress={() => onMaintenance(tricycle)}
        >
          <Ionicons 
            name={maintenanceHealth.status === 'critical' ? "warning" : "build-outline"} 
            size={16} 
            color="#fff" 
          />
          <Text style={styles.actionBtnText}>
            {maintenanceHealth.status === 'critical' ? 'Urgent!' : 'Logs'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}