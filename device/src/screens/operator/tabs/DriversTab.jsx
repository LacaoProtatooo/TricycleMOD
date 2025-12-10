import React from 'react';
import { View, Text, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DriverListItem from '../DriverListItem';
import EmptyState from '../EmptyState';
import styles from '../operatorStyles';

export default function DriversTab({ availableDrivers }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Available Drivers</Text>
        <Text style={styles.subtitle}>Drivers not assigned to any tricycle</Text>
      </View>
      <FlatList
        data={availableDrivers}
        keyExtractor={(item) => item._id || item.id}
        renderItem={({ item }) => <DriverListItem driver={item} />}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="No available drivers"
            subtitle="All drivers are currently assigned"
          />
        }
      />
    </SafeAreaView>
  );
}