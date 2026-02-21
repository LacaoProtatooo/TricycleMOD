/**
 * tracking.jsx - Guest GPS Tracking Screen with Trip Recording
 *
 * Features:
 * - Real-time GPS tracking with speed, altitude, heading
 * - Trip recording with local buffer + MongoDB sync
 * - Trip history with relive playback
 * - GPX export via Cloudinary
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  FlatList,
  Modal,
  ActivityIndicator,
  Share,
  Linking,
} from 'react-native';
import MapView, { Marker, Polyline, Circle, PROVIDER_GOOGLE, AnimatedRegion } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Application from 'expo-application';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import { useNavigation, useIsFocused } from '@react-navigation/native';

import { colors, spacing } from '../../components/common/theme';
import { getUserCredentials } from '../../utils/userStorage';
import { API_URL } from '../../utils/config';

const BASE_URL = API_URL;

// Storage keys
const DEVICE_ID_KEY = 'tracking_device_id_v1';
const ACTIVE_TRIP_KEY = 'tracking_active_trip_v1';

// Sync settings
const SYNC_INTERVAL_MS = 30000; // Sync every 30 seconds
const SYNC_BATCH_SIZE = 50; // Min coordinates before sync

// Haversine distance calculation
function haversineMeters(a, b) {
  if (!a || !b) return 0;
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371000;
  const φ1 = toRad(a.latitude), φ2 = toRad(b.latitude);
  const Δφ = toRad(b.latitude - a.latitude);
  const Δλ = toRad(b.longitude - a.longitude);
  const aa = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return R * c;
}

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

// Parse GPX XML content to extract track points
function parseGPX(gpxContent) {
  try {
    const rawCoordinates = [];
    let tripName = 'Imported GPX';

    // Extract track name from <name> tag (with optional namespace prefix)
    const nameMatch = gpxContent.match(/<(?:[a-zA-Z0-9]+:)?name>([^<]+)<\/(?:[a-zA-Z0-9]+:)?name>/);
    if (nameMatch) {
      tripName = nameMatch[1].trim();
    }

    // Extract track points from <trkpt> tags (with optional namespace prefix like ns0:trkpt)
    const trkptRegex = /<(?:[a-zA-Z0-9]+:)?trkpt[^>]*lat=["']([^"']+)["'][^>]*lon=["']([^"']+)["'][^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?trkpt>/g;
    let match;

    while ((match = trkptRegex.exec(gpxContent)) !== null) {
      const lat = parseFloat(match[1]);
      const lon = parseFloat(match[2]);
      const innerContent = match[3];

      // Extract elevation if present (with optional namespace prefix)
      const eleMatch = innerContent.match(/<(?:[a-zA-Z0-9]+:)?ele>([^<]+)<\/(?:[a-zA-Z0-9]+:)?ele>/);
      const ele = eleMatch ? parseFloat(eleMatch[1]) : 0;

      // Extract timestamp if present (with optional namespace prefix)
      const timeMatch = innerContent.match(/<(?:[a-zA-Z0-9]+:)?time>([^<]+)<\/(?:[a-zA-Z0-9]+:)?time>/);
      const timestamp = timeMatch ? new Date(timeMatch[1]).getTime() : Date.now();

      if (!isNaN(lat) && !isNaN(lon)) {
        rawCoordinates.push({
          latitude: lat,
          longitude: lon,
          altitude: ele,
          timestamp: timestamp,
        });
      }
    }

    // If no trkpt found, try to parse <rtept> (route points) with optional namespace
    if (rawCoordinates.length === 0) {
      const rteptRegex = /<(?:[a-zA-Z0-9]+:)?rtept[^>]*lat=["']([^"']+)["'][^>]*lon=["']([^"']+)["'][^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?rtept>/g;
      while ((match = rteptRegex.exec(gpxContent)) !== null) {
        const lat = parseFloat(match[1]);
        const lon = parseFloat(match[2]);
        const innerContent = match[3];

        const eleMatch = innerContent.match(/<(?:[a-zA-Z0-9]+:)?ele>([^<]+)<\/(?:[a-zA-Z0-9]+:)?ele>/);
        const ele = eleMatch ? parseFloat(eleMatch[1]) : 0;

        const timeMatch = innerContent.match(/<(?:[a-zA-Z0-9]+:)?time>([^<]+)<\/(?:[a-zA-Z0-9]+:)?time>/);
        const timestamp = timeMatch ? new Date(timeMatch[1]).getTime() : Date.now();

        if (!isNaN(lat) && !isNaN(lon)) {
          rawCoordinates.push({
            latitude: lat,
            longitude: lon,
            altitude: ele,
            timestamp: timestamp,
          });
        }
      }
    }

    // Sort by timestamp to ensure correct order
    rawCoordinates.sort((a, b) => a.timestamp - b.timestamp);

    // Filter out GPS jumps/teleports (unrealistic speed > 150 km/h or backward time jumps)
    const MAX_SPEED_MPS = 150 * 1000 / 3600; // 150 km/h in m/s (about 42 m/s)
    const coordinates = [];
    
    for (let i = 0; i < rawCoordinates.length; i++) {
      const current = rawCoordinates[i];
      
      if (coordinates.length === 0) {
        coordinates.push({
          ...current,
          timestamp: new Date(current.timestamp).toISOString(),
        });
        continue;
      }

      const last = coordinates[coordinates.length - 1];
      const lastTimestamp = new Date(last.timestamp).getTime();
      const timeDiff = (current.timestamp - lastTimestamp) / 1000; // seconds
      
      // Skip if time goes backward or is same
      if (timeDiff <= 0) continue;
      
      const distance = haversineMeters(last, current);
      const speed = distance / timeDiff; // m/s

      // Skip if speed is unrealistically high (GPS jump)
      if (speed > MAX_SPEED_MPS) continue;

      // Skip duplicate coordinates
      if (last.latitude === current.latitude && last.longitude === current.longitude) continue;

      coordinates.push({
        ...current,
        timestamp: new Date(current.timestamp).toISOString(),
      });
    }

    // Calculate total distance from filtered coordinates
    let totalDistance = 0;
    for (let i = 1; i < coordinates.length; i++) {
      totalDistance += haversineMeters(coordinates[i - 1], coordinates[i]);
    }

    // Calculate duration
    let startTime = coordinates.length > 0 ? coordinates[0].timestamp : new Date().toISOString();
    let endTime = coordinates.length > 0 ? coordinates[coordinates.length - 1].timestamp : new Date().toISOString();
    let duration = 0;
    if (startTime && endTime) {
      duration = Math.floor((new Date(endTime) - new Date(startTime)) / 1000);
    }

    return {
      tripId: `imported_${Date.now()}`,
      name: tripName,
      coordinates,
      startTime,
      endTime,
      totalDistance,
      duration,
      isImported: true,
    };
  } catch (error) {
    console.error('Error parsing GPX:', error);
    return null;
  }
}

const GuestTracking = () => {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const mapRef = useRef(null);
  const watchRef = useRef(null);
  const syncIntervalRef = useRef(null);
  const reliveAnimRef = useRef(null);

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Location state
  const [region, setRegion] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [speedKph, setSpeedKph] = useState(0);
  const [altitude, setAltitude] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [heading, setHeading] = useState(0);
  const [hasPermission, setHasPermission] = useState(false);

  // Trip recording state
  const [isRecording, setIsRecording] = useState(false);
  const [activeTripId, setActiveTripId] = useState(null);
  const [recordedPositions, setRecordedPositions] = useState([]);
  const [tripDistance, setTripDistance] = useState(0);
  const [tripDuration, setTripDuration] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [deviceId, setDeviceId] = useState(null);

  // Trip history state
  const [showHistory, setShowHistory] = useState(false);
  const [tripHistory, setTripHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Relive state
  const [reliveTrip, setReliveTrip] = useState(null);
  const [reliveActive, setReliveActive] = useState(false);
  const [reliveIndex, setReliveIndex] = useState(0);
  const [relivePaused, setRelivePaused] = useState(false);
  const reliveMarker = useRef(new AnimatedRegion({ latitude: 0, longitude: 0 })).current;
  const relivePausedRef = useRef(false);

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  // Import state
  const [isImporting, setIsImporting] = useState(false);

  // Map type state
  const [mapType, setMapType] = useState('mutedStandard');

  // Refs for current values in callbacks
  const recordedPosRef = useRef([]);
  const lastPosRef = useRef(null);
  const tripStartRef = useRef(null);
  const distanceRef = useRef(0);
  const activeTripIdRef = useRef(null);

  // Check authentication on mount
  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      const credentials = await getUserCredentials();
      if (credentials && (credentials._id || credentials.id)) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Error checking authentication:', error);
      setIsAuthenticated(false);
    } finally {
      setCheckingAuth(false);
    }
  };

  // Initialize device ID and check for active trip
  useEffect(() => {
    if (isAuthenticated) {
      initializeTracking();
      return () => cleanup();
    }
  }, [isAuthenticated]);

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

  // Sync relivePaused to ref
  useEffect(() => {
    relivePausedRef.current = relivePaused;
  }, [relivePaused]);

  const initializeTracking = async () => {
    try {
      // Get or create device ID
      let storedDeviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (!storedDeviceId) {
        const appId = Application.applicationId || 'tricyclemod';
        storedDeviceId = `device_${appId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        await AsyncStorage.setItem(DEVICE_ID_KEY, storedDeviceId);
      }
      setDeviceId(storedDeviceId);

      // Check for active trip
      const activeTripData = await AsyncStorage.getItem(ACTIVE_TRIP_KEY);
      if (activeTripData) {
        const { tripId, startTime, positions } = JSON.parse(activeTripData);
        setActiveTripId(tripId);
        activeTripIdRef.current = tripId;
        setIsRecording(true);
        tripStartRef.current = startTime;
        recordedPosRef.current = positions || [];
        setRecordedPositions(positions || []);

        // Recalculate distance
        let dist = 0;
        for (let i = 1; i < positions?.length; i++) {
          dist += haversineMeters(positions[i - 1], positions[i]);
        }
        distanceRef.current = dist;
        setTripDistance(dist);

        // Resume location watching
        await resumeLocationWatching();
      }

      // Request permission and start
      await requestPermissionAndStart();
    } catch (error) {
      console.error('Error initializing tracking:', error);
    }
  };

  const cleanup = () => {
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
    if (reliveAnimRef.current) {
      clearTimeout(reliveAnimRef.current);
    }
  };

  const requestPermissionAndStart = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is required for GPS tracking');
        return;
      }

      setHasPermission(true);

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = location.coords;
      const initialRegion = {
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };

      setRegion(initialRegion);
      setCurrentLocation({ latitude, longitude });
      updateLocationData(location);
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Unable to get your location');
    }
  };

  const resumeLocationWatching = async () => {
    try {
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 2,
        },
        handleLocationUpdate
      );

      watchRef.current = subscription;

      // Start sync interval
      syncIntervalRef.current = setInterval(syncToServer, SYNC_INTERVAL_MS);
    } catch (error) {
      console.error('Error resuming location watching:', error);
    }
  };

  const updateLocationData = (location) => {
    const { speed, altitude, accuracy, heading } = location.coords;
    const kph = (typeof speed === 'number' && !isNaN(speed)) ? Math.max(0, speed * 3.6) : 0;
    setSpeedKph(Math.round(kph * 10) / 10);
    setAltitude(altitude ? Math.round(altitude * 10) / 10 : 0);
    setAccuracy(accuracy ? Math.round(accuracy * 10) / 10 : 0);
    setHeading(heading ? Math.round(heading) : 0);
  };

  // ============== TRIP RECORDING ==============

  const startRecording = async () => {
    if (!hasPermission) {
      await requestPermissionAndStart();
      return;
    }

    if (isRecording) {
      Alert.alert('Recording', 'Trip recording is already active');
      return;
    }

    // Ensure deviceId is available
    let currentDeviceId = deviceId;
    if (!currentDeviceId) {
      try {
        currentDeviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (!currentDeviceId) {
          const appId = Application.applicationId || 'tricyclemod';
          currentDeviceId = `device_${appId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
          await AsyncStorage.setItem(DEVICE_ID_KEY, currentDeviceId);
        }
        setDeviceId(currentDeviceId);
      } catch (e) {
        console.error('Failed to get deviceId:', e);
        Alert.alert('Error', 'Failed to initialize device. Please try again.');
        return;
      }
    }

    try {
      // Get current location for initial coordinate
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });

      const initialCoord = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        altitude: location.coords.altitude || 0,
        accuracy: location.coords.accuracy || 0,
        speed: location.coords.speed || 0,
        heading: location.coords.heading || 0,
        timestamp: Date.now(),
      };

      // Start trip on server
      const response = await axios.post(`${BASE_URL}/api/tracking/start`, {
        deviceId: currentDeviceId,
        name: `Trip ${new Date().toLocaleDateString()}`,
        initialCoordinate: initialCoord,
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to start trip');
      }

      const { tripId, startTime } = response.data;

      // Initialize recording state
      setActiveTripId(tripId);
      activeTripIdRef.current = tripId;
      setIsRecording(true);
      tripStartRef.current = new Date(startTime).getTime();
      recordedPosRef.current = [initialCoord];
      lastPosRef.current = initialCoord;
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

      // Start location watching
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 2,
        },
        handleLocationUpdate
      );

      watchRef.current = subscription;

      // Start sync interval
      syncIntervalRef.current = setInterval(syncToServer, SYNC_INTERVAL_MS);

      Alert.alert('Recording Started', 'Your trip is being recorded');
    } catch (error) {
      console.error('Error starting recording:', error);
      
      // Check if server returned an existing trip (400 with tripId)
      const errorData = error.response?.data;
      if (errorData?.tripId) {
        Alert.alert(
          'Existing Trip Found',
          'You have an active trip. Would you like to resume or cancel it?',
          [
            {
              text: 'Cancel Trip',
              style: 'destructive',
              onPress: async () => {
                try {
                  await axios.post(`${BASE_URL}/api/tracking/${errorData.tripId}/cancel`);
                  await AsyncStorage.removeItem(ACTIVE_TRIP_KEY);
                  Alert.alert('Trip Cancelled', 'You can now start a new recording');
                } catch (e) {
                  console.error('Failed to cancel trip:', e);
                  Alert.alert('Error', 'Failed to cancel existing trip');
                }
              },
            },
            {
              text: 'Resume Trip',
              onPress: async () => {
                try {
                  // Get current location
                  const loc = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.BestForNavigation,
                  });
                  const initialCoord = {
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                    altitude: loc.coords.altitude || 0,
                    timestamp: Date.now(),
                  };
                  
                  // Resume the existing trip
                  setActiveTripId(errorData.tripId);
                  activeTripIdRef.current = errorData.tripId;
                  setIsRecording(true);
                  tripStartRef.current = Date.now();
                  recordedPosRef.current = [initialCoord];
                  lastPosRef.current = initialCoord;
                  distanceRef.current = 0;
                  setRecordedPositions([initialCoord]);

                  // Save to AsyncStorage
                  await AsyncStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify({
                    tripId: errorData.tripId,
                    startTime: tripStartRef.current,
                    positions: [initialCoord],
                  }));

                  // Start watching location
                  const subscription = await Location.watchPositionAsync(
                    {
                      accuracy: Location.Accuracy.BestForNavigation,
                      timeInterval: 1000,
                      distanceInterval: 2,
                    },
                    handleLocationUpdate
                  );
                  watchRef.current = subscription;

                  syncIntervalRef.current = setInterval(syncToServer, SYNC_INTERVAL_MS);
                  Alert.alert('Resumed', 'Continuing your previous trip');
                } catch (e) {
                  console.error('Failed to resume trip:', e);
                  Alert.alert('Error', 'Failed to resume trip');
                }
              },
            },
          ]
        );
        return;
      }
      
      Alert.alert('Error', errorData?.message || error.message || 'Failed to start recording');
    }
  };

  const handleLocationUpdate = useCallback((location) => {
    const { latitude, longitude, altitude, accuracy, speed, heading } = location.coords;

    setCurrentLocation({ latitude, longitude });
    updateLocationData(location);

    // Center map
    if (mapRef.current) {
      mapRef.current.animateCamera(
        { center: { latitude, longitude } },
        { duration: 300 }
      );
    }

    // Only record if actively recording
    if (!activeTripIdRef.current) return;

    // Add to recorded positions
    const newCoord = {
      latitude,
      longitude,
      altitude: altitude || 0,
      accuracy: accuracy || 0,
      speed: speed || 0,
      heading: heading || 0,
      timestamp: location.timestamp || Date.now(),
    };

    // Calculate distance from last position
    if (lastPosRef.current) {
      const meters = haversineMeters(lastPosRef.current, newCoord);
      
      // Filter GPS jitter (ignore if too close or unrealistic jump)
      if (meters < 1 || meters > 500) {
        return;
      }
      
      distanceRef.current += meters;
      setTripDistance(distanceRef.current);
    }

    lastPosRef.current = newCoord;
    recordedPosRef.current.push(newCoord);
    setRecordedPositions([...recordedPosRef.current]);

    // Update AsyncStorage periodically
    updateLocalStorage();
  }, []);

  const updateLocalStorage = async () => {
    try {
      if (activeTripIdRef.current) {
        await AsyncStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify({
          tripId: activeTripIdRef.current,
          startTime: tripStartRef.current,
          positions: recordedPosRef.current.slice(-200), // Keep last 200 for memory
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
      // If trip no longer exists (404), stop syncing to avoid repeated errors
      if (error.response?.status === 404) {
        console.log('Trip no longer active, stopping sync interval');
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
          syncIntervalRef.current = null;
        }
      } else {
        console.error('Sync error:', error.message);
      }
    } finally {
      setIsSyncing(false);
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
      // Stop location watching
      if (watchRef.current) {
        watchRef.current.remove();
        watchRef.current = null;
      }

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
      lastPosRef.current = null;
      tripStartRef.current = null;
      distanceRef.current = 0;

    } catch (error) {
      console.error('Error saving trip:', error);
      Alert.alert('Error', 'Failed to save trip. Your data is saved locally.');
    }
  };

  const discardTrip = async () => {
    try {
      if (watchRef.current) {
        watchRef.current.remove();
        watchRef.current = null;
      }

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
      lastPosRef.current = null;
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

  const selectTripForRelive = async (trip) => {
    try {
      setShowHistory(false);
      
      // Fetch full trip with coordinates
      const response = await axios.get(`${BASE_URL}/api/tracking/${trip.tripId}`);
      if (response.data.success && response.data.trip.coordinates.length >= 2) {
        setReliveTrip(response.data.trip);
        startRelive(response.data.trip);
      } else {
        Alert.alert('Error', 'Trip has insufficient data for playback');
      }
    } catch (error) {
      console.error('Error loading trip for relive:', error);
      Alert.alert('Error', 'Failed to load trip');
    }
  };

  // ============== RELIVE PLAYBACK ==============

  const startRelive = (trip) => {
    if (!trip || !trip.coordinates || trip.coordinates.length < 2) return;

    const firstCoord = trip.coordinates[0];
    
    // Initialize relive marker
    reliveMarker.setValue({
      latitude: firstCoord.latitude,
      longitude: firstCoord.longitude,
    });

    // Fit map to trip bounds
    if (mapRef.current) {
      mapRef.current.fitToCoordinates(
        trip.coordinates.map(c => ({ latitude: c.latitude, longitude: c.longitude })),
        {
          edgePadding: { top: 50, right: 50, bottom: 200, left: 50 },
          animated: true,
        }
      );
    }

    setReliveActive(true);
    setReliveIndex(0);
    setRelivePaused(false);
    relivePausedRef.current = false;
    
    setTimeout(() => {
      animateRelive(trip, 0);
    }, 1000);
  };

  const animateRelive = (trip, index) => {
    if (index >= trip.coordinates.length - 1) {
      // Finished
      setReliveActive(false);
      setReliveTrip(null);
      Alert.alert('Relive Complete', 'Trip playback finished');
      return;
    }

    if (relivePausedRef.current) return;

    const current = trip.coordinates[index];
    const next = trip.coordinates[index + 1];
    
    // Calculate animation duration based on timestamp difference
    const timeDiff = next.timestamp && current.timestamp
      ? Math.abs(new Date(next.timestamp) - new Date(current.timestamp))
      : 500;
    const duration = Math.min(Math.max(timeDiff / 10, 100), 1000); // 10x speed, capped

    reliveMarker.timing({
      latitude: next.latitude,
      longitude: next.longitude,
      duration,
      useNativeDriver: false,
    }).start();

    // Center map on current position
    if (mapRef.current) {
      mapRef.current.animateCamera(
        { center: { latitude: next.latitude, longitude: next.longitude } },
        { duration: duration / 2 }
      );
    }

    setReliveIndex(index + 1);

    reliveAnimRef.current = setTimeout(() => {
      animateRelive(trip, index + 1);
    }, duration);
  };

  const toggleRelivePause = () => {
    if (relivePausedRef.current) {
      setRelivePaused(false);
      relivePausedRef.current = false;
      animateRelive(reliveTrip, reliveIndex);
    } else {
      setRelivePaused(true);
      relivePausedRef.current = true;
      if (reliveAnimRef.current) {
        clearTimeout(reliveAnimRef.current);
      }
    }
  };

  const stopRelive = () => {
    if (reliveAnimRef.current) {
      clearTimeout(reliveAnimRef.current);
    }
    setReliveActive(false);
    setReliveTrip(null);
    setReliveIndex(0);
    setRelivePaused(false);
    relivePausedRef.current = false;
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

  // ============== GPX IMPORT ==============

  const importGPXFile = async () => {
    try {
      setIsImporting(true);

      // Pick a GPX file
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/gpx+xml', 'text/xml', 'application/xml', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        setIsImporting(false);
        return;
      }

      const file = result.assets[0];
      
      // Check file extension
      if (!file.name.toLowerCase().endsWith('.gpx')) {
        Alert.alert('Invalid File', 'Please select a GPX file (.gpx extension)');
        setIsImporting(false);
        return;
      }

      // Read file content
      const gpxContent = await FileSystem.readAsStringAsync(file.uri);

      // Parse GPX content
      const parsedTrip = parseGPX(gpxContent);

      if (!parsedTrip || parsedTrip.coordinates.length < 2) {
        Alert.alert(
          'Invalid GPX',
          'The GPX file does not contain valid track data (at least 2 points required).'
        );
        setIsImporting(false);
        return;
      }

      setIsImporting(false);
      setShowHistory(false);

      // Show trip info and ask to start relive
      Alert.alert(
        'GPX Imported',
        `Track: ${parsedTrip.name}\nPoints: ${parsedTrip.coordinates.length}\nDistance: ${(parsedTrip.totalDistance / 1000).toFixed(2)} km\nDuration: ${formatDuration(parsedTrip.duration)}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Start Relive',
            onPress: () => {
              setReliveTrip(parsedTrip);
              startRelive(parsedTrip);
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error importing GPX:', error);
      Alert.alert('Error', 'Failed to import GPX file. Please ensure it is a valid GPX format.');
      setIsImporting(false);
    }
  };

  // ============== RENDER ==============

  const renderTripHistoryItem = ({ item }) => (
    <TouchableOpacity
      style={styles.historyItem}
      onPress={() => selectTripForRelive(item)}
    >
      <View style={styles.historyItemLeft}>
        <Ionicons name="navigate-circle" size={32} color={colors.primary} />
      </View>
      <View style={styles.historyItemCenter}>
        <Text style={styles.historyItemTitle}>{item.name || `Trip ${item.tripId.slice(0, 12)}`}</Text>
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
  );

  // Show loading while checking authentication
  if (checkingAuth) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.authContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.authText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show login prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.authContainer}>
          <Ionicons name="lock-closed-outline" size={80} color={colors.primary} />
          <Text style={styles.authTitle}>Login Required</Text>
          <Text style={styles.authText}>
            Please log in to access GPS Tracking feature
          </Text>
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Ionicons name="navigate-circle-outline" size={24} color={colors.primary} />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>GPS Tracking</Text>
            <Text style={styles.headerSubtitle}>
              {isRecording ? 'Recording Trip' : reliveActive ? 'Relive Mode' : 'Ready'}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          {isSyncing && <ActivityIndicator size="small" color={colors.primary} />}
          <TouchableOpacity style={styles.historyBtn} onPress={openHistory}>
            <Ionicons name="time-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Map - only render when tab is focused to prevent multiple MapView crashes */}
      {region && isFocused ? (
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          mapType={mapType}
          initialRegion={region}
          showsUserLocation={!reliveActive}
          showsMyLocationButton={false}
          followsUserLocation={isRecording && !reliveActive}
        >
          {/* Current location marker (when not in relive) */}
          {currentLocation && !reliveActive && (
            <Marker coordinate={currentLocation} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.locationMarker}>
                <Ionicons name="navigate" size={20} color="#fff" />
              </View>
            </Marker>
          )}

          {/* Recorded path */}
          {recordedPositions.length > 1 && !reliveActive && (
            <Polyline
              coordinates={recordedPositions}
              strokeColor={colors.primary}
              strokeWidth={4}
            />
          )}

          {/* Relive path */}
          {reliveTrip && reliveActive && reliveTrip.coordinates?.length > 1 && (
            <>
              <Polyline
                coordinates={reliveTrip.coordinates.map(c => ({
                  latitude: c.latitude,
                  longitude: c.longitude,
                }))}
                strokeColor="#0d6efd"
                strokeWidth={4}
              />
              <Marker.Animated
                coordinate={reliveMarker}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={styles.reliveMarker}>
                  <Ionicons name="bicycle" size={20} color="#fff" />
                </View>
              </Marker.Animated>
            </>
          )}

          {/* Accuracy circle */}
          {currentLocation && accuracy > 0 && !reliveActive && (
            <Circle
              center={currentLocation}
              radius={accuracy}
              strokeColor="rgba(66,133,244,0.3)"
              fillColor="rgba(66,133,244,0.1)"
            />
          )}
        </MapView>
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Getting your location...</Text>
        </View>
      )}

      {/* Recording Info Panel */}
      {isRecording && (
        <View style={styles.recordingPanel}>
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>Recording</Text>
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

      {/* Relive Controls */}
      {reliveActive && (
        <View style={styles.relivePanel}>
          <Text style={styles.relivePanelTitle}>
            {reliveTrip?.name || 'Trip Playback'}
          </Text>
          <View style={styles.reliveProgress}>
            <View 
              style={[
                styles.reliveProgressFill, 
                { width: `${(reliveIndex / (reliveTrip?.coordinates?.length || 1)) * 100}%` }
              ]} 
            />
          </View>
          <View style={styles.reliveControls}>
            <TouchableOpacity style={styles.reliveControlBtn} onPress={stopRelive}>
              <Ionicons name="stop" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.reliveControlBtn} onPress={toggleRelivePause}>
              <Ionicons name={relivePaused ? 'play' : 'pause'} size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* GPS Info Panel */}
      {!reliveActive && (
        <View style={styles.infoPanel}>
          <View style={styles.infoRow}>
            <View style={styles.infoCard}>
              <Ionicons name="speedometer-outline" size={20} color={colors.primary} />
              <Text style={styles.infoLabel}>Speed</Text>
              <Text style={styles.infoValue}>{speedKph} km/h</Text>
            </View>

            <View style={styles.infoCard}>
              <Ionicons name="compass-outline" size={20} color={colors.primary} />
              <Text style={styles.infoLabel}>Heading</Text>
              <Text style={styles.infoValue}>{heading}°</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoCard}>
              <Ionicons name="arrow-up-outline" size={20} color={colors.primary} />
              <Text style={styles.infoLabel}>Altitude</Text>
              <Text style={styles.infoValue}>{altitude} m</Text>
            </View>

            <View style={styles.infoCard}>
              <Ionicons name="radio-outline" size={20} color={colors.primary} />
              <Text style={styles.infoLabel}>Accuracy</Text>
              <Text style={styles.infoValue}>±{accuracy} m</Text>
            </View>
          </View>
        </View>
      )}

      {/* Control Buttons */}
      {!reliveActive && (
        <View style={styles.controls}>
          <TouchableOpacity
            style={[
              styles.controlBtn,
              isRecording && styles.controlBtnRecording,
            ]}
            onPress={isRecording ? stopRecording : startRecording}
          >
            <Ionicons
              name={isRecording ? 'stop-circle-outline' : 'radio-button-on-outline'}
              size={24}
              color="#fff"
            />
            <Text style={styles.controlBtnText}>
              {isRecording ? 'Stop Recording' : 'Record Trip'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.centerBtn}
            onPress={() => {
              if (currentLocation && mapRef.current) {
                mapRef.current.animateCamera(
                  { center: currentLocation, zoom: 17 },
                  { duration: 500 }
                );
              }
            }}
          >
            <Ionicons name="locate-outline" size={24} color={colors.primary} />
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
              size={24}
              color={colors.primary}
            />
          </TouchableOpacity>
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
              <View style={styles.modalHeaderActions}>
                <TouchableOpacity 
                  style={styles.importBtn} 
                  onPress={importGPXFile}
                  disabled={isImporting}
                >
                  <Ionicons name="cloud-upload-outline" size={24} color={colors.primary} />
                  <Text style={styles.importBtnText}>Import GPX</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowHistory(false)}>
                  <Ionicons name="close" size={28} color={colors.orangeShade7} />
                </TouchableOpacity>
              </View>
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
                renderItem={renderTripHistoryItem}
                keyExtractor={(item) => item.tripId}
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

      {/* Import Loading Overlay */}
      {isImporting && (
        <View style={styles.exportOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.exportOverlayText}>Importing GPX...</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ivory1,
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.large,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    marginTop: spacing.large,
    marginBottom: spacing.small,
  },
  authText: {
    fontSize: 16,
    color: colors.orangeShade5,
    textAlign: 'center',
    marginBottom: spacing.large,
  },
  loginButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.large * 2,
    paddingVertical: spacing.medium,
    borderRadius: 12,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyBtn: {
    padding: 4,
  },
  map: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.ivory2,
  },
  loadingText: {
    marginTop: spacing.medium,
    fontSize: 16,
    color: colors.orangeShade5,
  },
  locationMarker: {
    backgroundColor: colors.primary,
    padding: 10,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  reliveMarker: {
    backgroundColor: '#0d6efd',
    padding: 10,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  
  // Recording Panel
  recordingPanel: {
    position: 'absolute',
    top: 80,
    left: spacing.medium,
    right: spacing.medium,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    padding: spacing.medium,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
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

  // Relive Panel
  relivePanel: {
    position: 'absolute',
    bottom: 100,
    left: spacing.medium,
    right: spacing.medium,
    backgroundColor: 'rgba(13,110,253,0.95)',
    borderRadius: 12,
    padding: spacing.medium,
  },
  relivePanelTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  reliveProgress: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    marginBottom: 12,
  },
  reliveProgressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  reliveControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  reliveControlBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 12,
    borderRadius: 30,
  },

  // Info Panel
  infoPanel: {
    backgroundColor: colors.ivory1,
    paddingHorizontal: spacing.medium,
    paddingTop: spacing.medium,
    borderTopWidth: 1,
    borderTopColor: colors.ivory3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.small,
  },
  infoCard: {
    flex: 1,
    backgroundColor: colors.ivory4,
    padding: spacing.small,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.ivory3,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 11,
    color: colors.orangeShade5,
    marginTop: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.orangeShade7,
    marginTop: 2,
  },

  // Controls
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.medium,
    paddingBottom: spacing.medium,
    backgroundColor: colors.ivory1,
  },
  controlBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.small,
    borderRadius: 10,
    marginRight: spacing.small,
  },
  controlBtnRecording: {
    backgroundColor: '#dc3545',
  },
  controlBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    marginLeft: spacing.small,
  },
  centerBtn: {
    backgroundColor: colors.ivory4,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  mapTypeBtn: {
    backgroundColor: colors.ivory4,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.ivory3,
    marginLeft: spacing.small,
  },

  // Modal
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
  modalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ivory2,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  importBtnText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
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

export default GuestTracking;
