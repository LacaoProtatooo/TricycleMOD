import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { Avatar } from 'react-native-paper';
import { colors, spacing, fonts } from '../../components/common/theme';
import { getUserCredentials } from '../../utils/userStorage';
import defaultAvatar from '../../../assets/ghost.png';
import StatCard from '../../components/home/StatCard';
import MaintenanceTracker from '../../components/home/MaintenanceTracker';
import WeatherWidget from '../../components/home/WeatherWidget';

const DashboardTab = () => {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    totalRides: 0,
    completedRides: 0,
    earnings: 0,
    rating: 0
  });

  useEffect(() => { fetchUserData(); }, []);

  const fetchUserData = async () => {
    try {
      const userData = await getUserCredentials();
      setUser(userData);
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  // keep only Rating stat; replace Completed with WeatherWidget below
  const statsData = [
    { icon: 'star-outline', value: Number(stats.rating).toFixed(1), label: 'Rating', bg: '#ffc107' },
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
        <MaintenanceTracker />

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
