/**
 * main.jsx - Guest/Non-User Main Screen
 *
 * Entry point for guest users with bottom tab navigation
 */

import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../components/common/theme';
import GuestWeather from './weather';
import GuestMaps from './maps';
import GuestTracking from './tracking';
import BookingScreen from './BookingScreen';
import ComplaintScreen from './ComplaintScreen';
import GuestQueueScreen from './QueueScreen';

const Tab = createBottomTabNavigator();

const GuestMain = () => {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.orangeShade5,
          tabBarStyle: {
            backgroundColor: colors.ivory1,
            borderTopWidth: 1,
            borderTopColor: colors.ivory3,
            height: 60 + insets.bottom,
            paddingBottom: 8 + insets.bottom,
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
          name="Queue"
          component={GuestQueueScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people-outline" size={size} color={color} />
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
    </View>
  );
};

export default GuestMain;
