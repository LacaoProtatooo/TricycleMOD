// AppDrawer.jsx
import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { DrawerContentScrollView, DrawerItem } from '@react-navigation/drawer';
import { Avatar, Text, IconButton, Divider, Drawer } from 'react-native-paper';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getUserCredentials } from '../../utils/userStorage';
import defaultAvatar from '../../../assets/webttrac_logo_bgrm.png';
import { colors, spacing, fonts } from './theme';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SCREEN_WIDTH = Dimensions.get('window').width;

const AppDrawer = ({ closeDrawer, navigation }) => {
  const [user, setUser] = useState(null);

  // Check if driver is suspended
  const isDriverSuspended = user && user.role === 'driver' && user.isSuspended && 
    user.suspendedUntil && new Date(user.suspendedUntil) > new Date();

  // Refresh user data every time the drawer is focused
  useFocusEffect(
    useCallback(() => {
      const fetchUser = async () => {
        try {
          const userData = await getUserCredentials();
          console.log('Retrieved user from AsyncStorage:', userData);
          setUser(userData);
        } catch (error) {
          console.error('Error fetching user:', error);
        }
      };

      fetchUser();
    }, [])
  );

  // Helper function to safely navigate using the navigation ref
  const navigateSafe = (routeName) => {
    if (navigation?.isReady && navigation.isReady()) {
      navigation.navigate(routeName);
    } else if (navigation?.current?.isReady && navigation.current.isReady()) {
      navigation.current.navigate(routeName);
    } else if (navigation?.current) {
      navigation.current.navigate(routeName);
    } else {
      console.warn('Navigation not ready yet');
    }
  };

  const renderIcon = (name, focused) => {
    return (
      <View style={styles.iconContainer}>
        <Ionicons 
          name={name} 
          color={focused ? colors.primary : colors.orangeShade7} 
          size={24} 
        />
      </View>
    );
  };

  return (
    <View style={styles.overlay}>
      {/* Drawer container on the LEFT - takes half screen */}
      <View style={styles.container}>
        <DrawerContentScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.drawerContent}>
            {/* Close Button */}
            {/* <IconButton
              icon="close"
              color={colors.orangeShade7}
              size={28}
              onPress={closeDrawer}
              style={styles.closeButton}
            /> */}

            {/* USER INFO SECTION */}
            <View style={styles.userInfoSection}>
              <View style={styles.avatarContainer}>
                <Avatar.Image
                  source={
                    user?.image?.url
                      ? { uri: user.image.url }
                      : defaultAvatar
                  }
                  size={80}
                  style={styles.avatar}
                />
                <View style={styles.userTextContainer}>
                  <Text variant="titleMedium" style={styles.title}>
                    {user?.firstname || 'Guest'}
                  </Text>
                  <Text variant="bodySmall" style={styles.caption}>
                    @{user?.username || 'guest_user'}
                  </Text>
                  {/* Suspended Badge */}
                  {isDriverSuspended && (
                    <View style={styles.suspendedBadge}>
                      <Ionicons name="ban-outline" size={12} color="#fff" />
                      <Text style={styles.suspendedBadgeText}>SUSPENDED</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            <Divider style={styles.divider} />

            {/* NAVIGATION ITEMS */}
            <View style={styles.drawerSection}>
              {/* Show Home for non-operators (except suspended drivers) */}
              {user?.role !== 'operator' && !isDriverSuspended && (
                <DrawerItem
                  icon={({ focused }) => renderIcon('home', focused)}
                  label="Home"
                  labelStyle={styles.drawerLabel}
                  activeBackgroundColor={`${colors.ivory4}CC`}
                  activeTintColor={colors.primary}
                  inactiveTintColor={colors.orangeShade8}
                  onPress={() => {
                    navigateSafe('Home');
                    closeDrawer();
                  }}
                />
              )}

              {/* Show Suspension Status for suspended drivers */}
              {isDriverSuspended && (
                <DrawerItem
                  icon={({ focused }) => (
                    <View style={styles.iconContainer}>
                      <Ionicons 
                        name="ban-outline" 
                        color={colors.error} 
                        size={24} 
                      />
                    </View>
                  )}
                  label="Suspension Status"
                  labelStyle={[styles.drawerLabel, { color: colors.error }]}
                  activeBackgroundColor={`${colors.ivory4}CC`}
                  activeTintColor={colors.error}
                  inactiveTintColor={colors.error}
                  onPress={() => {
                    navigateSafe('Suspended');
                    closeDrawer();
                  }}
                />
              )}

              {/* Guest Users Navigation */}
              {!user && (
                <>
                  <DrawerItem
                    icon={({ focused }) => renderIcon('log-in-outline', focused)}
                    label="Login"
                    labelStyle={styles.drawerLabel}
                    activeBackgroundColor={`${colors.ivory4}CC`}
                    activeTintColor={colors.primary}
                    inactiveTintColor={colors.orangeShade8}
                    onPress={() => {
                      navigateSafe('Login');
                      closeDrawer();
                    }}
                  />
                  <DrawerItem
                    icon={({ focused }) => renderIcon('person-add-outline', focused)}
                    label="Signup"
                    labelStyle={styles.drawerLabel}
                    activeBackgroundColor={`${colors.ivory4}CC`}
                    activeTintColor={colors.primary}
                    inactiveTintColor={colors.orangeShade8}
                    onPress={() => {
                      navigateSafe('Signup');
                      closeDrawer();
                    }}
                  />
                  <DrawerItem
                    icon={({ focused }) => renderIcon('alert-circle-outline', focused)}
                    label="About"
                    labelStyle={styles.drawerLabel}
                    activeBackgroundColor={`${colors.ivory4}CC`}
                    activeTintColor={colors.primary}
                    inactiveTintColor={colors.orangeShade8}
                    onPress={() => {
                      navigateSafe('About');
                      closeDrawer();
                    }}
                  />
                </>
              )}

              {/* Logged-in Users Navigation */}
              {user && (
                <>
                  <DrawerItem
                    icon={({ focused }) => renderIcon('person-outline', focused)}
                    label="Account"
                    labelStyle={styles.drawerLabel}
                    activeBackgroundColor={`${colors.ivory4}CC`}
                    activeTintColor={colors.primary}
                    inactiveTintColor={colors.orangeShade8}
                    onPress={() => {
                      navigateSafe('Account');
                      closeDrawer();
                    }}
                  />

                  {/* Hide Forum for suspended drivers */}
                  {!isDriverSuspended && (
                    <DrawerItem
                      icon={({ focused }) => renderIcon('people-circle-outline', focused)}
                      label="Forum"
                      labelStyle={styles.drawerLabel}
                      activeBackgroundColor={`${colors.ivory4}CC`}
                      activeTintColor={colors.primary}
                      inactiveTintColor={colors.orangeShade8}
                      onPress={() => {
                        navigateSafe('Forum');
                        closeDrawer();
                      }}
                    />
                  )}

                  <DrawerItem
                    icon={({ focused }) => renderIcon('chatbubble-ellipses-outline', focused)}
                    label="Notifications"
                    labelStyle={styles.drawerLabel}
                    activeBackgroundColor={`${colors.ivory4}CC`}
                    activeTintColor={colors.primary}
                    inactiveTintColor={colors.orangeShade8}
                    onPress={() => {
                      navigateSafe('NotificationInbox');
                      closeDrawer();
                    }}
                  />
  
                  {/* Only show Operator for operators */}
                  {user.role === 'operator' && (
                    <DrawerItem
                      icon={({ focused }) => renderIcon('settings-outline', focused)}
                      label="Operator"
                      labelStyle={styles.drawerLabel}
                      activeBackgroundColor={`${colors.ivory4}CC`}
                      activeTintColor={colors.primary}
                      inactiveTintColor={colors.orangeShade8}
                      onPress={() => {
                        navigateSafe('OperatorScreen');
                        closeDrawer();
                      }}
                    />
                  )}

                  {/* Only show Sick Leave for drivers (not suspended) */}
                  {user.role === 'driver' && !isDriverSuspended && (
                    <DrawerItem
                      icon={({ focused }) => renderIcon('medical-outline', focused)}
                      label="Sick Leave"
                      labelStyle={styles.drawerLabel}
                      activeBackgroundColor={`${colors.ivory4}CC`}
                      activeTintColor={colors.primary}
                      inactiveTintColor={colors.orangeShade8}
                      onPress={() => {
                        navigateSafe('SickLeave');
                        closeDrawer();
                      }}
                    />
                  )}

                  <DrawerItem
                    icon={({ focused }) => renderIcon('alert-circle-outline', focused)}
                    label="About"
                    labelStyle={styles.drawerLabel}
                    activeBackgroundColor={`${colors.ivory4}CC`}
                    activeTintColor={colors.primary}
                    inactiveTintColor={colors.orangeShade8}
                    onPress={() => {
                      navigateSafe('About');
                      closeDrawer();
                    }}
                  />

                  {/* Hide Lost & Found for suspended drivers */}
                  {!isDriverSuspended && (
                    <DrawerItem
                      icon={({ focused }) => renderIcon('cube-outline', focused)}
                      label="Lost & Found"
                      labelStyle={styles.drawerLabel}
                      activeBackgroundColor={`${colors.ivory4}CC`}
                      activeTintColor={colors.primary}
                      inactiveTintColor={colors.orangeShade8}
                      onPress={() => {
                        navigateSafe('LostFound');
                        closeDrawer();
                      }}
                    />
                  )}

                  {/* Rules & Regulations - visible to drivers and operators */}
                  {(user.role === 'driver' || user.role === 'operator') && (
                    <DrawerItem
                      icon={({ focused }) => renderIcon('document-text-outline', focused)}
                      label="Rules & Regulations"
                      labelStyle={styles.drawerLabel}
                      activeBackgroundColor={`${colors.ivory4}CC`}
                      activeTintColor={colors.primary}
                      inactiveTintColor={colors.orangeShade8}
                      onPress={() => {
                        navigateSafe('RulesRegulations');
                        closeDrawer();
                      }}
                    />
                  )}
                  <Divider style={styles.divider} />
                </>
              )}
            </View>

            {/* APP VERSION FOOTER */}
            <View style={styles.footer}>
              <Text variant="bodySmall" style={styles.versionText}>
                Tricycle MOD
              </Text>
              <Text variant="bodySmall" style={styles.versionText}>
                App Version 0.0.1
              </Text>
            </View>
          </View>
        </DrawerContentScrollView>
      </View>

      {/* Clickable overlay to close drawer - on the RIGHT */}
      <TouchableOpacity 
        style={styles.overlayBackground} 
        activeOpacity={1} 
        onPress={closeDrawer}
      />
    </View>
  );
};

export default AppDrawer;

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  container: {
    width: SCREEN_WIDTH * 0.6, // Takes half of screen width - LEFT SIDE
    height: SCREEN_HEIGHT, // Full height for proper scrolling
    backgroundColor: colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 }, // Changed to positive for right shadow
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 16,
  },
  overlayBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent dark overlay - RIGHT SIDE
  },
  scrollContent: {
    flexGrow: 1,
  },
  drawerContent: {
    flex: 1,
    paddingTop: 10,
    paddingBottom: 20,
  },
  closeButton: {
    alignSelf: 'flex-end',
    margin: spacing.small,
    backgroundColor: `${colors.ivory3}CC`,
  },
  userInfoSection: {
    paddingHorizontal: spacing.large,
    marginBottom: spacing.large,
  },
  avatarContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: spacing.small,
  },
  avatar: {
    backgroundColor: colors.ivory4,
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: spacing.medium,
  },
  userTextContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.orangeShade7,
    fontFamily: fonts.medium,
  },
  caption: {
    fontSize: 14,
    color: colors.orangeShade5,
    fontFamily: fonts.regular,
  },
  suspendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: spacing.small,
  },
  suspendedBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: colors.orangeShade3,
    opacity: 0.3,
    marginVertical: spacing.medium,
    marginHorizontal: spacing.medium,
  },
  drawerSection: {
    marginTop: spacing.small,
  },
  drawerLabel: {
    fontSize: 16,
    fontFamily: fonts.regular,
    fontWeight: '500',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: `${colors.ivory3}CC`,
  },
  footer: {
    marginTop: 'auto',
    padding: spacing.medium,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 12,
    color: colors.orangeShade4,
    fontFamily: fonts.light,
  },
});