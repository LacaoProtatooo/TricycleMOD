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
import { SafeAreaView } from 'react-native-safe-area-context';

// Import tab components
import DashboardTab from '../dashboard/DashboardTab';
import MapsTab from '../dashboard/MapsTab';
// Profile tab removed per request
import ChatMenu from '../message/chatMenu';

const Tab = createBottomTabNavigator();

const Home = () => {
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
        name="Messages"
        component={ChatMenu}
        options={{ 
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses-outline" size={size} color={color} />
          ) 
        }}
      />
      {/* Profile tab removed */}
    </Tab.Navigator>
    </SafeAreaView>
  );
};

export default Home;