import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import styles from './operatorStyles';

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

  return (
    <View style={styles.itemWrap}>
      <TouchableOpacity 
        style={styles.item} 
        onPress={() => onDetails(tricycle)}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="car-sport-outline" size={28} color="#fff" />
        </View>
        <View style={styles.info}>
          <Text style={styles.plate}>{tricycle.plate || tricycle.plateNumber}</Text>
          {!!tricycle.bodyNumber && (
            <Text style={styles.meta}>Body No.: {tricycle.bodyNumber}</Text>
          )}
          <Text style={styles.driver}>{driverName}</Text>
          <Text style={styles.meta}>
            {tricycle.status || 'unavailable'} • Model: {tricycle.model || 'N/A'}
          </Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.chev}>{'>'}</Text>
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
              <Text style={styles.actionBtnText}>Change Driver</Text>
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
            <Text style={styles.actionBtnText}>Assign Driver</Text>
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
          style={[styles.actionBtn, { backgroundColor: '#17a2b8' }]} 
          onPress={() => onMaintenance(tricycle)}
        >
          <Ionicons name="build-outline" size={16} color="#fff" />
          <Text style={styles.actionBtnText}>Logs</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}