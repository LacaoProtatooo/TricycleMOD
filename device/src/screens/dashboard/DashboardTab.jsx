import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from 'react-native-paper';
import { colors, spacing, fonts } from '../../components/common/theme';
import { getUserCredentials } from '../../utils/userStorage';
import { getToken } from '../../utils/jwtStorage';
import { useAsyncSQLiteContext } from '../../utils/asyncSQliteProvider';
import defaultAvatar from '../../../assets/ghost.png';
import StatCard from '../../components/home/StatCard';
import MaintenanceTracker from '../../components/home/MaintenanceTracker';
import WeatherWidget from '../../components/home/WeatherWidget';
import Constants from 'expo-constants';

import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND = (Constants?.expoConfig?.extra?.BACKEND_URL) || (Constants?.manifest?.extra?.BACKEND_URL) || 'http://192.168.254.105:5000';
const KM_KEY = 'vehicle_current_km_v1';

const DashboardTab = () => {
  const db = useAsyncSQLiteContext();
  const [user, setUser] = useState(null);
  const [assignedTricycle, setAssignedTricycle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    rating: 0
  });

  useEffect(() => { 
    if (db) {
      fetchData(); 
    }
  }, [db]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const userData = await getUserCredentials();
      setUser(userData);
      
      const token = await getToken(db);
      if (token) {
        // Fetch assigned tricycle
        const res = await fetch(`${BACKEND}/api/tricycles`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.success && data.data.length > 0) {
          // Assuming the first one is the active one
          const trike = data.data[0];
          setAssignedTricycle(trike);

          // Save context for background task
          await AsyncStorage.setItem('active_tricycle_id', trike._id);
          await AsyncStorage.setItem('auth_token_str', token);

          // Sync odometer from server if available
          if (trike.currentOdometer) {
             const localKm = await AsyncStorage.getItem(KM_KEY);
             const localVal = localKm ? parseFloat(localKm) : 0;
             // If server has a higher value (e.g. from previous driver), take it
             if (trike.currentOdometer > localVal) {
                 await AsyncStorage.setItem(KM_KEY, String(trike.currentOdometer));
             }
          }
        } else {
            // Clear if no tricycle assigned
            await AsyncStorage.removeItem('active_tricycle_id');
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // keep only Rating stat; replace Completed with WeatherWidget below
  const statsData = [
    { icon: 'star-outline', value: Number(user?.rating || 0).toFixed(1), label: 'Rating', bg: '#ffc107' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { flexGrow: 1 }]}
        nestedScrollEnabled={true}
      >
        <View style={styles.headerSection}>
          <View>
            <Text style={styles.greeting}>Hello,</Text>
            <Text style={styles.userName}>{user?.firstname || 'Driver'}!</Text>
            {assignedTricycle && (
              <Text style={{color: colors.primary, fontSize: 12}}>
                Assigned: {assignedTricycle.plateNumber}
              </Text>
            )}
          </View>
          <Avatar.Image
            source={user?.image?.url ? { uri: user.image.url } : defaultAvatar}
            size={60}
            style={styles.avatar}
          />
        </View>

        <View style={styles.statsContainer}>
          {statsData.map((s, i) => (
            <StatCard key={i} icon={s.icon} bgColor={s.bg} value={s.value} label={s.label} />
          ))}
        </View>

        {/* NEW: Weather for today + following hours */}
        <WeatherWidget />

        {/* Maintenance tracker */}
        <MaintenanceTracker tricycleId={assignedTricycle?._id} />

      </ScrollView>
    </SafeAreaView>
  );
};

export default DashboardTab;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.medium,
  },
  // Header Section
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.large,
  },
  greeting: {
    fontSize: 18,
    color: colors.orangeShade5,
    fontFamily: fonts.regular,
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.orangeShade7,
    fontFamily: fonts.medium,
  },
  avatar: {
    backgroundColor: colors.ivory4,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  // Stats Container
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.medium,
  },
});
