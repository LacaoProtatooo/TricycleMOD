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
import EmptyState from '../EmptyState';

export default function SickLeaveTab({ token, BACKEND }) {
  const [sickLeaves, setSickLeaves] = useState([]);
  const [loadingSL, setLoadingSL] = useState(false);

  useEffect(() => {
    if (token) fetchSickLeaves();
  }, [token]);

  const fetchSickLeaves = async () => {
    setLoadingSL(true);
    try {
      const res = await fetch(`${BACKEND}/api/sick-leave/operator`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSickLeaves(data.data);
      }
    } catch (error) {
      console.error('Error fetching sick leaves:', error);
      Alert.alert('Error', 'Failed to fetch sick leave data');
    } finally {
      setLoadingSL(false);
    }
  };

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
        <TouchableOpacity onPress={fetchSickLeaves} style={{ padding: 8 }}>
          <Ionicons name="refresh" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>
      
      {loadingSL ? (
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