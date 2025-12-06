// Navigator.jsx
import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, Text, Pressable, Animated } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Provider as PaperProvider } from 'react-native-paper';
import { useSelector } from 'react-redux';
import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';

import { colors } from '../components/common/theme';

// Screens
import Home from '../screens/common/home';
import About from '../screens/common/about';
import Login from '../screens/common/login';
import Signup from '../screens/common/signup';
import Account from '../screens/common/account';
import OperatorScreen from '../screens/operator/OperatorScreen';
import Chat from '../screens/message/chat';
import SickLeaveScreen from '../screens/common/SickLeaveScreen';
import ForumScreen from '../screens/common/ForumScreen';

// Drawers
import AppDrawer from '../components/common/appdrawer';

// Create Stack and navigation ref
const Stack = createStackNavigator();
export const navigationRef = createNavigationContainerRef();

const Navigator = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [notificationData, setNotificationData] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const user = useSelector((state) => state.auth.user);

  // Animation values
  const slideAnim = useRef(new Animated.Value(-300)).current; // Start off-screen to the left
  const overlayAnim = useRef(new Animated.Value(0)).current; // Start transparent

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const message = response?.notification?.request?.content?.body;
      setNotificationData({ message });
      setModalVisible(true);
    });
  
    return () => {
      subscription.remove();
    };
  }, []);

  // Animate drawer when visibility changes
  useEffect(() => {
    if (drawerVisible) {
      // Slide in and fade in overlay
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Slide out and fade out overlay
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -300,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [drawerVisible, slideAnim, overlayAnim]);

  const closeDrawer = () => {
    // Animate out first, then hide
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -300,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setDrawerVisible(false);
    });
  };

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
      <NavigationContainer 
        ref={navigationRef}
        onReady={() => {
          // Navigation container is ready
          console.log('Navigation container ready');
        }}
        onStateChange={() => {
          // Optional: track navigation state changes
        }}
      >
        <View style={{ flex: 1 }}>
          {/* Floating menu button */}
          <TouchableOpacity
            style={styles.floatingButton}
            onPress={() => {
              if (drawerVisible) {
                closeDrawer();
              } else {
                setDrawerVisible(true);
              }
            }}
          >
            <Ionicons name="menu" size={30} color="#000" />
          </TouchableOpacity>

          {/* Stack Navigator */}
          <Stack.Navigator 
            screenOptions={{ headerShown: false }}
            initialRouteName={user ? 'Home' : 'Login'}
          >
            {/* Always include all screens for navigation to work properly */}
            <Stack.Screen name="Login" component={Login} />
            <Stack.Screen name="Signup" component={Signup} />
            <Stack.Screen name="Home" component={Home} />
            <Stack.Screen name="About" component={About} />
            <Stack.Screen name="OperatorScreen" component={OperatorScreen} />
            <Stack.Screen name="Account" component={Account} />
            <Stack.Screen name="Chat" component={Chat} />
            <Stack.Screen name="SickLeave" component={SickLeaveScreen} />
            <Stack.Screen name="Forum" component={ForumScreen} />
          </Stack.Navigator>

          {/* Drawer Overlay with Animation */}
          {drawerVisible && (
            <View style={styles.drawerOverlay}>
              <Animated.View
                style={[
                  styles.drawerContainer,
                  {
                    transform: [{ translateX: slideAnim }],
                  },
                ]}
              >
                <AppDrawer
                  closeDrawer={closeDrawer}
                  navigation={navigationRef}
                />
              </Animated.View>
              
              {/* Animated overlay background */}
              <Animated.View
                style={[
                  styles.overlayBackground,
                  {
                    opacity: overlayAnim,
                  },
                ]}
              >
                <TouchableOpacity
                  style={{ flex: 1 }}
                  activeOpacity={1}
                  onPress={closeDrawer}
                />
              </Animated.View>
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
  drawerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 1000,
  },
  overlayBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
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