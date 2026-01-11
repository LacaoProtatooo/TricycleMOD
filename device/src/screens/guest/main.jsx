/**
 * main.jsx - Guest/Non-User Main Screen
 *
 * Entry point for guest users with bottom tab navigation
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../../components/common/theme';
import GuestWeather from './weather';
import GuestMaps from './maps';
import GuestTracking from './tracking';
import BookingScreen from './BookingScreen';
import ComplaintScreen from './ComplaintScreen';

const Tab = createBottomTabNavigator();

const GuestMain = () => {
  return (
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
          name="Booking"
          component={BookingScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="bicycle-outline" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Weather"
          component={GuestWeather}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="partly-sunny-outline" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Maps"
          component={GuestMaps}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="map-outline" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Tracking"
          component={GuestTracking}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="navigate-circle-outline" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Complaints"
          component={ComplaintScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="flag-outline" size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
    </SafeAreaView>
  );
};

export default GuestMain;
