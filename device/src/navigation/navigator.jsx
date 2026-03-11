// Navigator.jsx
import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, Text, Pressable, Animated, PanResponder, Dimensions } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Provider as PaperProvider } from 'react-native-paper';
import { useSelector } from 'react-redux';
import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../components/common/theme';

// Screens
import Home from '../screens/common/home';
import About from '../screens/common/about';
import Login from '../screens/common/login';
import Signup from '../screens/common/signup';
import Account from '../screens/common/account';
import OperatorScreen from '../screens/operator/OperatorScreen';
import BoundarySettlementsScreen from '../screens/operator/BoundarySettlementsScreen';
import Chat from '../screens/message/chat';
import SickLeaveScreen from '../screens/common/SickLeaveScreen';
import ForumScreen from '../screens/common/ForumScreen';
import LostFoundScreen from '../screens/common/LostFoundScreen';
import NotificationInbox from '../screens/common/notificationInbox';
import NotificationDetail from '../screens/common/notificationDetail';
import BookingHistoryDetail from '../screens/common/BookingHistoryDetail';
import RulesRegulationsScreen from '../screens/common/RulesRegulationsScreen';
import SuspendedScreen from '../screens/common/SuspendedScreen';

// Drawers
import AppDrawer from '../components/common/appdrawer';

// Create Stack and navigation ref
const Stack = createStackNavigator();
export const navigationRef = createNavigationContainerRef();

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BUTTON_HEIGHT = 44;

const Navigator = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [notificationData, setNotificationData] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const user = useSelector((state) => state.auth.user);
  const isLoading = useSelector((state) => state.auth.loading);
  const insets = useSafeAreaInsets();

  // Check if user is suspended driver
  const isDriverSuspended = user && (user.role === 'driver' || user.role === 'driOps') && user.isSuspended && 
    user.suspendedUntil && new Date(user.suspendedUntil) > new Date();

  // Determine initial route
  const getInitialRouteName = () => {
    if (!user) return 'Login';
    if (isDriverSuspended) return 'Suspended';
    if (user.role === 'operator') return 'OperatorScreen';
    if (user.role === 'driOps') return 'Home';
    return 'Home';
  };

  // Navigate to Login when user logs out
  useEffect(() => {
    if (!user && !isLoading && navigationRef.isReady()) {
      // Reset navigation to Login screen
      navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        })
      );
    }
  }, [user, isLoading]);

  // Navigate to Suspended screen when driver gets suspended
  useEffect(() => {
    if (isDriverSuspended && navigationRef.isReady()) {
      navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Suspended' }],
        })
      );
    }
  }, [isDriverSuspended]);

  // Animation values
  const slideAnim = useRef(new Animated.Value(-300)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  // Draggable button position (start at middle of screen, accounting for safe area)
  const initialY = (SCREEN_HEIGHT - BUTTON_HEIGHT) / 2;
  const buttonY = useRef(new Animated.Value(initialY)).current;
  const lastY = useRef(initialY);

  // Calculate safe boundaries for the draggable button
  const getMinY = () => Math.max(60, insets.top + 10); // Top boundary (below status bar/notch)
  const getMaxY = () => SCREEN_HEIGHT - BUTTON_HEIGHT - Math.max(60, insets.bottom + 10); // Bottom boundary (above nav buttons)

  // PanResponder for draggable button
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to vertical drags (not taps)
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        buttonY.setOffset(lastY.current);
        buttonY.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        // Calculate new position with bounds
        const newY = lastY.current + gestureState.dy;
        const minY = getMinY();
        const maxY = getMaxY();
        
        if (newY >= minY && newY <= maxY) {
          buttonY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        buttonY.flattenOffset();
        // Calculate final position with bounds
        let finalY = lastY.current + gestureState.dy;
        const minY = getMinY();
        const maxY = getMaxY();
        
        // Clamp to bounds
        finalY = Math.max(minY, Math.min(maxY, finalY));
        lastY.current = finalY;
        
        // Snap to final position
        Animated.spring(buttonY, {
          toValue: finalY,
          useNativeDriver: false,
          friction: 7,
        }).start();
      },
    })
  ).current;

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

  useEffect(() => {
    if (drawerVisible) {
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

  // Show loading spinner while verifying user on startup
  if (isLoading && user === null) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary || '#000'} />
      </View>
    );
  }

  return (
    <PaperProvider>
      <NavigationContainer 
        ref={navigationRef}
        onReady={() => {
          console.log('Navigation container ready');
        }}
      >
        <View style={{ flex: 1 }}>
          {/* Floating menu button - draggable */}
          <Animated.View
            style={[
              styles.floatingButton,
              {
                top: buttonY,
              },
            ]}
            {...panResponder.panHandlers}
          >
            <TouchableOpacity
              onPress={() => {
                if (drawerVisible) {
                  closeDrawer();
                } else {
                  setDrawerVisible(true);
                }
              }}
              style={styles.buttonTouchable}
            >
              <Ionicons name="menu" size={25} color="#000000a1" />
            </TouchableOpacity>
          </Animated.View>

          {/* Stack Navigator */}
          <Stack.Navigator 
            screenOptions={{ headerShown: false }}
            initialRouteName={getInitialRouteName()}
          >
            {/* Always include all screens for navigation to work properly */}
            <Stack.Screen name="Login" component={Login} />
            <Stack.Screen name="Signup" component={Signup} />
            <Stack.Screen name="Home" component={Home} />
            <Stack.Screen name="About" component={About} />
            <Stack.Screen name="OperatorScreen" component={OperatorScreen} />
            <Stack.Screen name="BoundarySettlements" component={BoundarySettlementsScreen} />
            <Stack.Screen name="Account" component={Account} />
            <Stack.Screen name="Chat" component={Chat} />
            <Stack.Screen name="SickLeave" component={SickLeaveScreen} />
            <Stack.Screen name="Forum" component={ForumScreen} />
            <Stack.Screen name="LostFound" component={LostFoundScreen} />
            <Stack.Screen name="NotificationInbox" component={NotificationInbox} />
            <Stack.Screen name="NotificationDetail" component={NotificationDetail} />
            <Stack.Screen name="BookingHistoryDetail" component={BookingHistoryDetail} />
            <Stack.Screen name="RulesRegulations" component={RulesRegulationsScreen} />
            <Stack.Screen name="Suspended" component={SuspendedScreen} />
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
    left: 0,
    zIndex: 999,
    backgroundColor: 'white',
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonTouchable: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    paddingLeft: 5,
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