import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../components/common/theme';

// ensure background task is registered at runtime
import '../../components/services/BackgroundLocationTask';
import { BG_TASK_NAME } from '../../components/services/BackgroundLocationTask';

const KM_KEY = 'vehicle_current_km_v1';

function haversineMeters(a, b) {
  if (!a || !b) return 0;
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371000;
  const φ1 = toRad(a.latitude), φ2 = toRad(b.latitude);
  const Δφ = toRad(b.latitude - a.latitude);
  const Δλ = toRad(b.longitude - a.longitude);
  const aa = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
             Math.cos(φ1) * Math.cos(φ2) *
             Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1-aa));
  return R * c;
}

export default function TrackingMap({ follow = true }) {
  const mapRef = useRef(null);
  const [region, setRegion] = useState(null);
  const [positions, setPositions] = useState([]);
  const [speedKph, setSpeedKph] = useState(0);
  const [odometerKm, setOdometerKm] = useState(0);
  const lastPosRef = useRef(null);
  const watchRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission', 'Location permission is required for tracking');
        return;
      }

      try {
        const saved = await AsyncStorage.getItem(KM_KEY);
        if (saved) setOdometerKm(Number(saved));
      } catch (e) {
        console.warn('load odometer', e);
      }

      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
        const { latitude, longitude } = loc.coords;
        const initialRegion = {
          latitude,
          longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        };
        setRegion(initialRegion);
        const point = { latitude, longitude };
        setPositions([point]);
        lastPosRef.current = { coords: loc.coords, timestamp: loc.timestamp };
      } catch (e) {
        console.warn('initial location', e);
      }

      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        (loc) => {
          const { latitude, longitude, speed } = loc.coords;
          const newPoint = { latitude, longitude };
          setPositions((p) => {
            const next = [...p, newPoint].slice(-5000);
            return next;
          });

          let kph = (typeof speed === 'number' && !isNaN(speed)) ? speed * 3.6 : 0;

          const last = lastPosRef.current;
          if ((!kph || kph === 0) && last) {
            const dt = (loc.timestamp - last.timestamp) / 1000;
            if (dt > 0) {
              const meters = haversineMeters(
                { latitude: last.coords.latitude, longitude: last.coords.longitude },
                { latitude, longitude }
              );
              kph = (meters / dt) * 3.6;
            }
          }

          if (last) {
            const meters = haversineMeters(
              { latitude: last.coords.latitude, longitude: last.coords.longitude },
              { latitude, longitude }
            );
            if (meters > 0.2) {
              setOdometerKm((prev) => {
                const nextKm = +(prev + meters / 1000).toFixed(3);
                AsyncStorage.setItem(KM_KEY, String(nextKm)).catch(() => {});
                return nextKm;
              });
            }
          }

          setSpeedKph(Math.round(kph * 10) / 10);
          lastPosRef.current = { coords: loc.coords, timestamp: loc.timestamp };

          if (follow && mapRef.current) {
            mapRef.current.animateCamera({ center: { latitude, longitude } }, { duration: 300 });
          }
        }
      );
      watchRef.current = sub;
    })();

    return () => {
      if (watchRef.current && typeof watchRef.current.remove === 'function') {
        watchRef.current.remove();
      }
    };
  }, [follow]);

  // start background tracking task
  async function startBackgroundTracking() {
    try {
      const fg = await Location.requestForegroundPermissionsAsync();
      if (fg.status !== 'granted') {
        Alert.alert('Permission required', 'Allow foreground location permission.');
        return;
      }
      const bg = await Location.requestBackgroundPermissionsAsync();
      if (bg.status !== 'granted') {
        Alert.alert('Background permission required', 'Allow background location permission in app settings.');
        return;
      }

      const has = await TaskManager.isTaskRegisteredAsync(BG_TASK_NAME);
      if (!has) {
        await Location.startLocationUpdatesAsync(BG_TASK_NAME, {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 2000,
          distanceInterval: 1,
          foregroundService: {
            notificationTitle: 'TricycleMOD tracking',
            notificationBody: 'Background location active',
            notificationColor: '#FF0000',
          },
        });
        Alert.alert('Tracking', 'Background tracking started');
      } else {
        Alert.alert('Tracking', 'Background tracking already running');
      }
    } catch (e) {
      console.warn('startBackgroundTracking', e);
      Alert.alert('Error', String(e));
    }
  }

  async function stopBackgroundTracking() {
    try {
      const registered = await TaskManager.isTaskRegisteredAsync(BG_TASK_NAME);
      if (registered) {
        await Location.stopLocationUpdatesAsync(BG_TASK_NAME);
      }
      Alert.alert('Tracking', 'Background tracking stopped');
    } catch (e) {
      console.warn('stopBackgroundTracking', e);
      Alert.alert('Error', String(e));
    }
  }

  return (
    <View style={styles.container}>
      {region ? (
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={region}
          showsUserLocation
          followsUserLocation={false}
          showsMyLocationButton={true}
        >
          {positions.length > 0 && (
            <>
              <Polyline
                coordinates={positions}
                strokeColor={colors.primary}
                strokeWidth={5}
              />
              <Marker coordinate={positions[positions.length - 1]}>
                <View style={styles.marker}>
                  <Ionicons name="car-sport-outline" size={20} color="#fff" />
                </View>
              </Marker>
            </>
          )}
        </MapView>
      ) : (
        <View style={styles.loading}><Text>Getting location…</Text></View>
      )}

      <View style={styles.hud}>
        <View style={styles.hudRow}>
          <Text style={styles.hudLabel}>Speed</Text>
          <Text style={styles.hudValue}>{speedKph} kph</Text>
        </View>
        <View style={styles.hudRow}>
          <Text style={styles.hudLabel}>Odometer</Text>
          <Text style={styles.hudValue}>{odometerKm.toFixed(3)} km</Text>
        </View>

        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          <TouchableOpacity onPress={startBackgroundTracking} style={styles.bgBtn}>
            <Ionicons name="play-outline" size={18} color="#fff" />
            <Text style={styles.bgBtnText}>Start BG</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={stopBackgroundTracking} style={[styles.bgBtn, { backgroundColor: '#6c757d' }]}>
            <Ionicons name="stop-outline" size={18} color="#fff" />
            <Text style={styles.bgBtnText}>Stop BG</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.centerBtn}
          onPress={() => {
            if (positions.length) {
              const last = positions[positions.length - 1];
              mapRef.current?.animateCamera({ center: last }, { duration: 300 });
            }
          }}
        >
          <Ionicons name="locate-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  marker: {
    backgroundColor: colors.primary,
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.ivory1,
  },
  hud: {
    position: 'absolute',
    left: spacing.small,
    right: spacing.small,
    bottom: spacing.small,
    backgroundColor: colors.ivory4,
    padding: spacing.small,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ivory3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    elevation: 4,
  },
  hudRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  hudLabel: { color: colors.orangeShade5 },
  hudValue: { fontWeight: '700', color: colors.orangeShade7 },
  centerBtn: {
    position: 'absolute',
    right: spacing.small,
    bottom: spacing.small,
    backgroundColor: colors.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#28a745',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  bgBtnText: { color: '#fff', marginLeft: 6, fontWeight: '600' },
});