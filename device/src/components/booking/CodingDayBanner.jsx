/**
 * CodingDayBanner.jsx - Warning banner for coding day restriction
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors, spacing } from '../common/theme';
import { getCodingDayName } from '../../utils/codingDayUtils';

const CodingDayBanner = ({ codingDayStatus, assignedTricycle }) => {
  if (!codingDayStatus?.isCodingDay) return null;

  return (
    <View style={styles.banner}>
      <Ionicons name="ban" size={20} color="#fff" />
      <View style={styles.textContainer}>
        <Text style={styles.title}>Coding Day - Cannot Accept Trips</Text>
        <Text style={styles.message}>
          Your tricycle is on coding today ({getCodingDayName(assignedTricycle?.codingDay)}).
        </Text>
      </View>
    </View>
  );
};

export default CodingDayBanner;

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#dc3545',
    padding: spacing.medium,
    flexDirection: 'row',
    alignItems: 'center',
  },
  textContainer: {
    marginLeft: 10,
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  message: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.9,
    marginTop: 2,
  },
});
