/**
 * OfflineState.jsx - Empty state view when driver is offline
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors, spacing } from '../common/theme';

const OfflineState = ({ onGoOnline, disabled = false }) => {
  return (
    <View style={styles.container}>
      <Ionicons name="cloud-offline-outline" size={80} color="#bbb" />
      <Text style={styles.title}>You're Offline</Text>
      <Text style={styles.subtitle}>
        Go online to start receiving booking requests from nearby passengers.
      </Text>
      <TouchableOpacity 
        style={[styles.goOnlineBtn, disabled && styles.btnDisabled]} 
        onPress={onGoOnline}
        disabled={disabled}
      >
        <Ionicons name="wifi" size={20} color="#fff" />
        <Text style={styles.goOnlineBtnText}>Go Online</Text>
      </TouchableOpacity>
    </View>
  );
};

export default OfflineState;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.large * 2,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: spacing.large,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: spacing.small,
    lineHeight: 20,
  },
  goOnlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#28a745',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: spacing.large,
  },
  goOnlineBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  btnDisabled: {
    backgroundColor: '#ccc',
  },
});
