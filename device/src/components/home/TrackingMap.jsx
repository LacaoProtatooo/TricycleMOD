import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Easing, PanResponder, Modal, FlatList, ActivityIndicator, Share, Linking, Animated as RNAnimated, Platform } from 'react-native';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE, AnimatedRegion, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { colors, spacing } from '../../components/common/theme';
import { API_URL } from '../../utils/config';

// ensure background task is registered at runtime
import '../../components/services/BackgroundLocationTask';
import { BG_TASK_NAME } from '../../components/services/BackgroundLocationTask';

const BASE_URL = API_URL;

const KM_KEY = 'vehicle_current_km_v1';
const DEVICE_ID_KEY = 'driver_tracking_device_id_v1';
const ACTIVE_TRIP_KEY = 'driver_tracking_active_trip_v1';
const BOOKING_TRIGGER_RECORDING_KEY = 'booking_trigger_recording_v1';

// Sync settings
const SYNC_INTERVAL_MS = 30000;
const SYNC_BATCH_SIZE = 50;

// Format duration to readable string
function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

// Format date for display
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const TERMINALS = [
  { id: 'terminal-1', name: 'Terminal 1', latitude: 14.511445966700096, longitude: 121.03384457224557, radiusMeters: 120 },
  { id: 'terminal-2', name: 'Terminal 2', latitude: 14.513932064735052, longitude: 121.04019584947487, radiusMeters: 120 },
  { id: 'terminal-3', name: 'Terminal 3', latitude: 14.514534704611194, longitude: 121.04273098634214, radiusMeters: 120 },
  { id: 'terminal-4', name: 'Terminal 4', latitude: 14.514546, longitude: 121.041421, radiusMeters: 120 },
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

// Generate interpolated route for simulation
function generateSimulatedRoute(start, end, numPoints = 30) {
  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const ratio = i / numPoints;
    points.push({
      latitude: start.latitude + (end.latitude - start.latitude) * ratio,
      longitude: start.longitude + (end.longitude - start.longitude) * ratio,
      timestamp: Date.now() + (i * 2000),
    });
  }
  return points;
}

