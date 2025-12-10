import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from './theme';

export default function EmptyState({ icon, title, subtitle }) {
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name={icon} size={64} color={colors.orangeShade5} />
      <Text style={styles.emptyText}>{title}</Text>
      <Text style={styles.emptySubtext}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.large,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.orangeShade7,
    marginTop: spacing.medium,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.orangeShade5,
    marginTop: spacing.small,
    textAlign: 'center',
  },
});