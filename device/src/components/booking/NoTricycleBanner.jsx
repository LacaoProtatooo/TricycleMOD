/**
 * NoTricycleBanner.jsx - Warning banner when no tricycle is assigned
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { spacing } from '../common/theme';

const NoTricycleBanner = ({ visible }) => {
  if (!visible) return null;

  return (
    <View style={styles.banner}>
      <Ionicons name="warning" size={20} color="#fff" />
      <View style={styles.textContainer}>
        <Text style={styles.title}>No Tricycle Assigned</Text>
        <Text style={styles.message}>
          Contact your operator to assign a tricycle before accepting trips.
        </Text>
      </View>
    </View>
  );
};

export default NoTricycleBanner;

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#ffc107',
    padding: spacing.medium,
    flexDirection: 'row',
    alignItems: 'center',
  },
  textContainer: {
    marginLeft: 10,
    flex: 1,
  },
  title: {
    color: '#212529',
    fontSize: 14,
    fontWeight: 'bold',
  },
  message: {
    color: '#212529',
    fontSize: 12,
    opacity: 0.9,
    marginTop: 2,
  },
});