export default function TrackingMap({ follow = true, onEnterTerminalZone, odometerSeed, codingDayRestricted = false }) {
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
  const [reliveSpeed, setReliveSpeed] = useState(1);
  const [relivePaused, setRelivePaused] = useState(false);
  const [reliveTimestamp, setReliveTimestamp] = useState(null);
  const reliveIndexRef = useRef(0);
  const relivePathRef = useRef([]);
  const reliveActiveRef = useRef(false);
  const relivePausedRef = useRef(false);
  const reliveSpeedRef = useRef(1);
  const [scrubTooltip, setScrubTooltip] = useState(null);
  const [reliveTraversedPath, setReliveTraversedPath] = useState([]);
  const [mapType, setMapType] = useState(Platform.OS === 'ios' ? 'mutedStandard' : 'standard');
  const progressBarRef = useRef(null);
  const progressBarWidth = useRef(0);
  const insideTerminalRef = useRef(null);
  const onEnterRef = useRef(onEnterTerminalZone);
  const seedRef = useRef(null);

  // Additional GPS stats
  const [altitude, setAltitude] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [heading, setHeading] = useState(0);

  // Retractable stats panel
  const [statsExpanded, setStatsExpanded] = useState(false);
  const statsAnim = useRef(new RNAnimated.Value(0)).current;

  // Trip recording state
  const [isRecording, setIsRecording] = useState(false);
  const [activeTripId, setActiveTripId] = useState(null);
  const [recordedPositions, setRecordedPositions] = useState([]);
  const [tripDistance, setTripDistance] = useState(0);
  const [tripDuration, setTripDuration] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  const syncIntervalRef = useRef(null);
  const recordedPosRef = useRef([]);
  const tripStartRef = useRef(null);
  const distanceRef = useRef(0);
  const activeTripIdRef = useRef(null);

  // Trip history state
  const [showHistory, setShowHistory] = useState(false);
  const [tripHistory, setTripHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Map ready state - prevents rendering children before map is initialized
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    onEnterRef.current = onEnterTerminalZone;
  }, [onEnterTerminalZone]);

  // Toggle stats panel animation
  useEffect(() => {
    RNAnimated.timing(statsAnim, {
      toValue: statsExpanded ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [statsExpanded]);

  // Initialize device ID and check for active trip
  useEffect(() => {
    initializeDeviceTracking();
  }, []);

  // Check for booking trigger to auto-start recording
  useEffect(() => {
    let checkInterval;
    
    const checkBookingTrigger = async () => {
      try {
        const triggerData = await AsyncStorage.getItem(BOOKING_TRIGGER_RECORDING_KEY);
        if (triggerData && !isRecording) {
          const { shouldStart, bookingId, passengerName, timestamp } = JSON.parse(triggerData);
          
          // Only trigger if the request is recent (within 30 seconds)
          if (shouldStart && (Date.now() - timestamp) < 30000) {
            console.log('Auto-starting recording from booking trigger');
            
            // Clear the trigger immediately to prevent re-triggering
            await AsyncStorage.removeItem(BOOKING_TRIGGER_RECORDING_KEY);
            
            // Auto-start recording with booking info
            await startRecordingFromBooking(bookingId, passengerName);
          } else if (shouldStart) {
            // Clear stale trigger
            await AsyncStorage.removeItem(BOOKING_TRIGGER_RECORDING_KEY);
          }
        }
      } catch (error) {
        console.error('Error checking booking trigger:', error);
      }
    };
    
    // Check immediately and then every 2 seconds
    checkBookingTrigger();
    checkInterval = setInterval(checkBookingTrigger, 2000);
    
    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [isRecording, deviceId]);

  // Update trip duration while recording
  useEffect(() => {
    let interval;
    if (isRecording && tripStartRef.current) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - tripStartRef.current) / 1000);
        setTripDuration(elapsed);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const initializeDeviceTracking = async () => {
    try {
      // Get or create device ID
      let storedDeviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (!storedDeviceId) {
        const appId = Application.applicationId || 'tricyclemod-driver';
        storedDeviceId = `driver_${appId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        await AsyncStorage.setItem(DEVICE_ID_KEY, storedDeviceId);
      }
      setDeviceId(storedDeviceId);

      // Check for active trip
      const activeTripData = await AsyncStorage.getItem(ACTIVE_TRIP_KEY);
      if (activeTripData) {
        const { tripId, startTime, positions: savedPositions } = JSON.parse(activeTripData);
        setActiveTripId(tripId);
        activeTripIdRef.current = tripId;
        setIsRecording(true);
        tripStartRef.current = startTime;
        recordedPosRef.current = savedPositions || [];
        setRecordedPositions(savedPositions || []);

        // Recalculate distance
        let dist = 0;
        for (let i = 1; i < savedPositions?.length; i++) {
          dist += haversineMeters(savedPositions[i - 1], savedPositions[i]);
        }
        distanceRef.current = dist;
        setTripDistance(dist);

        // Start sync interval
        syncIntervalRef.current = setInterval(syncToServer, SYNC_INTERVAL_MS);
      }
    } catch (error) {
      console.error('Error initializing device tracking:', error);
    }
  };

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
          const { latitude, longitude, speed, altitude: alt, accuracy: acc, heading: hdg } = loc.coords;
          const newPoint = { latitude, longitude };
          setPositions((p) => {
            const next = [...p, newPoint].slice(-5000);
            return next;
          });

          // Update additional GPS stats
          setAltitude(alt ? Math.round(alt * 10) / 10 : 0);
          setAccuracy(acc ? Math.round(acc * 10) / 10 : 0);
          setHeading(hdg ? Math.round(hdg) : 0);

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
                const nextKm = Math.round(prev + meters / 1000);
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

          // Handle trip recording
          if (activeTripIdRef.current) {
            const newCoord = {
              latitude,
              longitude,
              altitude: alt || 0,
              accuracy: acc || 0,
              speed: speed || 0,
              heading: hdg || 0,
              timestamp: loc.timestamp || Date.now(),
            };

            // Calculate distance from last recorded position
            if (recordedPosRef.current.length > 0) {
              const lastRecorded = recordedPosRef.current[recordedPosRef.current.length - 1];
              const meters = haversineMeters(lastRecorded, newCoord);

              // Filter GPS jitter
              if (meters >= 1 && meters <= 500) {
                distanceRef.current += meters;
                setTripDistance(distanceRef.current);
                recordedPosRef.current.push(newCoord);
                setRecordedPositions([...recordedPosRef.current]);
                updateLocalStorage();
              }
            }
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

  useEffect(() => {
    relivePausedRef.current = relivePaused;
  }, [relivePaused]);

  useEffect(() => {
    reliveSpeedRef.current = reliveSpeed;
  }, [reliveSpeed]);

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

  // ============== TRIP RECORDING ==============

  const updateLocalStorage = async () => {
    try {
      if (activeTripIdRef.current) {
        await AsyncStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify({
          tripId: activeTripIdRef.current,
          startTime: tripStartRef.current,
          positions: recordedPosRef.current.slice(-200),
        }));
      }
    } catch (error) {
      console.error('Error updating local storage:', error);
    }
  };

  const syncToServer = async () => {
    if (!activeTripIdRef.current || isSyncing) return;

    const coordsToSync = recordedPosRef.current.slice(-SYNC_BATCH_SIZE);
    if (coordsToSync.length < 5) return;

    setIsSyncing(true);
    try {
      await axios.post(`${BASE_URL}/api/tracking/${activeTripIdRef.current}/sync`, {
        coordinates: coordsToSync,
      });
      console.log(`Synced ${coordsToSync.length} coordinates`);
    } catch (error) {
      console.error('Sync error:', error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const startRecording = async () => {
    // Check if coding day restriction is active
    if (codingDayRestricted) {
      Alert.alert(
        'Coding Day Restriction',
        'You cannot start a trip on your coding day. Please wait until tomorrow to operate this tricycle.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (isRecording) {
      Alert.alert('Recording', 'Trip recording is already active');
      return;
    }

    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });

      const initialCoord = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        altitude: loc.coords.altitude || 0,
        accuracy: loc.coords.accuracy || 0,
        speed: loc.coords.speed || 0,
        heading: loc.coords.heading || 0,
        timestamp: Date.now(),
      };

      // Start trip on server
      const response = await axios.post(`${BASE_URL}/api/tracking/start`, {
        deviceId,
        name: `Driver Trip ${new Date().toLocaleDateString()}`,
        initialCoordinate: initialCoord,
      });

      if (!response.data.success) {
        throw new Error(response.data.message);
      }

      const { tripId, startTime } = response.data;

      // Initialize recording state
      setActiveTripId(tripId);
      activeTripIdRef.current = tripId;
      setIsRecording(true);
      tripStartRef.current = new Date(startTime).getTime();
      recordedPosRef.current = [initialCoord];
      distanceRef.current = 0;
      setRecordedPositions([initialCoord]);
      setTripDistance(0);
      setTripDuration(0);

      // Save to AsyncStorage for persistence
      await AsyncStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify({
        tripId,
        startTime: tripStartRef.current,
        positions: [initialCoord],
      }));

      // Start sync interval
      syncIntervalRef.current = setInterval(syncToServer, SYNC_INTERVAL_MS);

      Alert.alert('Recording Started', 'Your trip is being recorded');
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', error.message || 'Failed to start recording');
    }
  };

  // Start recording triggered from booking screen (auto-start without alert)
  const startRecordingFromBooking = async (bookingId, passengerName) => {
    // Check if coding day restriction is active
    if (codingDayRestricted) {
      console.log('Cannot auto-start recording: Coding day restriction');
      return;
    }

    if (isRecording) {
      console.log('Recording already active, skipping auto-start');
      return;
    }

    if (!deviceId) {
      console.log('Device ID not ready, cannot start recording');
      return;
    }

    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });

      const initialCoord = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        altitude: loc.coords.altitude || 0,
        accuracy: loc.coords.accuracy || 0,
        speed: loc.coords.speed || 0,
        heading: loc.coords.heading || 0,
        timestamp: Date.now(),
      };

      // Start trip on server with booking info
      const tripName = passengerName 
        ? `Booking Trip - ${passengerName} ${new Date().toLocaleDateString()}`
        : `Booking Trip ${new Date().toLocaleDateString()}`;
        
      const response = await axios.post(`${BASE_URL}/api/tracking/start`, {
        deviceId,
        name: tripName,
        initialCoordinate: initialCoord,
        bookingId, // Include booking reference
      });

      if (!response.data.success) {
        throw new Error(response.data.message);
      }

      const { tripId, startTime } = response.data;

      // Initialize recording state
      setActiveTripId(tripId);
      activeTripIdRef.current = tripId;
      setIsRecording(true);
      tripStartRef.current = new Date(startTime).getTime();
      recordedPosRef.current = [initialCoord];
      distanceRef.current = 0;
      setRecordedPositions([initialCoord]);
      setTripDistance(0);
      setTripDuration(0);

      // Save to AsyncStorage for persistence
      await AsyncStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify({
        tripId,
        startTime: tripStartRef.current,
        positions: [initialCoord],
        bookingId,
      }));

      // Start sync interval
      syncIntervalRef.current = setInterval(syncToServer, SYNC_INTERVAL_MS);

      console.log('Auto-started recording from booking:', tripId);
    } catch (error) {
      console.error('Error auto-starting recording from booking:', error);
    }
  };

  const stopRecording = async () => {
    if (!isRecording || !activeTripIdRef.current) return;

    Alert.alert(
      'Stop Recording',
      'Do you want to save this trip?',
      [
        {
          text: 'Discard',
          style: 'destructive',
          onPress: discardTrip,
        },
        {
          text: 'Continue Recording',
          style: 'cancel',
        },
        {
          text: 'Save Trip',
          onPress: saveTrip,
        },
      ]
    );
  };

  const saveTrip = async () => {
    try {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }

      // Final sync
      const response = await axios.post(`${BASE_URL}/api/tracking/${activeTripIdRef.current}/end`, {
        finalCoordinates: recordedPosRef.current,
      });

      if (response.data.success) {
        const { trip } = response.data;
        Alert.alert(
          'Trip Saved!',
          `Distance: ${(trip.totalDistance / 1000).toFixed(2)} km\nDuration: ${trip.formattedDuration}`,
          [{ text: 'OK' }]
        );
      }

      // Clear state
      await AsyncStorage.removeItem(ACTIVE_TRIP_KEY);
      setIsRecording(false);
      setActiveTripId(null);
      activeTripIdRef.current = null;
      setRecordedPositions([]);
      setTripDistance(0);
      setTripDuration(0);
      recordedPosRef.current = [];
      tripStartRef.current = null;
      distanceRef.current = 0;

    } catch (error) {
      console.error('Error saving trip:', error);
      Alert.alert('Error', 'Failed to save trip. Your data is saved locally.');
    }
  };

  const discardTrip = async () => {
    try {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }

      // Cancel on server
      if (activeTripIdRef.current) {
        await axios.post(`${BASE_URL}/api/tracking/${activeTripIdRef.current}/cancel`);
      }

      // Clear state
      await AsyncStorage.removeItem(ACTIVE_TRIP_KEY);
      setIsRecording(false);
      setActiveTripId(null);
      activeTripIdRef.current = null;
      setRecordedPositions([]);
      setTripDistance(0);
      setTripDuration(0);
      recordedPosRef.current = [];
      tripStartRef.current = null;
      distanceRef.current = 0;

      Alert.alert('Discarded', 'Trip recording has been discarded');
    } catch (error) {
      console.error('Error discarding trip:', error);
    }
  };

  // ============== TRIP HISTORY ==============

  const loadTripHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await axios.get(`${BASE_URL}/api/tracking/history`, {
        params: { deviceId, limit: 50 },
      });

      if (response.data.success) {
        setTripHistory(response.data.trips);
      }
    } catch (error) {
      console.error('Error loading history:', error);
      Alert.alert('Error', 'Failed to load trip history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const openHistory = () => {
    setShowHistory(true);
    loadTripHistory();
  };

  const loadTripForRelive = async (trip) => {
    try {
      const response = await axios.get(`${BASE_URL}/api/tracking/${trip.tripId}`);
      if (response.data.success && response.data.trip.coordinates?.length >= 2) {
        // Set positions from trip data
        const coords = response.data.trip.coordinates.map(c => ({
          latitude: c.latitude,
          longitude: c.longitude,
          timestamp: c.timestamp,
          altitude: c.altitude,
        }));
        setPositions(coords);
        
        // Start relive mode after short delay
        setTimeout(() => {
          startReliveMode();
        }, 500);
      } else {
        Alert.alert('Error', 'Trip has insufficient data for playback');
      }
    } catch (error) {
      console.error('Error loading trip for relive:', error);
      Alert.alert('Error', 'Failed to load trip');
    }
  };

  // ============== GPX EXPORT ==============

  const exportTripGPX = async (trip) => {
    setIsExporting(true);
    try {
      const response = await axios.post(`${BASE_URL}/api/tracking/${trip.tripId}/export-gpx`);

      if (response.data.success) {
        const gpxUrl = response.data.gpxUrl;

        Alert.alert(
          'GPX Exported',
          'Your trip has been exported to GPX format.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Share',
              onPress: () => Share.share({
                message: `Check out my trip! Download GPX: ${gpxUrl}`,
                url: gpxUrl,
              }),
            },
            {
              text: 'Download',
              onPress: () => Linking.openURL(gpxUrl),
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error exporting GPX:', error);
      Alert.alert('Error', 'Failed to export GPX file');
    } finally {
      setIsExporting(false);
    }
  };

  const exportCurrentReliveGPX = async () => {
    if (!relivePathRef.current || relivePathRef.current.length < 2) {
      Alert.alert('No Data', 'No route data available to export');
      return;
    }

    setIsExporting(true);
    try {
      // Create GPX from current relive path
      const gpxContent = generateGPXContent(relivePathRef.current);
      
      // Upload to server for Cloudinary storage
      const response = await axios.post(`${BASE_URL}/api/tracking/export-relive-gpx`, {
        gpxContent,
        deviceId,
        name: `Relive_${new Date().toISOString().slice(0, 10)}`,
      });

      if (response.data.success) {
        const gpxUrl = response.data.gpxUrl;

        Alert.alert(
          'GPX Exported',
          'Your current route has been exported to GPX format.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Share',
              onPress: () => Share.share({
                message: `Check out my route! Download GPX: ${gpxUrl}`,
                url: gpxUrl,
              }),
            },
            {
              text: 'Download',
              onPress: () => Linking.openURL(gpxUrl),
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error exporting relive GPX:', error);
      Alert.alert('Error', 'Failed to export GPX file');
    } finally {
      setIsExporting(false);
    }
  };

  const generateGPXContent = (coords) => {
    const timestamp = new Date().toISOString();
    let trackPoints = coords.map(c => {
      const time = c.timestamp ? new Date(c.timestamp).toISOString() : timestamp;
      return `      <trkpt lat="${c.latitude}" lon="${c.longitude}">
        <ele>${c.altitude || 0}</ele>
        <time>${time}</time>
      </trkpt>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TricycleMOD Driver" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Driver Route Export</name>
    <time>${timestamp}</time>
  </metadata>
  <trk>
    <name>Route ${new Date().toLocaleDateString()}</name>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>`;
  };

  const stopReliveMode = useCallback((restoreCamera = true) => {
    if (reliveMarker?.stopAnimation) {
      reliveMarker.stopAnimation();
    }
    reliveActiveRef.current = false;
    relivePausedRef.current = false;
    setReliveActive(false);
    setRelivePaused(false);
    setReliveProgress(0);
    setReliveTimestamp(null);
    setReliveSpeed(1);
    setReliveTraversedPath([]);
    reliveSpeedRef.current = 1;
    reliveIndexRef.current = 0;
    if (restoreCamera && positions.length) {
      const last = positions[positions.length - 1];
      mapRef.current?.animateCamera({ center: last, pitch: 0, heading: 0, zoom: 16 }, { duration: 600 });
    }
  }, [positions, reliveMarker]);

  const animateReliveSegment = useCallback(() => {
    if (!reliveActiveRef.current || relivePausedRef.current) return;
    const path = relivePathRef.current;
    const idx = reliveIndexRef.current;
    if (!path || path.length < 2 || idx >= path.length - 1) {
      stopReliveMode();
      return;
    }

    const start = path[idx];
    const end = path[idx + 1];
    const meters = haversineMeters(start, end);
    const baseDuration = segmentDurationMs(meters);
    const duration = baseDuration / reliveSpeedRef.current;
    const heading = headingBetween(start, end);

    // Update timestamp based on position data or elapsed progress
    if (end.timestamp) {
      setReliveTimestamp(new Date(end.timestamp));
    } else {
      // Estimate time based on progress
      const startTime = path[0]?.timestamp ? new Date(path[0].timestamp) : new Date();
      const endTime = path[path.length - 1]?.timestamp ? new Date(path[path.length - 1].timestamp) : new Date(startTime.getTime() + path.length * 1000);
      const totalDuration = endTime.getTime() - startTime.getTime();
      const currentTime = new Date(startTime.getTime() + (idx / (path.length - 1)) * totalDuration);
      setReliveTimestamp(currentTime);
    }

    reliveMarker.timing({
      latitude: end.latitude,
      longitude: end.longitude,
      duration,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished || !reliveActiveRef.current) return;
      if (relivePausedRef.current) return;
      reliveIndexRef.current += 1;
      const totalSegments = Math.max(path.length - 1, 1);
      setReliveProgress(reliveIndexRef.current / totalSegments);
      setReliveTraversedPath(path.slice(0, reliveIndexRef.current + 1));
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
    setRelivePaused(false);
    relivePausedRef.current = false;
    reliveActiveRef.current = true;
    setReliveActive(true);
    setReliveTraversedPath([snapshot[0]]);
    setReliveTimestamp(snapshot[0]?.timestamp ? new Date(snapshot[0].timestamp) : new Date());

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

  const toggleRelivePause = useCallback(() => {
    if (!reliveActiveRef.current) return;
    const newPaused = !relivePausedRef.current;
    relivePausedRef.current = newPaused;
    setRelivePaused(newPaused);
    if (!newPaused) {
      requestAnimationFrame(animateReliveSegment);
    }
  }, [animateReliveSegment]);

  const seekRelive = useCallback((direction) => {
    if (!reliveActiveRef.current) return;
    const path = relivePathRef.current;
    if (!path || path.length < 2) return;

    const step = direction === 'forward' ? 10 : -10;
    let newIdx = reliveIndexRef.current + step;
    newIdx = Math.max(0, Math.min(newIdx, path.length - 1));
    reliveIndexRef.current = newIdx;

    const pos = path[newIdx];
    if (reliveMarker?.setValue) {
      reliveMarker.setValue(pos);
    }

    const totalSegments = Math.max(path.length - 1, 1);
    setReliveProgress(newIdx / totalSegments);
    setReliveTraversedPath(path.slice(0, newIdx + 1));

    if (pos.timestamp) {
      setReliveTimestamp(new Date(pos.timestamp));
    }

    const nextIdx = Math.min(newIdx + 1, path.length - 1);
    const heading = headingBetween(pos, path[nextIdx]);
    mapRef.current?.animateCamera(
      { center: pos, heading, pitch: 65, zoom: 18 },
      { duration: 300 }
    );

    if (!relivePausedRef.current) {
      requestAnimationFrame(animateReliveSegment);
    }
  }, [animateReliveSegment, reliveMarker]);

  const changeReliveSpeed = useCallback((speed) => {
    reliveSpeedRef.current = speed;
    setReliveSpeed(speed);
  }, []);

  const seekToPosition = useCallback((percentage) => {
    if (!reliveActiveRef.current) return;
    const path = relivePathRef.current;
    if (!path || path.length < 2) return;

    const clampedPct = Math.max(0, Math.min(1, percentage));
    const newIdx = Math.round(clampedPct * (path.length - 1));
    reliveIndexRef.current = newIdx;

    const pos = path[newIdx];
    if (reliveMarker?.setValue) {
      reliveMarker.setValue(pos);
    }

    const totalSegments = Math.max(path.length - 1, 1);
    setReliveProgress(newIdx / totalSegments);
    setReliveTraversedPath(path.slice(0, newIdx + 1));

    // Update timestamp
    if (pos.timestamp) {
      setReliveTimestamp(new Date(pos.timestamp));
    } else {
      const startTime = path[0]?.timestamp ? new Date(path[0].timestamp) : new Date();
      const endTime = path[path.length - 1]?.timestamp ? new Date(path[path.length - 1].timestamp) : new Date(startTime.getTime() + path.length * 1000);
      const totalDuration = endTime.getTime() - startTime.getTime();
      const currentTime = new Date(startTime.getTime() + clampedPct * totalDuration);
      setReliveTimestamp(currentTime);
    }

    const nextIdx = Math.min(newIdx + 1, path.length - 1);
    const heading = headingBetween(pos, path[nextIdx]);
    mapRef.current?.animateCamera(
      { center: pos, heading, pitch: 65, zoom: 18 },
      { duration: 300 }
    );
  }, [reliveMarker]);

  const getTooltipTime = useCallback((percentage) => {
    const path = relivePathRef.current;
    if (!path || path.length < 2) return null;

    const clampedPct = Math.max(0, Math.min(1, percentage));
    const idx = Math.round(clampedPct * (path.length - 1));
    const pos = path[idx];

    if (pos?.timestamp) {
      return new Date(pos.timestamp);
    } else {
      const startTime = path[0]?.timestamp ? new Date(path[0].timestamp) : new Date();
      const endTime = path[path.length - 1]?.timestamp ? new Date(path[path.length - 1].timestamp) : new Date(startTime.getTime() + path.length * 1000);
      const totalDuration = endTime.getTime() - startTime.getTime();
      return new Date(startTime.getTime() + clampedPct * totalDuration);
    }
  }, []);

  const progressPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => reliveActiveRef.current,
      onMoveShouldSetPanResponder: () => reliveActiveRef.current,
      onPanResponderGrant: (evt) => {
        if (!reliveActiveRef.current) return;
        // Pause while scrubbing
        relivePausedRef.current = true;
        setRelivePaused(true);
        
        const { locationX } = evt.nativeEvent;
        const width = progressBarWidth.current || 1;
        const pct = locationX / width;
        setScrubTooltip({ x: locationX, time: getTooltipTime(pct) });
        seekToPosition(pct);
      },
      onPanResponderMove: (evt) => {
        if (!reliveActiveRef.current) return;
        const { locationX } = evt.nativeEvent;
        const width = progressBarWidth.current || 1;
        const pct = Math.max(0, Math.min(1, locationX / width));
        setScrubTooltip({ x: Math.max(0, Math.min(locationX, width)), time: getTooltipTime(pct) });
        seekToPosition(pct);
      },
      onPanResponderRelease: () => {
        setScrubTooltip(null);
      },
      onPanResponderTerminate: () => {
        setScrubTooltip(null);
      },
    })
  ).current;

  // Handle map ready event
  const handleMapReady = useCallback(() => {
    setMapReady(true);
  }, []);

  return (
    <View style={styles.container}>
      {region ? (
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          mapType={mapType}
          initialRegion={region}
          showsUserLocation
          followsUserLocation={false}
          showsMyLocationButton={true}
          onMapReady={handleMapReady}
        >
          {/* Only render map children after map is ready */}
          {mapReady && (
            <>
              {/* Terminal Circles */}
              {TERMINALS.map((t) => (
                <Circle
                  key={`circle-${t.id}`}
                  center={{ latitude: t.latitude, longitude: t.longitude }}
                  radius={t.radiusMeters}
                  strokeColor="rgba(255,102,0,0.6)"
                  fillColor="rgba(255,102,0,0.15)"
                />
              ))}

              {/* Terminal Markers */}
              {TERMINALS.map((t) => (
                <Marker
                  key={`marker-${t.id}`}
                  coordinate={{ latitude: t.latitude, longitude: t.longitude }}
                  title={t.name}
                  description={t.id}
                >
                  <View style={styles.terminalMarker}>
                    <Ionicons name="flag" size={16} color="#fff" />
                  </View>
                </Marker>
              ))}

              {/* Current position polyline */}
              {positions.length > 0 && !reliveActive && (
                <Polyline
                  key="position-polyline"
                  coordinates={positions}
                  strokeColor={colors.primary}
                  strokeWidth={5}
                />
              )}

              {/* Current position marker */}
              {positions.length > 0 && !reliveActive && (
                <Marker
                  key="position-marker"
                  coordinate={positions[positions.length - 1]}
                >
                  <View style={styles.marker}>
                    <Ionicons name="bicycle" size={20} color="#fff" />
                  </View>
                </Marker>
              )}

              {/* Relive mode polyline - trail behind the icon showing traversed path */}
              {reliveActive && reliveTraversedPath.length > 1 && (
                <Polyline
                  key="relive-polyline"
                  coordinates={reliveTraversedPath}
                  strokeColor="#0d6efd"
                  strokeWidth={5}
                />
              )}

              {/* Relive mode animated marker */}
              {reliveActive && relivePathRef.current.length > 0 && (
                <Marker.Animated
                  key="relive-marker"
                  coordinate={reliveMarker}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={styles.reliveMarker}>
                    <Ionicons name="navigate" size={18} color="#fff" />
                  </View>
                </Marker.Animated>
              )}

              {/* Recorded path for trip recording */}
              {recordedPositions.length > 1 && isRecording && (
                <Polyline
                  key="recording-polyline"
                  coordinates={recordedPositions}
                  strokeColor="#dc3545"
                  strokeWidth={4}
                />
              )}
            </>
          )}
        </MapView>
      ) : (
        <View style={styles.loading}><Text>Getting location…</Text></View>
      )}

      {/* Recording Info Panel */}
      {isRecording && (
        <View style={styles.recordingPanel}>
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>Recording Trip</Text>
            {isSyncing && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />}
          </View>
          <View style={styles.recordingStats}>
            <View style={styles.recordingStat}>
              <Text style={styles.recordingStatValue}>{(tripDistance / 1000).toFixed(2)}</Text>
              <Text style={styles.recordingStatLabel}>km</Text>
            </View>
            <View style={styles.recordingStatDivider} />
            <View style={styles.recordingStat}>
              <Text style={styles.recordingStatValue}>{formatDuration(tripDuration)}</Text>
              <Text style={styles.recordingStatLabel}>duration</Text>
            </View>
            <View style={styles.recordingStatDivider} />
            <View style={styles.recordingStat}>
              <Text style={styles.recordingStatValue}>{recordedPositions.length}</Text>
              <Text style={styles.recordingStatLabel}>points</Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.hud}>
        {/* Retractable GPS Stats Panel - Now below the map */}
        <TouchableOpacity
          style={styles.statsToggle}
          onPress={() => setStatsExpanded(!statsExpanded)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={statsExpanded ? 'chevron-down' : 'chevron-up'}
            size={20}
            color={colors.primary}
          />
          <Text style={styles.statsToggleText}>
            {statsExpanded ? 'Hide Stats' : 'Show Stats'}
          </Text>
        </TouchableOpacity>

        <RNAnimated.View
          style={[
            styles.statsPanelInline,
            {
              height: statsAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 100],
              }),
              opacity: statsAnim,
            },
          ]}
        >
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Ionicons name="speedometer-outline" size={16} color={colors.primary} />
              <Text style={styles.statLabel}>Speed</Text>
              <Text style={styles.statValue}>{speedKph} km/h</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="compass-outline" size={16} color={colors.primary} />
              <Text style={styles.statLabel}>Heading</Text>
              <Text style={styles.statValue}>{heading}°</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="arrow-up-outline" size={16} color={colors.primary} />
              <Text style={styles.statLabel}>Altitude</Text>
              <Text style={styles.statValue}>{altitude} m</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="radio-outline" size={16} color={colors.primary} />
              <Text style={styles.statLabel}>Accuracy</Text>
              <Text style={styles.statValue}>±{accuracy} m</Text>
            </View>
          </View>
        </RNAnimated.View>

        <View style={styles.hudRow}>
          <Text style={styles.hudLabel}>Speed</Text>
          <Text style={styles.hudValue}>{speedKph} kph</Text>
        </View>
        <View style={styles.hudRow}>
          <Text style={styles.hudLabel}>Odometer</Text>
          <Text style={styles.hudValue}>{Math.round(odometerKm)} km</Text>
        </View>

        {/* Trip Recording Controls */}
        <View style={styles.recordingControls}>
          <TouchableOpacity
            onPress={isRecording ? stopRecording : startRecording}
            style={[
              styles.recordBtn,
              isRecording && styles.recordBtnActive,
            ]}
          >
            <Ionicons
              name={isRecording ? 'stop-circle' : 'radio-button-on'}
              size={20}
              color="#fff"
            />
            <Text style={styles.recordBtnText}>
              {isRecording ? 'Stop' : 'Record'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={openHistory}
            style={styles.historyBtn}
          >
            <Ionicons name="time-outline" size={20} color="#fff" />
            <Text style={styles.historyBtnText}>History</Text>
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

        <TouchableOpacity
          style={styles.mapTypeBtn}
          onPress={() => {
            setMapType((prev) => {
              if (prev === 'standard') return 'satellite';
              if (prev === 'satellite') return 'hybrid';
              return 'standard';
            });
          }}
        >
          <Ionicons
            name={mapType === 'satellite' ? 'earth' : mapType === 'hybrid' ? 'globe' : 'map-outline'}
            size={20}
            color="#fff"
          />
        </TouchableOpacity>
      </View>

      {/* Relive Panel - Compact bottom bar */}
      {reliveActive && (
        <View style={styles.relivePanel}>
          {/* Top Row: Progress bar with timestamp */}
          <View style={styles.reliveProgressRow}>
            <Text style={styles.reliveTimestamp}>
              {reliveTimestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) || '--:--'}
            </Text>
            <View style={styles.progressContainer}>
              {scrubTooltip && (
                <View style={[styles.scrubTooltip, { left: Math.max(0, Math.min(scrubTooltip.x - 35, progressBarWidth.current - 70)) }]}>
                  <Text style={styles.scrubTooltipText}>
                    {scrubTooltip.time?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '--:--'}
                  </Text>
                </View>
              )}
              <View
                ref={progressBarRef}
                style={styles.progressTrack}
                onLayout={(e) => { progressBarWidth.current = e.nativeEvent.layout.width; }}
                {...progressPanResponder.panHandlers}
              >
                <View style={[styles.progressFill, { width: `${Math.min(Math.max(reliveProgress, 0), 1) * 100}%` }]} />
                <View style={[styles.scrubHandle, { left: `${Math.min(Math.max(reliveProgress, 0), 1) * 100}%` }]} />
              </View>
            </View>
            <Text style={styles.relivePercent}>{Math.round(reliveProgress * 100)}%</Text>
          </View>
          
          {/* Bottom Row: Controls */}
          <View style={styles.reliveControlsRow}>
            {/* Close */}
            <TouchableOpacity onPress={() => stopReliveMode()} style={styles.reliveCloseBtn}>
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
            
            {/* Seek Backward */}
            <TouchableOpacity onPress={() => seekRelive('backward')} style={styles.reliveControlBtn}>
              <Ionicons name="play-back" size={16} color="#fff" />
            </TouchableOpacity>
            
            {/* Play/Pause */}
            <TouchableOpacity onPress={toggleRelivePause} style={styles.relivePlayBtn}>
              <Ionicons name={relivePaused ? 'play' : 'pause'} size={20} color="#fff" />
            </TouchableOpacity>
            
            {/* Seek Forward */}
            <TouchableOpacity onPress={() => seekRelive('forward')} style={styles.reliveControlBtn}>
              <Ionicons name="play-forward" size={16} color="#fff" />
            </TouchableOpacity>
            
            {/* Speed Buttons */}
            <View style={styles.speedControls}>
              {[1, 2, 4].map((speed) => (
                <TouchableOpacity
                  key={speed}
                  onPress={() => changeReliveSpeed(speed)}
                  style={[styles.speedBtn, reliveSpeed === speed && styles.speedBtnActive]}
                >
                  <Text style={[styles.speedBtnText, reliveSpeed === speed && styles.speedBtnTextActive]}>{speed}x</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* GPX Export */}
            <TouchableOpacity onPress={exportCurrentReliveGPX} style={styles.exportReliveBtn} disabled={isExporting}>
              {isExporting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="download-outline" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Trip History Modal */}
      <Modal
        visible={showHistory}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowHistory(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Trip History</Text>
              <TouchableOpacity onPress={() => setShowHistory(false)}>
                <Ionicons name="close" size={28} color={colors.orangeShade7} />
              </TouchableOpacity>
            </View>

            {loadingHistory ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : tripHistory.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Ionicons name="trail-sign-outline" size={64} color={colors.ivory3} />
                <Text style={styles.modalEmptyText}>No trips recorded yet</Text>
                <Text style={styles.modalEmptySubtext}>
                  Start recording to see your trips here
                </Text>
              </View>
            ) : (
              <FlatList
                data={tripHistory}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.historyItem}
                    onPress={() => {
                      setShowHistory(false);
                      // Load trip for relive from history
                      loadTripForRelive(item);
                    }}
                  >
                    <View style={styles.historyItemLeft}>
                      <Ionicons name="navigate-circle" size={32} color={colors.primary} />
                    </View>
                    <View style={styles.historyItemCenter}>
                      <Text style={styles.historyItemTitle}>
                        {item.name || `Trip ${item.tripId?.slice(0, 12) || 'Unknown'}`}
                      </Text>
                      <Text style={styles.historyItemDate}>{formatDate(item.startTime)}</Text>
                      <View style={styles.historyItemStats}>
                        <Text style={styles.historyItemStat}>
                          <Ionicons name="speedometer-outline" size={12} /> {((item.totalDistance || 0) / 1000).toFixed(2)} km
                        </Text>
                        <Text style={styles.historyItemStat}>
                          <Ionicons name="time-outline" size={12} /> {formatDuration(item.duration)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.historyItemRight}>
                      <TouchableOpacity
                        style={styles.exportBtn}
                        onPress={(e) => {
                          e.stopPropagation();
                          exportTripGPX(item);
                        }}
                      >
                        <Ionicons name="download-outline" size={20} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                )}
                keyExtractor={(item) => item.tripId || item._id}
                contentContainerStyle={styles.historyList}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Export Loading Overlay */}
      {isExporting && (
        <View style={styles.exportOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.exportOverlayText}>Exporting GPX...</Text>
        </View>
      )}
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
  hudRow: { flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 6 },
  hudLabel: { color: colors.orangeShade5, marginRight: 8 },
  hudValue: { fontWeight: '700', color: colors.orangeShade7 },
  centerBtn: {
    position: 'absolute',
    right: spacing.small,
    bottom: spacing.small + 98,
    backgroundColor: colors.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapTypeBtn: {
    position: 'absolute',
    right: spacing.small,
    bottom: spacing.small + 52,
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
  progressContainer: {
    position: 'relative',
    marginVertical: 8,
  },
  progressTrack: {
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.ivory2,
    justifyContent: 'center',
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0d6efd',
    borderRadius: 10,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  scrubHandle: {
    position: 'absolute',
    top: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#0d6efd',
    marginLeft: -14,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  scrubTooltip: {
    position: 'absolute',
    bottom: 32,
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    zIndex: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  scrubTooltipText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  scrubTooltipArrow: {
    position: 'absolute',
    bottom: -6,
    left: '50%',
    marginLeft: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(0,0,0,0.85)',
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  progressLabelText: {
    fontSize: 10,
    color: colors.orangeShade5,
  },
  relivePercent: {
    textAlign: 'right',
    marginTop: 4,
    fontWeight: '700',
    color: colors.primary,
  },
  reliveTimestamp: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: colors.orangeShade7,
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  reliveControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  reliveControlBtn: {
    backgroundColor: '#0d6efd',
    padding: 10,
    borderRadius: 20,
  },
  relivePlayBtn: {
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: 24,
  },
  speedControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  speedLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.orangeShade6,
    marginRight: 4,
  },
  speedBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.ivory2,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  speedBtnActive: {
    backgroundColor: '#0d6efd',
    borderColor: '#0d6efd',
  },
  speedBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.orangeShade6,
  },
  speedBtnTextActive: {
    color: '#fff',
  },
  // Retractable Stats Panel (now inline in HUD)
  statsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ivory2,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  statsToggleText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  statsPanel: {
    position: 'absolute',
    top: 50,
    left: spacing.small,
    right: spacing.small,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    padding: spacing.small,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  statsPanelInline: {
    backgroundColor: colors.ivory2,
    borderRadius: 8,
    paddingHorizontal: spacing.small,
    paddingTop: spacing.small,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.ivory4,
    padding: 6,
    borderRadius: 8,
    marginHorizontal: 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  statLabel: {
    fontSize: 9,
    color: colors.orangeShade5,
    marginTop: 1,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.orangeShade7,
    marginTop: 1,
  },
  // Recording Panel
  recordingPanel: {
    position: 'absolute',
    top: 10,
    left: spacing.medium,
    right: spacing.medium,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    padding: spacing.medium,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#dc3545',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.small,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#dc3545',
    marginRight: 8,
  },
  recordingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc3545',
  },
  recordingStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  recordingStat: {
    alignItems: 'center',
  },
  recordingStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.orangeShade7,
  },
  recordingStatLabel: {
    fontSize: 11,
    color: colors.orangeShade5,
  },
  recordingStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.ivory3,
  },
  // Recording Controls
  recordingControls: {
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 8,
  },
  recordBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
  },
  recordBtnActive: {
    backgroundColor: '#dc3545',
  },
  recordBtnText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: '600',
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6c757d',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  historyBtnText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: '600',
  },
  // Relive Panel - Compact bottom bar
  relivePanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(30,30,30,0.95)',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  reliveProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reliveTimestamp: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'monospace',
    width: 60,
  },
  progressContainer: {
    flex: 1,
    position: 'relative',
    marginHorizontal: 8,
  },
  progressTrack: {
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0d6efd',
    borderRadius: 8,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  scrubHandle: {
    position: 'absolute',
    top: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#0d6efd',
    marginLeft: -12,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  scrubTooltip: {
    position: 'absolute',
    bottom: 24,
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 10,
  },
  scrubTooltipText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  relivePercent: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0d6efd',
    width: 36,
    textAlign: 'right',
  },
  reliveControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  reliveCloseBtn: {
    backgroundColor: '#dc3545',
    padding: 8,
    borderRadius: 20,
  },
  reliveControlBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 8,
    borderRadius: 20,
  },
  relivePlayBtn: {
    backgroundColor: '#0d6efd',
    padding: 10,
    borderRadius: 22,
  },
  speedControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 4,
  },
  speedBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  speedBtnActive: {
    backgroundColor: '#0d6efd',
  },
  speedBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
  },
  speedBtnTextActive: {
    color: '#fff',
  },
  exportReliveBtn: {
    backgroundColor: '#28a745',
    padding: 8,
    borderRadius: 20,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.ivory1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.large,
    borderBottomWidth: 1,
    borderBottomColor: colors.ivory3,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.orangeShade7,
  },
  modalLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  modalEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  modalEmptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.orangeShade5,
    marginTop: spacing.medium,
  },
  modalEmptySubtext: {
    fontSize: 14,
    color: colors.orangeShade4,
    marginTop: 4,
  },
  historyList: {
    padding: spacing.medium,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ivory4,
    borderRadius: 12,
    padding: spacing.medium,
    marginBottom: spacing.small,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  historyItemLeft: {
    marginRight: spacing.medium,
  },
  historyItemCenter: {
    flex: 1,
  },
  historyItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.orangeShade7,
  },
  historyItemDate: {
    fontSize: 12,
    color: colors.orangeShade5,
    marginTop: 2,
  },
  historyItemStats: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 16,
  },
  historyItemStat: {
    fontSize: 12,
    color: colors.orangeShade6,
  },
  historyItemRight: {
    marginLeft: spacing.small,
  },
  exportBtn: {
    padding: 8,
    backgroundColor: colors.ivory2,
    borderRadius: 20,
  },
  // Export Overlay
  exportOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportOverlayText: {
    color: '#fff',
    fontSize: 16,
    marginTop: spacing.medium,
  },
});