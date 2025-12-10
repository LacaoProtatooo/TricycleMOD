import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../components/common/theme';
import styles from './operatorStyles';

export default function EmptyState({ icon, title, subtitle }) {
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name={icon} size={64} color={colors.orangeShade5} />
      <Text style={styles.emptyText}>{title}</Text>
      <Text style={styles.emptySubtext}>{subtitle}</Text>
    </View>
  );
}