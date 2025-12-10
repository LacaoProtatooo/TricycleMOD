import React from 'react';
import { View, Text, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../components/common/theme';
import styles from './operatorStyles';

export default function DriverListItem({ driver }) {
  return (
    <View style={styles.driverItem}>
      <View style={styles.driverAvatar}>
        {driver.image?.url ? (
          <Image source={{ uri: driver.image.url }} style={styles.driverAvatarImage} />
        ) : (
          <Ionicons name="person" size={32} color={colors.orangeShade5} />
        )}
      </View>
      <View style={styles.driverInfo}>
        <Text style={styles.driverName}>
          {driver.firstname} {driver.lastname}
        </Text>
        <Text style={styles.driverUsername}>@{driver.username}</Text>
        {driver.rating > 0 && (
          <Text style={styles.driverRating}>
            ⭐ {driver.rating.toFixed(1)} ({driver.numReviews} reviews)
          </Text>
        )}
      </View>
    </View>
  );
}