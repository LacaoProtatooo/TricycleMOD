import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image
} from "react-native";
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from 'react-native-paper';
import { colors, spacing, fonts } from '../../components/common/theme';
import { getUserCredentials } from '../../utils/userStorage';
import defaultAvatar from '../../../assets/ghost.png';
import StatCard from '../../components/home/StatCard';
import MaintenanceTracker from '../../components/home/MaintenanceTracker';
import WeatherWidget from '../../components/home/WeatherWidget';
import ProfileScreen from './ProfileScreen';

const Tab = createBottomTabNavigator();

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

const MapsTab = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mapContainer}>
        <View style={styles.mapPlaceholder}>
          <Ionicons name="map" size={80} color={colors.orangeShade4} />
          <Text style={styles.mapPlaceholderText}>Map View</Text>
          <Text style={styles.mapPlaceholderSubtext}>Your map integration will appear here</Text>
        </View>
        <View style={styles.mapControls}>
          <TouchableOpacity style={styles.mapButton}>
            <Ionicons name="locate-outline" size={24} color={colors.ivory1} />
            <Text style={styles.mapButtonText}>Current Location</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mapButton}>
            <Ionicons name="navigate-outline" size={24} color={colors.ivory1} />
            <Text style={styles.mapButtonText}>Directions</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mapButton}>
            <Ionicons name="search-outline" size={24} color={colors.ivory1} />
            <Text style={styles.mapButtonText}>Search</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const ProfileTab = () => {
  const [user, setUser] = useState(null);
  useEffect(() => { fetchUserData(); }, []);
  const fetchUserData = async () => {
    try { const userData = await getUserCredentials(); setUser(userData); }
    catch (error) { console.error('Error fetching user:', error); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Avatar.Image source={user?.image?.url ? { uri: user.image.url } : defaultAvatar} size={100} style={styles.profileAvatar} />
          </View>
          <Text style={styles.profileName}>{user?.firstname || 'Driver'} {user?.lastname || ''}</Text>
          <Text style={styles.profileEmail}>{user?.email || 'driver@example.com'}</Text>
          <Text style={styles.profileRole}>Driver</Text>
        </View>

        <View style={styles.menuSection}>
          {[
            { icon: 'person-outline', text: 'Personal Information' },
            { icon: 'document-text-outline', text: 'Documents & License' },
            { icon: 'card-outline', text: 'Payment Methods' },
            { icon: 'settings-outline', text: 'Settings' },
            { icon: 'help-circle-outline', text: 'Help & Support' },
          ].map((m, i) => (
            <TouchableOpacity key={i} style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Ionicons name={m.icon} size={24} color={colors.primary} />
                <Text style={styles.menuItemText}>{m.text}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.orangeShade5} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="log-out-outline" size={24} color={colors.error} />
              <Text style={[styles.menuItemText, { color: colors.error }]}>Logout</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.orangeShade5} />
          </TouchableOpacity>
        </View>

        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Tricycle MOD</Text>
          <Text style={styles.versionText}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const Home = () => (
  <Tab.Navigator
    screenOptions={{
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.orangeShade5,
      tabBarStyle: {
        backgroundColor: colors.ivory1,
        borderTopWidth: 1,
        borderTopColor: colors.ivory3,
        height: 60,
        paddingBottom: 8,
        paddingTop: 8,
      },
      headerShown: false,
    }}
  >
    <Tab.Screen name="Dashboard" component={DashboardTab} options={{ tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} /> }} />
    <Tab.Screen name="Maps" component={MapsTab} options={{ tabBarIcon: ({ color, size }) => <Ionicons name="map-outline" size={size} color={color} /> }} />
    <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} /> }} />
  </Tab.Navigator>
);

export default Home;

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
  statCard: {
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
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.small,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.orangeShade7,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: colors.orangeShade5,
  },
  // Section
  section: {
    marginTop: spacing.large,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.orangeShade6,
    marginBottom: spacing.medium,
    fontFamily: fonts.medium,
  },
  // Action Cards
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ivory4,
    borderRadius: 12,
    padding: spacing.medium,
    marginBottom: spacing.medium,
    borderWidth: 1,
    borderColor: colors.ivory3,
    shadowColor: colors.orangeShade8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.medium,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.orangeShade7,
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 14,
    color: colors.orangeShade5,
  },
  // Recent Rides
  recentRideCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.ivory4,
    borderRadius: 12,
    padding: spacing.medium,
    marginBottom: spacing.medium,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  rideInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rideIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.small,
  },
  rideDetails: {
    flex: 1,
  },
  rideTime: {
    fontSize: 14,
    color: colors.orangeShade5,
    marginBottom: 4,
  },
  rideRoute: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.orangeShade7,
  },
  rideAmountContainer: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  rideAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.ivory1,
  },
  // Map Styles
  mapContainer: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.ivory4,
    margin: spacing.medium,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  mapPlaceholderText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: spacing.medium,
  },
  mapPlaceholderSubtext: {
    fontSize: 14,
    color: colors.orangeShade5,
    marginTop: spacing.small,
  },
  mapControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  mapButtonText: {
    color: colors.ivory1,
    marginLeft: 6,
    fontWeight: '600',
  },
  activeTripCard: {
    backgroundColor: colors.ivory4,
    margin: spacing.medium,
    borderRadius: 12,
    padding: spacing.medium,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  activeTripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.small,
  },
  activeTripTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc3545',
    marginLeft: spacing.small,
  },
  activeTripRoute: {
    fontSize: 14,
    color: colors.orangeShade6,
    marginBottom: 4,
  },
  viewTripButton: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: spacing.medium,
    alignItems: 'center',
  },
  viewTripButtonText: {
    color: colors.ivory1,
    fontWeight: 'bold',
  },
  // Profile Styles
  profileHeader: {
    alignItems: 'center',
    marginBottom: spacing.large,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.medium,
  },
  profileAvatar: {
    borderWidth: 4,
    borderColor: colors.primary,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.ivory1,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.orangeShade7,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 16,
    color: colors.orangeShade5,
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    backgroundColor: colors.primary + '20',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  // Menu Section
  menuSection: {
    marginTop: spacing.large,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.ivory4,
    padding: spacing.medium,
    marginBottom: spacing.small,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemText: {
    fontSize: 16,
    color: colors.orangeShade7,
    marginLeft: spacing.medium,
  },
  // Version
  versionContainer: {
    alignItems: 'center',
    marginTop: spacing.large * 2,
    marginBottom: spacing.large,
  },
  versionText: {
    fontSize: 12,
    color: colors.orangeShade4,
    marginBottom: 4,
  },
});