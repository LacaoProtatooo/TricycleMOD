import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../../components/common/theme';
import { getUserCredentials } from '../../utils/userStorage';
import { getToken } from '../../utils/jwtStorage';
import { useAsyncSQLiteContext } from '../../utils/asyncSQliteProvider';
import { getCodingDayStatus, getCodingDayName } from '../../utils/codingDayUtils';
import defaultAvatar from '../../../assets/webttrac_logo_bgrm.png';
import StatCard from '../../components/home/StatCard';
import MaintenanceTracker from '../../components/home/MaintenanceTracker';
import WeatherWidget from '../../components/home/WeatherWidget';
import WeatherAdvisoryModal from '../../components/common/WeatherAdvisoryModal';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../utils/config';

const BACKEND = API_URL;
const KM_KEY = 'vehicle_current_km_v1';

const DashboardTab = () => {
  const db = useAsyncSQLiteContext();
  const [user, setUser] = useState(null);
  const [assignedTricycle, setAssignedTricycle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState(null);
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
        setAuthToken(token);
        // Fetch assigned tricycle
        const res = await fetch(`${BACKEND}/api/tricycles`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.success && data.data.length > 0) {
          // Assuming the first one is the active one
          const trike = data.data[0];
          setAssignedTricycle(trike);

          // Check if we switched tricycles (or user logged in on a device with old data)
          const storedTrikeId = await AsyncStorage.getItem('active_tricycle_id');
          const serverOdo = trike.currentOdometer || 0;

          if (storedTrikeId !== trike._id) {
             // Different tricycle assigned. Overwrite local odometer with server value.
             await AsyncStorage.setItem('active_tricycle_id', trike._id);
             await AsyncStorage.setItem(KM_KEY, String(serverOdo));
          } else {
             // Same tricycle. Sync logic:
             // If server is higher (e.g. updated elsewhere), take server.
             // If local is higher (recent offline driving), keep local.
             const localKm = await AsyncStorage.getItem(KM_KEY);
             const localVal = localKm ? parseFloat(localKm) : 0;
             
             if (serverOdo > localVal) {
                 await AsyncStorage.setItem(KM_KEY, String(serverOdo));
             }
          }
          
          await AsyncStorage.setItem('auth_token_str', token);
        } else {
            // Clear if no tricycle assigned
            await AsyncStorage.removeItem('active_tricycle_id');
            // Optionally clear odometer or leave as is? 
            // Better to clear or set to 0 to avoid confusion if they have no vehicle
            await AsyncStorage.removeItem(KM_KEY);
        }
      } else {
        setAuthToken(null);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Stats removed: rating stat hidden on maintenance/dashboard
  const statsData = [];

  // Calculate coding day status
  const codingDayStatus = useMemo(() => {
    if (!assignedTricycle) return null;
    
    // Debug logging - remove after testing
    console.log('=== DASHBOARD CODING DAY DEBUG ===');
    console.log('Assigned Tricycle:', assignedTricycle?.plateNumber);
    console.log('Coding Day Value:', assignedTricycle?.codingDay);
    console.log('Coding Day Type:', typeof assignedTricycle?.codingDay);
    console.log('Today (getDay):', new Date().getDay());
    console.log('==================================');
    
    return getCodingDayStatus(assignedTricycle.codingDay);
  }, [assignedTricycle]);

  return (
    <SafeAreaView style={styles.container}>
      <WeatherAdvisoryModal />
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

        {/* Stats removed (rating hidden) */}

        {/* Coding Day Status Card */}
        {codingDayStatus && assignedTricycle?.codingDay !== null && assignedTricycle?.codingDay !== undefined && (
          <View style={[
            styles.codingDayCard,
            codingDayStatus.isCodingDay ? styles.codingDayActive : styles.codingDayInactive
          ]}>
            <View style={styles.codingDayHeader}>
              <Ionicons 
                name={codingDayStatus.isCodingDay ? "ban" : "calendar"} 
                size={24} 
                color={codingDayStatus.isCodingDay ? '#721c24' : '#155724'} 
              />
              <Text style={[
                styles.codingDayTitle,
                { color: codingDayStatus.isCodingDay ? '#721c24' : '#155724' }
              ]}>
                {codingDayStatus.isCodingDay ? 'Coding Day - Cannot Operate' : 'Coding Day Schedule'}
              </Text>
            </View>
            <Text style={[
              styles.codingDayText,
              { color: codingDayStatus.isCodingDay ? '#721c24' : '#383d41' }
            ]}>
              {codingDayStatus.isCodingDay 
                ? `Today is ${getCodingDayName(assignedTricycle.codingDay)}. You cannot operate this tricycle today. ${codingDayStatus.hoursRemaining} hour${codingDayStatus.hoursRemaining !== 1 ? 's' : ''} until coding ends.`
                : `Your coding day is every ${getCodingDayName(assignedTricycle.codingDay)}. ${codingDayStatus.message}`
              }
            </Text>
          </View>
        )}

        {/* NEW: Weather for today + following hours */}
        <WeatherWidget />

        {/* Maintenance tracker */}
        <MaintenanceTracker 
            tricycleId={assignedTricycle?._id} 
            serverHistory={assignedTricycle?.maintenanceHistory}
        />

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
    borderWidth: 0.5,
    borderColor: colors.primary,
  },
  // Stats Container
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.medium,
  },
  // Coding Day Card Styles
  codingDayCard: {
    borderRadius: 12,
    padding: spacing.medium,
    marginBottom: spacing.medium,
  },
  codingDayActive: {
    backgroundColor: '#f8d7da',
    borderWidth: 1,
    borderColor: '#f5c6cb',
  },
  codingDayInactive: {
    backgroundColor: '#d4edda',
    borderWidth: 1,
    borderColor: '#c3e6cb',
  },
  codingDayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  codingDayTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  codingDayText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
