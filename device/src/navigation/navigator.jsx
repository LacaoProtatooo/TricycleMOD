// Navigator.jsx
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, Text, Pressable } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Provider as PaperProvider } from 'react-native-paper';
import { useSelector } from 'react-redux';
import { createNavigationContainerRef } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { colors } from '../components/common/theme';
import { DashboardTab, MapsTab, ProfileTab } from '../screens/common/home'; // exported screens
import About from '../screens/common/about';
import Login from '../screens/common/login';
import Signup from '../screens/common/signup';
import OperatorScreen from '../screens/common/OperatorScreen';
import AppDrawer from '../components/common/appdrawer';

// Create Stack and navigation ref
const Stack = createStackNavigator();
const navigationRef = createNavigationContainerRef();
const Tab = createBottomTabNavigator();

function TabNavigator() {
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
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="Maps"
        component={MapsTab}
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="map-outline" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileTab}
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} /> }}
      />
    </Tab.Navigator>
  );
}

const Navigator = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [notificationData, setNotificationData] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const user = useSelector((state) => state.auth.user);

  useEffect(() => {
    let subscription;
    try {
      subscription = Notifications.addNotificationResponseReceivedListener(response => {
        const message = response?.notification?.request?.content?.body;
        setNotificationData({ message });
        setModalVisible(true);
      });
    } catch (e) {
      console.warn('notification listener failed', e);
    }

    return () => {
      try {
        if (subscription) {
          // preferred: listener object has remove()
          if (typeof subscription.remove === 'function') {
            subscription.remove();
          } else if (typeof Notifications.removeNotificationSubscription === 'function') {
            // fallback for older API versions
            Notifications.removeNotificationSubscription(subscription);
          }
        }
      } catch (e) {
        console.warn('Failed to remove notification listener', e);
      }
    };
  }, []);

  // While user state is undefined (e.g., during startup), show a spinner
  if (user === undefined) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <PaperProvider>
      <NavigationContainer ref={navigationRef}>
        <View style={{ flex: 1 }}>
          {/* Floating menu button */}
          <TouchableOpacity
            style={styles.floatingButton}
            onPress={() => setDrawerVisible(true)}
          >
            <Ionicons name="menu" size={30} color="#000" />
          </TouchableOpacity>

          {/* Stack Navigator */}
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {user ? (
              user.isAdmin ? (
                // Admin Stack
                <>
                  <Stack.Screen name="Home" component={TabNavigator} />
                  <Stack.Screen name="OperatorScreen" component={OperatorScreen} />
                  <Stack.Screen name="About" component={About} />
                </>
              ) : (
                // User Stack
                <>
                  <Stack.Screen name="Home" component={TabNavigator} />
                  <Stack.Screen name="About" component={About} />
                  <Stack.Screen name="OperatorScreen" component={OperatorScreen} />
                </>
              )
            ) : (
              // Not logged in
              <>
                <Stack.Screen name="Login" component={Login} />
                <Stack.Screen name="Signup" component={Signup} />
                <Stack.Screen name="Home" component={TabNavigator} />
                <Stack.Screen name="About" component={About} />
                <Stack.Screen name="OperatorScreen" component={OperatorScreen} />
              </>
            )}
          </Stack.Navigator>

          {/* Drawer Overlay */}
          {drawerVisible && (
            <View style={styles.drawerOverlay}>
              <AppDrawer
                closeDrawer={() => setDrawerVisible(false)}
                navigation={navigationRef}
              />
            </View>
          )}

          {/* Notification Modal */}
          <Modal
            animationType="fade"
            transparent={true}
            visible={modalVisible}
            onRequestClose={() => setModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Notification</Text>
                <Text>{notificationData?.message || 'You tapped a notification!'}</Text>
                <Pressable style={styles.modalCloseButton} onPress={() => setModalVisible(false)}>
                  <Text style={{ color: 'white' }}>Close</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        </View>
      </NavigationContainer>
    </PaperProvider>
  );
};

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 999,
    backgroundColor: 'white',
    borderRadius: 30,
    padding: 10,
    elevation: 5,
  },
  drawerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 998,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  modalCloseButton: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#007AFF',
    borderRadius: 5,
    alignItems: 'center',
  },
});

export default Navigator;