/**
 * home.jsx - Home Screen Component
 * 
 * Tabs are conditionally displayed based on user role.
 * Redirects guests/non-authenticated users to GuestMain.
 */

import React, { useState, useEffect } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors } from '../../components/common/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getUserCredentials } from '../../utils/userStorage';
import { BookingProvider } from '../../context/BookingContext';

// Import tab components
import DashboardTab from '../dashboard/DashboardTab';
import MapsTab from '../dashboard/MapsTab';
import ChatMenu from '../message/chatMenu';
import GuestMain from '../guest/main';
import TripsTab from '../dashboard/TripsTab';
import LeaderboardTab from '../dashboard/LeaderboardTab';

const Tab = createBottomTabNavigator();

const Home = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user from AsyncStorage on mount
  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const user = await getUserCredentials();
      setCurrentUser(user);
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  };

  // Show loading indicator while checking user
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  // Check if user is guest or not authenticated
  const isGuestOrNotAuth = !currentUser || currentUser.role === 'guest';

  // If user is guest or not authenticated, show GuestMain
  if (isGuestOrNotAuth) {
    return <GuestMain />;
  }

  // Full navigation for authenticated users (driver, operator)
  // Wrap with BookingProvider for drivers to share booking state between Trips and Maps tabs
  const tabNavigator = (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
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
        <Tab.Screen
          name="Dashboard"
          component={DashboardTab}
          options={{ 
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="grid-outline" size={size} color={color} />
            ) 
          }}
        />
        {/* Driver Booking Tab - Only for drivers */}
        {currentUser?.role === 'driver' && (
          <Tab.Screen
            name="Trips"
            component={TripsTab}
            options={{ 
              title: 'Trips',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="bicycle-outline" size={size} color={color} />
              ) 
            }}
          />
        )}
        {/* Leaderboard Tab - Only for drivers */}
        {currentUser?.role === 'driver' && (
          <Tab.Screen
            name="Leaderboard"
            component={LeaderboardTab}
            options={{ 
              title: 'Ranks',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="trophy-outline" size={size} color={color} />
              ) 
            }}
          />
        )}
        <Tab.Screen
          name="Maps"
          component={MapsTab}
          options={{ 
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="map-outline" size={size} color={color} />
            ) 
          }}
        />
        <Tab.Screen
          name="Messages"
          component={ChatMenu}
          options={{ 
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="chatbubble-ellipses-outline" size={size} color={color} />
            ) 
          }}
        />
      </Tab.Navigator>
    </SafeAreaView>
  );

  // For drivers, wrap with BookingProvider to share state between Trips and Maps
  if (currentUser?.role === 'driver') {
    return <BookingProvider>{tabNavigator}</BookingProvider>;
  }

  return tabNavigator;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.ivory1,
  },
});

export default Home;