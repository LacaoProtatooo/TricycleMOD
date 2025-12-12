import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Easing } from 'react-native';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE, AnimatedRegion, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../components/common/theme';

// ensure background task is registered at runtime
import '../../components/services/BackgroundLocationTask';
import { BG_TASK_NAME } from '../../components/services/BackgroundLocationTask';

const KM_KEY = 'vehicle_current_km_v1';

const TERMINALS = [
  { id: 'terminal-1', name: 'Terminal 1', latitude: 14.511445966700096, longitude: 121.03384457224557, radiusMeters: 120 },
  { id: 'terminal-2', name: 'Terminal 2', latitude: 14.513932064735052, longitude: 121.04019584947487, radiusMeters: 120 },
  { id: 'terminal-3', name: 'Terminal 3', latitude: 14.514534704611194, longitude: 121.04273098634214, radiusMeters: 120 },
];

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

function headingBetween(a, b) {
  if (!a || !b) return 0;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;
  const φ1 = toRad(a.latitude);
  const φ2 = toRad(b.latitude);
  const λ1 = toRad(a.longitude);
  const λ2 = toRad(b.longitude);
  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function segmentDurationMs(meters) {
  if (!meters || Number.isNaN(meters)) return 600;
  const seconds = Math.min(Math.max(meters / 22, 0.4), 1.8);
  return seconds * 1000;
}

export default function TrackingMap({ follow = true, onEnterTerminalZone, odometerSeed }) {
  const mapRef = useRef(null);
  const [region, setRegion] = useState(null);
  const [positions, setPositions] = useState([]);
  const [speedKph, setSpeedKph] = useState(0);
  const [odometerKm, setOdometerKm] = useState(0);
  const lastPosRef = useRef(null);
  const watchRef = useRef(null);
  const reliveMarker = useRef(new AnimatedRegion({ latitude: 0, longitude: 0 })).current;
  const [reliveActive, setReliveActive] = useState(false);
  const [reliveProgress, setReliveProgress] = useState(0);
  const reliveIndexRef = useRef(0);
  const relivePathRef = useRef([]);
  const reliveActiveRef = useRef(false);
  const insideTerminalRef = useRef(null);
  const onEnterRef = useRef(onEnterTerminalZone);
  const seedRef = useRef(null);

  useEffect(() => {
    onEnterRef.current = onEnterTerminalZone;
  }, [onEnterTerminalZone]);

  useEffect(() => {
    const seed = typeof odometerSeed === 'number' && !Number.isNaN(odometerSeed) ? odometerSeed : null;
    if (seed === null) return;
    seedRef.current = seed;
    setOdometerKm((prev) => {
      if (seed > prev) {
        AsyncStorage.setItem(KM_KEY, String(seed)).catch(() => {});
        return seed;
      }
      return prev;
    });
  }, [odometerSeed]);

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

          if (follow && !reliveActiveRef.current && mapRef.current) {
            mapRef.current.animateCamera({ center: { latitude, longitude } }, { duration: 300 });
          }

          // Detect entry into any terminal geofence and notify once per entry
          let inside = false;
          for (const t of TERMINALS) {
            const dist = haversineMeters(newPoint, { latitude: t.latitude, longitude: t.longitude });
            if (dist <= t.radiusMeters) {
              inside = true;
              if (insideTerminalRef.current !== t.id) {
                insideTerminalRef.current = t.id;
                if (onEnterRef.current) {
                  onEnterRef.current(t);
                }
              }
              break;
            }
          }
          if (!inside && insideTerminalRef.current) {
            insideTerminalRef.current = null;
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

  useEffect(() => {
    reliveActiveRef.current = reliveActive;
  }, [reliveActive]);

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

  const stopReliveMode = useCallback((restoreCamera = true) => {
    if (reliveMarker?.stopAnimation) {
      reliveMarker.stopAnimation();
    }
    reliveActiveRef.current = false;
    setReliveActive(false);
    setReliveProgress(0);
    reliveIndexRef.current = 0;
    if (restoreCamera && positions.length) {
      const last = positions[positions.length - 1];
      mapRef.current?.animateCamera({ center: last, pitch: 0, heading: 0, zoom: 16 }, { duration: 600 });
    }
  }, [positions, reliveMarker]);

  const animateReliveSegment = useCallback(() => {
    if (!reliveActiveRef.current) return;
    const path = relivePathRef.current;
    const idx = reliveIndexRef.current;
    if (!path || path.length < 2 || idx >= path.length - 1) {
      stopReliveMode();
      return;
    }

    const start = path[idx];
    const end = path[idx + 1];
    const meters = haversineMeters(start, end);
    const duration = segmentDurationMs(meters);
    const heading = headingBetween(start, end);

    reliveMarker.timing({
      latitude: end.latitude,
      longitude: end.longitude,
      duration,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished || !reliveActiveRef.current) return;
      reliveIndexRef.current += 1;
      const totalSegments = Math.max(path.length - 1, 1);
      setReliveProgress(reliveIndexRef.current / totalSegments);
      requestAnimationFrame(animateReliveSegment);
    });

    mapRef.current?.animateCamera(
      {
        center: end,
        heading,
        pitch: 65,
        zoom: 18,
      },
      { duration }
    );
  }, [reliveMarker, stopReliveMode]);

  const startReliveMode = useCallback(() => {
    if (positions.length < 2) {
      Alert.alert('Relive mode', 'Record a short trip first before playing the 3D flyover.');
      return;
    }
    if (reliveActiveRef.current) return;

    const snapshot = [...positions];
    relivePathRef.current = snapshot;
    reliveIndexRef.current = 0;
    if (reliveMarker?.stopAnimation) {
      reliveMarker.stopAnimation();
    }
    if (reliveMarker?.setValue) {
      reliveMarker.setValue(snapshot[0]);
    }

    setReliveProgress(0);
    reliveActiveRef.current = true;
    setReliveActive(true);

    mapRef.current?.animateCamera(
      {
        center: snapshot[0],
        pitch: 65,
        heading: 0,
        zoom: 18,
      },
      { duration: 600 }
    );

    requestAnimationFrame(animateReliveSegment);
  }, [animateReliveSegment, positions, reliveMarker]);

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
          {TERMINALS.map((t) => (
            <React.Fragment key={t.id}>
              <Circle
                center={{ latitude: t.latitude, longitude: t.longitude }}
                radius={t.radiusMeters}
                strokeColor="rgba(255,102,0,0.6)"
                fillColor="rgba(255,102,0,0.15)"
              />
              <Marker
                coordinate={{ latitude: t.latitude, longitude: t.longitude }}
                title={t.name}
                description={t.id}
              >
                <View style={styles.terminalMarker}>
                  <Ionicons name="flag" size={16} color="#fff" />
                </View>
              </Marker>
            </React.Fragment>
          ))}

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

          {reliveActive && (
            <Marker.Animated coordinate={reliveMarker} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.reliveMarker}>
                <Ionicons name="navigate" size={18} color="#fff" />
              </View>
            </Marker.Animated>
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

          <TouchableOpacity
            onPress={reliveActive ? () => stopReliveMode() : startReliveMode}
            style={[styles.bgBtn, { backgroundColor: '#0d6efd' }]}
          >
            <Ionicons name={reliveActive ? 'stop-circle-outline' : 'film-outline'} size={18} color="#fff" />
            <Text style={styles.bgBtnText}>{reliveActive ? 'Stop Relive' : 'Relive 3D'}</Text>
          </TouchableOpacity>
        </View>

        {reliveActive && (
          <View style={styles.relivePanel}>
            <Text style={styles.reliveLabel}>3D Route Animation</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.min(Math.max(reliveProgress, 0), 1) * 100}%` }]} />
            </View>
            <Text style={styles.relivePercent}>{Math.round(reliveProgress * 100)}%</Text>
          </View>
        )}

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
  terminalMarker: {
    backgroundColor: '#f97316',
    padding: 6,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#fff',
  },
  reliveMarker: {
    backgroundColor: '#0d6efd',
    padding: 10,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
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
  relivePanel: {
    marginTop: spacing.small,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: spacing.small,
  },
  reliveLabel: {
    fontWeight: '600',
    color: colors.orangeShade7,
    marginBottom: 4,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.ivory2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0d6efd',
  },
  relivePercent: {
    textAlign: 'right',
    marginTop: 4,
    fontWeight: '700',
    color: colors.primary,
  },
});