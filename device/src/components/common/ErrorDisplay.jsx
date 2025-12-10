import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing } from './theme';

export default function ErrorDisplay({ error, onRetry }) {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity onPress={onRetry} style={styles.retryButton}>
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    padding: spacing.medium,
    backgroundColor: '#fee',
    marginHorizontal: spacing.medium,
    borderRadius: 8,
    marginBottom: spacing.small,
  },
  errorText: { 
    color: '#c00', 
    marginBottom: 8 
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  retryButtonText: { 
    color: '#fff', 
    fontWeight: '600' 
  },
});