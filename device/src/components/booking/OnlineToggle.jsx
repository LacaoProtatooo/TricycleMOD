/**
 * OnlineToggle.jsx - Driver online/offline toggle button
 */

import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { colors } from '../common/theme';

const OnlineToggle = ({ 
  isOnline, 
  onToggle, 
  disabled = false,
  size = 'normal' // 'normal' or 'large'
}) => {
  const isLarge = size === 'large';

  return (
    <TouchableOpacity
      style={[
        styles.toggle,
        isLarge && styles.toggleLarge,
        isOnline && styles.toggleActive,
        disabled && styles.toggleDisabled,
      ]}
      onPress={onToggle}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View 
        style={[
          styles.indicator, 
          isLarge && styles.indicatorLarge,
          isOnline && styles.indicatorActive,
        ]} 
      />
      <Text 
        style={[
          styles.label, 
          isLarge && styles.labelLarge,
          isOnline && styles.labelActive,
        ]}
      >
        {isOnline ? 'Online' : 'Offline'}
      </Text>
    </TouchableOpacity>
  );
};

export default OnlineToggle;

const styles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  toggleLarge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
  },
  toggleActive: {
    backgroundColor: '#28a745',
    borderColor: '#28a745',
  },
  toggleDisabled: {
    backgroundColor: '#e9ecef',
    borderColor: '#e9ecef',
    opacity: 0.6,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#999',
    marginRight: 6,
  },
  indicatorLarge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  indicatorActive: {
    backgroundColor: '#fff',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  labelLarge: {
    fontSize: 14,
  },
  labelActive: {
    color: '#fff',
  },
});
