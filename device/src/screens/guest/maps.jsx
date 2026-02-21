/**
 * maps.jsx - Guest Maps Screen
 *
 * Displays a map of Taguig City with terminal locations
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';

import { colors, spacing } from '../../components/common/theme';

// Taguig City center coordinates
const TAGUIG_CENTER = { latitude: 14.5176, longitude: 121.0509 };

// Terminal locations in Taguig
const TERMINALS = [
  { id: 'terminal-1', name: 'Terminal 1', latitude: 14.511445966700096, longitude: 121.03384457224557, radiusMeters: 180 },
  { id: 'terminal-2', name: 'Terminal 2', latitude: 14.513932064735052, longitude: 121.04019584947487, radiusMeters: 180 },
  { id: 'terminal-3', name: 'Terminal 3', latitude: 14.514534704611194, longitude: 121.04273098634214, radiusMeters: 180 },
  { id: 'terminal-4', name: 'Terminal 4', latitude: 14.514546, longitude: 121.041421, radiusMeters: 180 },
];

const GuestMaps = () => {
  const isFocused = useIsFocused();
  const mapRef = useRef(null);
  const [region, setRegion] = useState({
    latitude: TAGUIG_CENTER.latitude,
    longitude: TAGUIG_CENTER.longitude,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  const [userLocation, setUserLocation] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setHasPermission(true);
        getCurrentLocation();
      } else {
        Alert.alert(
          'Location Permission',
          'Location permission is needed to show your position on the map.'
        );
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = location.coords;
      setUserLocation({ latitude, longitude });
    } catch (error) {
      console.warn('Error getting current location:', error);
    }
  };

  const centerOnUser = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateCamera(
        {
          center: userLocation,
          zoom: 16,
        },
        { duration: 500 }
      );
    } else {
      Alert.alert('Location', 'Unable to get your current location');
    }
  };

  const centerOnTaguig = () => {
    if (mapRef.current) {
      mapRef.current.animateCamera(
        {
          center: TAGUIG_CENTER,
          zoom: 14,
        },
        { duration: 500 }
      );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Ionicons name="map-outline" size={24} color={colors.primary} />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Taguig City Map</Text>
            <Text style={styles.headerSubtitle}>Terminal Locations</Text>
          </View>
        </View>
      </View>

      {/* Map - only render when tab is focused to prevent multiple MapView crashes */}
      {isFocused ? (
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
          style={styles.map}
          initialRegion={region}
          showsUserLocation={hasPermission}
          showsMyLocationButton={false}
          showsCompass={true}
          showsScale={true}
        >
          {/* Terminal markers and geofence circles */}
          {TERMINALS.map((terminal) => (
            <React.Fragment key={terminal.id}>
              <Circle
                center={{ latitude: terminal.latitude, longitude: terminal.longitude }}
                radius={terminal.radiusMeters}
                strokeColor="rgba(255,102,0,0.6)"
                fillColor="rgba(255,102,0,0.15)"
              />
              <Marker
                coordinate={{ latitude: terminal.latitude, longitude: terminal.longitude }}
                title={terminal.name}
                description={`Radius: ${terminal.radiusMeters}m`}
              >
                <View style={styles.terminalMarker}>
                  <Ionicons name="flag" size={20} color="#fff" />
                </View>
              </Marker>
            </React.Fragment>
          ))}

          {/* User location marker (if available) */}
          {userLocation && (
            <Marker
              coordinate={userLocation}
              title="Your Location"
            >
              <View style={styles.userMarker}>
                <Ionicons name="person" size={18} color="#fff" />
              </View>
            </Marker>
          )}
        </MapView>
      ) : (
        <View style={[styles.map, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {/* Map Controls */}
      <View style={styles.controls}>
        {/* Center on User Button */}
        {hasPermission && (
          <TouchableOpacity
            style={styles.controlButton}
            onPress={centerOnUser}
          >
            <Ionicons name="locate-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
        )}

        {/* Center on Taguig Button */}
        <TouchableOpacity
          style={[styles.controlButton, { marginTop: spacing.small }]}
          onPress={centerOnTaguig}
        >
          <Ionicons name="home-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Map Legend</Text>
        
        <View style={styles.legendItem}>
          <View style={[styles.legendIcon, { backgroundColor: '#f97316' }]}>
            <Ionicons name="flag" size={14} color="#fff" />
          </View>
          <Text style={styles.legendText}>Tricycle Terminals</Text>
        </View>

        <View style={styles.legendItem}>
          <View style={[styles.legendIcon, { backgroundColor: colors.primary }]}>
            <Ionicons name="person" size={14} color="#fff" />
          </View>
          <Text style={styles.legendText}>Your Location</Text>
        </View>

        <View style={styles.legendItem}>
          <View style={styles.legendCircle} />
          <Text style={styles.legendText}>Terminal Coverage Area</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ivory1,
  },
  header: {
    backgroundColor: colors.ivory1,
    paddingHorizontal: spacing.large,
    paddingVertical: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.ivory3,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    marginLeft: spacing.small,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.orangeShade5,
  },
  map: {
    flex: 1,
  },
  terminalMarker: {
    backgroundColor: '#f97316',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  userMarker: {
    backgroundColor: colors.primary,
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  controls: {
    position: 'absolute',
    right: spacing.medium,
    top: 100,
  },
  controlButton: {
    backgroundColor: colors.ivory1,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.ivory3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  legend: {
    position: 'absolute',
    left: spacing.medium,
    bottom: spacing.medium,
    backgroundColor: colors.ivory1,
    padding: spacing.small,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ivory3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.xsmall,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.small,
  },
  legendIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.small,
  },
  legendCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,102,0,0.6)',
    backgroundColor: 'rgba(255,102,0,0.15)',
    marginRight: spacing.small,
  },
  legendText: {
    fontSize: 12,
    color: colors.orangeShade6,
  },
});

export default GuestMaps;