import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../../components/common/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import styles from '../operatorStyles';
import EmptyState from '../../../components/common/EmptyState';
import ErrorDisplay from '../../../components/common/ErrorDisplay';

export default function SickLeaveTab({ 
  sickLeaves, 
  loadingSickLeaves, 
  errorSickLeaves, 
  onRefresh 
}) {
  const renderItem = ({ item }) => (
    <View style={sickLeaveStyles.card}>
      <View style={sickLeaveStyles.header}>
        {item.driver?.image?.url ? (
          <Image source={{ uri: item.driver.image.url }} style={sickLeaveStyles.avatar} />
        ) : (
          <Ionicons name="person-circle" size={32} color="#ccc" style={{ marginRight: 8 }} />
        )}
        <View>
          <Text style={sickLeaveStyles.name}>{item.driver?.firstname} {item.driver?.lastname}</Text>
          <Text style={sickLeaveStyles.username}>@{item.driver?.username}</Text>
        </View>
      </View>
      
      <Text style={sickLeaveStyles.dates}>
        {new Date(item.startDate).toLocaleDateString()} - {new Date(item.endDate).toLocaleDateString()}
      </Text>
      <Text style={sickLeaveStyles.reason}>"{item.reason}"</Text>
      
      <View style={sickLeaveStyles.footer}>
        <Text style={[
          sickLeaveStyles.status,
          { color: getStatusColor(item.status) }
        ]}>
          {item.status.toUpperCase()}
        </Text>
      </View>
    </View>
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'green';
      case 'rejected': return 'red';
      default: return 'orange';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sick Leave Updates</Text>
        <TouchableOpacity onPress={onRefresh} style={{ padding: 8 }}>
          <Ionicons name="refresh" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>
      
      {errorSickLeaves && (
        <ErrorDisplay error={errorSickLeaves} onRetry={onRefresh} />
      )}
      
      {loadingSickLeaves ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={sickLeaves}
          keyExtractor={item => item._id}
          contentContainerStyle={{ padding: spacing.medium }}
          ListEmptyComponent={
            <EmptyState
              icon="medical-outline"
              title="No sick leave updates"
            />
          }
          renderItem={renderItem}
        />
      )}
    </SafeAreaView>
  );
}

const sickLeaveStyles = {
  card: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: 'orange',
    elevation: 2
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8
  },
  name: {
    fontWeight: '700'
  },
  username: {
    fontSize: 12,
    color: '#666'
  },
  dates: {
    fontWeight: '600',
    marginBottom: 4
  },
  reason: {
    color: '#444',
    fontStyle: 'italic'
  },
  footer: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end'
  },
  status: {
    fontSize: 12,
    fontWeight: '700'
  }
};