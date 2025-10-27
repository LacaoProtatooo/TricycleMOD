import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../common/theme';

export default function StatCard({ icon, bgColor = colors.primary, value, label }) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: colors.ivory4,
      borderRadius: 12,
      padding: spacing.medium,
      marginHorizontal: spacing.small / 2,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.ivory3,
      shadowColor: colors.orangeShade8,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    }}>
      <View style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: bgColor,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.small,
      }}>
        <Ionicons name={icon} size={24} color={colors.ivory1} />
      </View>
      <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.orangeShade7, marginBottom: 4 }}>
        {value}
      </Text>
      <Text style={{ fontSize: 14, color: colors.orangeShade5 }}>{label}</Text>
    </View>
  );
}