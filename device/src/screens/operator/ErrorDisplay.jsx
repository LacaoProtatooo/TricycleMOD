import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { colors, spacing } from '../../components/common/theme';
import styles from './operatorStyles';

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