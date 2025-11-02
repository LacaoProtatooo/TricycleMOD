/**
 * home.jsx - Home Screen Component
 * 
 * This is the main home screen that displays the bottom tab navigator
 * with Dashboard, Maps, and Profile tabs.
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors } from '../../components/common/theme';

// Import tab components
import DashboardTab from '../dashboard/DashboardTab';
import MapsTab from '../dashboard/MapsTab';
import ProfileTab from '../dashboard/ProfileTab';

const Tab = createBottomTabNavigator();

const Home = () => {
  return (
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
        name="Profile"
        component={ProfileTab}
        options={{ 
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ) 
        }}
      />
    </Tab.Navigator>
  );
};

export default Home;