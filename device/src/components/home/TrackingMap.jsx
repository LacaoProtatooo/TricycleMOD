import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Easing, PanResponder, Modal, FlatList, ActivityIndicator, Share, Linking, Animated as RNAnimated, Platform, AppState } from 'react-native';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE, AnimatedRegion, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Application from 'expo-application';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { colors, spacing } from '../../components/common/theme';
import { API_URL } from '../../utils/config';
import GPSFilter, { GPS_FILTER_CONFIG, haversineMeters as gpsHaversine, bearingBetween } from '../../utils/gpsFilter';

// ensure background task is registered at runtime
import '../../components/services/BackgroundLocationTask';
import { BG_TASK_NAME } from '../../components/services/BackgroundLocationTask';

const BASE_URL = API_URL;

const KM_KEY = 'vehicle_current_km_v1';
const DEVICE_ID_KEY = 'driver_tracking_device_id_v1';
const ACTIVE_TRIP_KEY = 'driver_tracking_active_trip_v1';
const BOOKING_TRIGGER_RECORDING_KEY = 'booking_trigger_recording_v1';
const BG_COORDS_KEY = 'bg_trip_coords_v1'; // coordinates accumulated in background task
const BG_DISTANCE_KEY = 'bg_trip_distance_v1'; // distance accumulated in background task
const BG_SYNCED_INDEX_KEY = 'bg_trip_synced_index_v1'; // server-sync index (managed by bg task)
const SIM_BROADCAST_KEY = 'dev_sim_broadcast_v1'; // DEV: shared with DriverBookingScreen simulation

// Offline-first storage keys
const PENDING_TRIP_START_KEY = 'pending_trip_start_v1'; // Trip that needs to be created on server
const PENDING_TRIP_END_KEY = 'pending_trip_end_v1'; // Trip that needs to be ended on server
const OFFLINE_COORDS_QUEUE_KEY = 'offline_coords_queue_v1'; // Coordinates to sync when online

// Sync settings
const SYNC_INTERVAL_MS = 30000;
const SYNC_BATCH_SIZE = 50;
const OFFLINE_SYNC_RETRY_MS = 60000; // Retry offline sync every 60 seconds
const MOVING_SPEED_THRESHOLD_KPH = 2.5; // Strava-style moving threshold
const MAX_MOTION_SEGMENT_SECONDS = 30; // cap very long gaps in moving-time math

// Generate a local trip ID for offline recording
function generateLocalTripId() {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// Check if a trip ID is a local (offline) ID
function isLocalTripId(tripId) {
  return tripId && tripId.startsWith('local_');
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

function computeMovingStats(coords = []) {
  if (!Array.isArray(coords) || coords.length < 2) {
    return { movingSeconds: 0, maxSpeedKph: 0 };
  }

  let movingSeconds = 0;
  let maxSpeedKph = 0;

  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    if (!prev || !curr) continue;

    const dt = ((curr.timestamp || 0) - (prev.timestamp || 0)) / 1000;
    if (!(dt > 0)) continue;

    const distance = haversineMeters(prev, curr);
    if (!(distance > 0)) continue;

    const speedKph = (distance / dt) * 3.6;
    if (speedKph > maxSpeedKph) maxSpeedKph = speedKph;

    if (speedKph >= MOVING_SPEED_THRESHOLD_KPH) {
      movingSeconds += Math.min(dt, MAX_MOTION_SEGMENT_SECONDS);
    }
  }

  return { movingSeconds, maxSpeedKph };
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

// Interpolate waypoints with more granularity for smooth simulation
function interpolateWaypoints(waypoints, pointsPerSegment = 8) {
  const result = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    for (let j = 0; j < pointsPerSegment; j++) {
      const t = j / pointsPerSegment;
      result.push({
        latitude: a.latitude + (b.latitude - a.latitude) * t,
        longitude: a.longitude + (b.longitude - a.longitude) * t,
      });
    }
  }
  result.push(waypoints[waypoints.length - 1]);
  return result;
}

export default function TrackingMap({ 
  follow = true, 
  onEnterTerminalZone, 
  odometerSeed, 
  codingDayRestricted = false, 
  isVisible = true,
  // Booking route props
  activeBooking = null,
  bookingRoute = null,
  isPickedUp = false,
  isRerouting = false,
  onRerouteNeeded = null,
  onQueuePress = null,
}) {
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
  const [reliveCurrentSpeed, setReliveCurrentSpeed] = useState(0); // km/h during relive
  const [reliveCurrentAltitude, setReliveCurrentAltitude] = useState(0);
  const [reliveDistanceCovered, setReliveDistanceCovered] = useState(0); // meters
  const [reliveStats, setReliveStats] = useState(null); // trip-level stats for overlay
  const [mapType, setMapType] = useState('standard');
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

  // Collapsible map controls container
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  const controlsAnim = useRef(new RNAnimated.Value(1)).current;

  // Trip recording state
  const [isRecording, setIsRecording] = useState(false);
  const [activeTripId, setActiveTripId] = useState(null);
  const [recordedPositions, setRecordedPositions] = useState([]);
  const [tripDistance, setTripDistance] = useState(0);
  const [tripDuration, setTripDuration] = useState(0);
  const [tripMovingTime, setTripMovingTime] = useState(0);
  const [tripAvgMovingSpeedKph, setTripAvgMovingSpeedKph] = useState(0);
  const [tripMaxSpeedKph, setTripMaxSpeedKph] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  const syncIntervalRef = useRef(null);
  const recordedPosRef = useRef([]);
  const tripStartRef = useRef(null);
  const distanceRef = useRef(0);
  const activeTripIdRef = useRef(null);
  const lastSyncedIndexRef = useRef(0); // Track which coords have been synced to server
  const isRecordingRef = useRef(false); // Ref mirror of isRecording to avoid stale closures
  const bgMergeIntervalRef = useRef(null); // Interval to periodically check and merge background coordinates
  const lastMergedTimestampRef = useRef(0); // Track last merged coordinate timestamp to avoid duplicates
  const movingTimeSecRef = useRef(0);
  const maxTripSpeedKphRef = useRef(0);

  // GPS Filter instance for intelligent jitter/bounce filtering during trip recording
  const gpsFilterRef = useRef(new GPSFilter());
  // Separate filter for display positions (less strict)
  const displayFilterRef = useRef(new GPSFilter({
    ...GPS_FILTER_CONFIG,
    MAX_ACCURACY_METERS: 40, // More lenient for display
    MIN_DISTANCE_METERS: 1,
    MAX_DISTANCE_METERS: 200,
    MAX_SPEED_MPS: 30,
    // Don't use settling for display — we want to show position ASAP
    SETTLING_GAP_THRESHOLD_MS: 999999999,
  }));

  // Throttle refs to prevent excessive re-renders and AsyncStorage writes
  const lastRecordedStateUpdateRef = useRef(0); // last time we pushed recordedPositions to state
  const lastLocalStorageWriteRef = useRef(0);   // last time we wrote to AsyncStorage
  const pendingStorageWriteRef = useRef(null);   // pending setTimeout id for deferred storage write
  const RECORDED_STATE_THROTTLE_MS = 3000; // update UI every 3s instead of every GPS tick
  const LOCAL_STORAGE_THROTTLE_MS = 10000; // write to AsyncStorage every 10s instead of every GPS tick

  // Trip history state
  const [showHistory, setShowHistory] = useState(false);
  const [tripHistory, setTripHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Map ready state - prevents rendering children before map is initialized
  const [mapReady, setMapReady] = useState(false);

  // Offline-first recording state
  const [isOfflineMode, setIsOfflineMode] = useState(false); // True when recording without server connection
  const offlineSyncIntervalRef = useRef(null); // Interval to retry syncing offline data
  const pendingServerTripIdRef = useRef(null); // Server trip ID once obtained (replaces local ID)

  // DEV: Simulation broadcast listener state
  const [simActive, setSimActive] = useState(false);
  const simActiveRef = useRef(false); // Ref mirror to avoid stale closures in watcher
  const simLastPosRef = useRef(null);

  // ── DEV-ONLY: Booking route simulation ──
  const [devSimRunning, setDevSimRunning] = useState(false);
  const devSimRunningRef = useRef(false);
  const devSimCancelRef = useRef(false);
  const devSimPausedRef = useRef(false);
  const [devSimPaused, setDevSimPaused] = useState(false);
  const [devSimProgress, setDevSimProgress] = useState(0); // 0-1
  const devSimSpeedRef = useRef(1); // speed multiplier (0.5x, 1x, 2x, 4x, 8x)
  const [devSimSpeed, setDevSimSpeed] = useState(1);

  // ── Waze-style navigation POV state ──
  const smoothedHeadingRef = useRef(0); // Smoothed heading for fluid camera rotation
  const [isNavigationMode, setIsNavigationMode] = useState(false); // True when actively navigating a booking route
  const lastCameraUpdateRef = useRef(0); // Throttle camera updates
  const NAV_CAMERA_THROTTLE_MS = 100; // Minimum ms between camera updates in nav mode

  const applyMotionSegment = useCallback((distanceMeters, dtSeconds) => {
    if (!(distanceMeters > 0) || !(dtSeconds > 0)) return;

    const speedKph = (distanceMeters / dtSeconds) * 3.6;
    if (speedKph > maxTripSpeedKphRef.current) {
      maxTripSpeedKphRef.current = speedKph;
    }

    if (speedKph >= MOVING_SPEED_THRESHOLD_KPH) {
      movingTimeSecRef.current += Math.min(dtSeconds, MAX_MOTION_SEGMENT_SECONDS);
    }

    const movingSec = movingTimeSecRef.current;
    const avgMovingSpeed = movingSec > 0 ? (distanceRef.current / movingSec) * 3.6 : 0;

    setTripMovingTime(Math.round(movingSec));
    setTripAvgMovingSpeedKph(Math.round(avgMovingSpeed * 10) / 10);
    setTripMaxSpeedKph(Math.round(maxTripSpeedKphRef.current * 10) / 10);
  }, []);

  /**
   * Smoothly interpolate heading to avoid jarring camera rotation jumps.
   * Takes the shortest angular path (handles 359° → 1° wrap-around).
   * @param {number} current - current smoothed heading (degrees)
   * @param {number} target - new raw heading from GPS (degrees)
   * @param {number} factor - smoothing factor 0-1 (lower = smoother, default 0.3)
   * @returns {number} new smoothed heading in 0-360 range
   */
  const smoothHeading = useCallback((current, target, factor = 0.3) => {
    let diff = target - current;
    // Normalize to shortest arc (-180 to +180)
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    const result = current + diff * factor;
    return ((result % 360) + 360) % 360; // Normalize to 0-360
  }, []);

  /**
   * Get adaptive zoom level based on current speed.
   * Faster speed → zooms out a bit for better road visibility.
   * Slower speed → tighter zoom for precision.
   */
  const getAdaptiveZoom = useCallback((speedKmh) => {
    if (speedKmh <= 5) return 18.5;   // Walking/stopped — tight zoom
    if (speedKmh <= 15) return 18;     // Slow tricycle movement
    if (speedKmh <= 30) return 17.5;   // Normal city speed
    if (speedKmh <= 50) return 17;     // Moderate speed
    return 16.5;                        // Fast speed — wider view
  }, []);

  /**
   * Update the Waze-style navigation camera with smooth heading interpolation.
   * Call this from GPS watcher and simulation poller when in navigation mode.
   */
  const updateNavigationCamera = useCallback((center, rawHeading, speedKmh) => {
    if (!mapRef.current) return;

    const now = Date.now();
    if (now - lastCameraUpdateRef.current < NAV_CAMERA_THROTTLE_MS) return;
    lastCameraUpdateRef.current = now;

    // Smooth the heading to prevent jarring rotation
    const newSmoothedHeading = smoothHeading(smoothedHeadingRef.current, rawHeading || 0, 0.35);
    smoothedHeadingRef.current = newSmoothedHeading;

    const adaptiveZoom = getAdaptiveZoom(speedKmh || 0);

    mapRef.current.animateCamera(
      {
        center,
        pitch: 60,                          // Steeper tilt for Waze-style 3D perspective
        heading: newSmoothedHeading,         // Smoothed heading for fluid rotation
        zoom: adaptiveZoom,                  // Speed-adaptive zoom
      },
      { duration: 800 }                     // Smooth 800ms transition (Waze feel)
    );
  }, [smoothHeading, getAdaptiveZoom]);

  // Track navigation mode based on active booking + route presence
  // When navigation starts, snap camera to Waze-style POV; when ending, reset to top-down
  useEffect(() => {
    const entering = !!(activeBooking && bookingRoute && bookingRoute.length > 1);
    const wasNavigating = isNavigationMode;
    setIsNavigationMode(entering);

    if (entering && !wasNavigating && mapRef.current && positions.length > 0) {
      // Entering navigation mode — animate camera to Waze 3D POV
      const lastPos = positions[positions.length - 1];
      smoothedHeadingRef.current = heading || 0;
      mapRef.current.animateCamera(
        {
          center: lastPos,
          pitch: 60,
          heading: heading || 0,
          zoom: 18,
        },
        { duration: 1200 } // Smooth 1.2s transition into navigation view
      );
    } else if (!entering && wasNavigating && mapRef.current && positions.length > 0) {
      // Exiting navigation mode — animate back to top-down view
      const lastPos = positions[positions.length - 1];
      mapRef.current.animateCamera(
        {
          center: lastPos,
          pitch: 0,
          heading: 0,
          zoom: 16,
        },
        { duration: 800 }
      );
    }
  }, [activeBooking, bookingRoute]);

  useEffect(() => {
    onEnterRef.current = onEnterTerminalZone;
  }, [onEnterTerminalZone]);

  // DEV: Poll for simulated positions broadcast — only handles camera following.
  // Recording, odometer, speed, and positions are handled directly in startDevSimulation.
  useEffect(() => {
    let simPollInterval;
    const pollSimBroadcast = async () => {
      try {
        const raw = await AsyncStorage.getItem(SIM_BROADCAST_KEY);
        if (!raw) {
          if (simActive) { setSimActive(false); simActiveRef.current = false; }
          return;
        }
        const data = JSON.parse(raw);
        if (!data.isActive) {
          if (data.reachedDestination) {
            // Sim completed naturally at destination — keep simActive so blue dot stays hidden
            if (!simActive) setSimActive(true);
            simActiveRef.current = true;
          } else {
            if (simActive) setSimActive(false);
            simActiveRef.current = false;
            simLastPosRef.current = null;
          }
          return;
        }

        setSimActive(true);
        simActiveRef.current = true;
        const newPoint = { latitude: data.latitude, longitude: data.longitude };
        simLastPosRef.current = newPoint;

        // Update heading state so the Waze arrow rotates correctly during sim
        setHeading(Math.round(data.heading || 0));

        // Move camera to follow simulated position
        if (mapRef.current && !reliveActiveRef.current) {
          if (activeBooking && bookingRoute) {
            // Waze-style navigation POV with smooth heading
            updateNavigationCamera(
              newPoint,
              data.heading || 0,
              data.speed ? data.speed * 3.6 : 0
            );
          } else {
            mapRef.current.animateCamera({ center: newPoint }, { duration: 200 });
          }
        }
      } catch (_) {}
    };

    simPollInterval = setInterval(pollSimBroadcast, 300); // poll every 300ms for smooth camera
    return () => clearInterval(simPollInterval);
  }, [simActive]);

  // Toggle stats panel animation
  useEffect(() => {
    RNAnimated.timing(statsAnim, {
      toValue: statsExpanded ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [statsExpanded]);

  // Keep isRecordingRef in sync with isRecording state
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // AppState handling: auto-start background tracking when app goes to background,
  // and merge background-collected coordinates when returning to foreground
  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App going to background — start background location task if recording
        if (isRecordingRef.current && activeTripIdRef.current) {
          console.log('App going to background while recording — starting background tracking');
          try {
            // Save current last position so bg task has a reference point
            if (lastPosRef.current) {
              await AsyncStorage.setItem('bg_last_position_v1', JSON.stringify({
                latitude: lastPosRef.current.coords.latitude,
                longitude: lastPosRef.current.coords.longitude,
              }));
              await AsyncStorage.setItem('bg_last_ts_v1', String(lastPosRef.current.timestamp || Date.now()));
            }

            // Check permission (already requested when recording started)
            const bgPermission = await Location.getBackgroundPermissionsAsync();
            if (bgPermission.status === 'granted') {
              const isRegistered = await TaskManager.isTaskRegisteredAsync(BG_TASK_NAME);
              if (!isRegistered) {
                await Location.startLocationUpdatesAsync(BG_TASK_NAME, {
                  accuracy: Location.Accuracy.BestForNavigation,
                  timeInterval: 2000,
                  distanceInterval: 1,
                  foregroundService: {
                    notificationTitle: 'Trip Recording Active',
                    notificationBody: 'Your trip is being recorded in the background',
                    notificationColor: '#FF0000',
                  },
                  pausesUpdatesAutomatically: false,
                  activityType: Location.ActivityType.AutomotiveNavigation,
                  showsBackgroundLocationIndicator: true,
                });
                console.log('Background location task started successfully');
              } else {
                console.log('Background location task already registered');
              }
            } else {
              console.warn('Background location permission not granted — cannot record in background');
            }
          } catch (e) {
            console.warn('Failed to start background tracking on app background:', e);
          }
        }
      } else if (nextAppState === 'active') {
        // App returning to foreground — merge any coordinates collected in background
        // NOTE: We do NOT stop the background task here. Keeping it running ensures
        // continuous tracking even when screen turns off (which may not trigger AppState change on some devices)
        if (isRecordingRef.current && activeTripIdRef.current) {
          console.log('App returning to foreground — merging background coordinates');
          try {
            const [bgCoordsRaw, bgDistRaw] = await Promise.all([
              AsyncStorage.getItem(BG_COORDS_KEY),
              AsyncStorage.getItem(BG_DISTANCE_KEY),
            ]);
            const bgCoords = bgCoordsRaw ? JSON.parse(bgCoordsRaw) : [];
            const bgDist = bgDistRaw ? Number(bgDistRaw) || 0 : 0;

            if (bgCoords.length > 0) {
              // Filter out coordinates we've already merged (by timestamp)
              const lastTs = lastMergedTimestampRef.current;
              const newCoords = bgCoords.filter(c => c.timestamp > lastTs);
              
              if (newCoords.length > 0) {
                // Calculate distance only for new coords with additional validation
                let newDist = 0;
                const existingLast = recordedPosRef.current[recordedPosRef.current.length - 1];
                let prevCoord = existingLast || null;
                let prevTs = existingLast?.timestamp || 0;
                const validCoords = [];
                
                for (const coord of newCoords) {
                  // Apply strict validation filters during merge
                  if (coord.accuracy && coord.accuracy > 20) continue; // Skip inaccurate readings
                  if (prevCoord) {
                    const d = haversineMeters(prevCoord, coord);
                    const dt = (coord.timestamp - prevTs) / 1000;
                    
                    // Skip impossible or suspicious movements
                    if (dt <= 0) continue; // Out of order
                    // Gap-aware speed check (max ~90 km/h = 25 m/s)
                    const speedMps = d / Math.max(dt, 0.5);
                    if (speedMps > 25) {
                      // Advance prevCoord to prevent cascading rejection
                      prevCoord = coord;
                      prevTs = coord.timestamp;
                      continue;
                    }
                    if (d > 100) {
                      // Large distance jump — advance anchor but don't accumulate distance
                      prevCoord = coord;
                      prevTs = coord.timestamp;
                      continue;
                    }
                    if (d < 3) continue; // Micro-jitter
                    
                    newDist += d;
                    applyMotionSegment(d, dt);
                  } else {
                    // First coord with no previous — validate against last recorded position
                    const lastRecorded = recordedPosRef.current[recordedPosRef.current.length - 1];
                    if (lastRecorded) {
                      const d = haversineMeters(lastRecorded, coord);
                      const dt = (coord.timestamp - (lastRecorded.timestamp || 0)) / 1000;
                      const speedMps = dt > 0 ? d / dt : 999;
                      if (speedMps > 25 || d > 300) {
                        // First bg coord after gap is suspicious — skip it
                        continue;
                      }
                    }
                  }
                  validCoords.push(coord);
                  prevCoord = coord;
                  prevTs = coord.timestamp;
                }

                if (validCoords.length > 0) {
                  console.log(`Merging ${validCoords.length} new background coordinates (${(newDist/1000).toFixed(2)} km)`);
                  
                  // Append new background coords to recorded positions
                  recordedPosRef.current = [...recordedPosRef.current, ...validCoords];
                  distanceRef.current += newDist;
                  setRecordedPositions([...recordedPosRef.current]);
                  setTripDistance(distanceRef.current);

                  // Update last merged timestamp
                  lastMergedTimestampRef.current = validCoords[validCoords.length - 1].timestamp;

                  // Update odometer with new distance
                  setOdometerKm((prev) => {
                    const nextKm = prev + newDist / 1000;
                    AsyncStorage.setItem(KM_KEY, String(nextKm)).catch(() => {});
                    return nextKm;
                  });

                  // Also add new coords to the display polyline
                  setPositions((prev) => {
                    const bgPoints = validCoords.map(c => ({ latitude: c.latitude, longitude: c.longitude }));
                    const merged = [...prev, ...bgPoints];
                    return merged.length > 5000 ? merged.slice(-5000) : merged;
                  });

                  updateLocalStorage(true);
                }
              }

              // Clear background accumulators and synced index after merge
              await Promise.all([
                AsyncStorage.setItem(BG_COORDS_KEY, '[]'),
                AsyncStorage.setItem(BG_DISTANCE_KEY, '0'),
                AsyncStorage.setItem(BG_SYNCED_INDEX_KEY, '0'),
              ]);
            }
          } catch (e) {
            console.warn('Error merging background coordinates:', e);
          }
        }
      }
    });

    return () => {
      appStateSubscription.remove();
    };
  }, [applyMotionSegment]);

  // Periodic background coordinate merge - checks every 5 seconds while recording
  // This catches screen-off scenarios where AppState may not change on some devices
  useEffect(() => {
    if (isRecording && activeTripId) {
      console.log('Starting periodic background coordinate merge check');
      
      const mergeBackgroundCoords = async () => {
        if (!isRecordingRef.current || !activeTripIdRef.current) return;
        
        try {
          const bgCoordsRaw = await AsyncStorage.getItem(BG_COORDS_KEY);
          const bgCoords = bgCoordsRaw ? JSON.parse(bgCoordsRaw) : [];
          
          if (bgCoords.length > 0) {
            // Filter out coordinates we've already merged (by timestamp)
            const lastTs = lastMergedTimestampRef.current;
            const newCoords = bgCoords.filter(c => c.timestamp > lastTs);
            
            if (newCoords.length > 0) {
              // Calculate distance only for new coords with validation
              let newDist = 0;
              const existingLast = recordedPosRef.current[recordedPosRef.current.length - 1];
              let prevCoord = existingLast || null;
              let prevTs = existingLast?.timestamp || 0;
              const validCoords = [];
              
              for (const coord of newCoords) {
                // Apply strict validation filters during periodic merge
                if (coord.accuracy && coord.accuracy > 20) continue; // Skip inaccurate readings
                
                if (prevCoord) {
                  const d = haversineMeters(prevCoord, coord);
                  const dt = (coord.timestamp - prevTs) / 1000;
                  
                  // Skip impossible or suspicious movements
                  if (dt <= 0) continue; // Out of order
                  // Gap-aware speed check (max ~90 km/h = 25 m/s)
                  const speedMps = d / Math.max(dt, 0.5);
                  if (speedMps > 25) {
                    // Advance anchor to prevent cascading rejection
                    prevCoord = coord;
                    prevTs = coord.timestamp;
                    continue;
                  }
                  if (d > 100) {
                    // Large distance jump — advance anchor but don't accumulate distance
                    prevCoord = coord;
                    prevTs = coord.timestamp;
                    continue;
                  }
                  if (d < 3) continue; // Micro-jitter
                  
                  newDist += d;
                  applyMotionSegment(d, dt);
                } else {
                  // First coord with no previous — validate against last recorded position
                  const lastRecorded = recordedPosRef.current[recordedPosRef.current.length - 1];
                  if (lastRecorded) {
                    const d = haversineMeters(lastRecorded, coord);
                    const dt = (coord.timestamp - (lastRecorded.timestamp || 0)) / 1000;
                    const speedMps = dt > 0 ? d / dt : 999;
                    if (speedMps > 25 || d > 300) {
                      continue;
                    }
                  }
                }
                validCoords.push(coord);
                prevCoord = coord;
                prevTs = coord.timestamp;
              }

              if (validCoords.length > 0) {
                console.log(`[Periodic merge] Merging ${validCoords.length} background coords (${(newDist/1000).toFixed(3)} km)`);
                
                // Append new coords
                recordedPosRef.current = [...recordedPosRef.current, ...validCoords];
                distanceRef.current += newDist;

                // Update last merged timestamp
                lastMergedTimestampRef.current = validCoords[validCoords.length - 1].timestamp;

                // Throttled UI updates to prevent excessive re-renders
                const now = Date.now();
                if (now - lastRecordedStateUpdateRef.current > RECORDED_STATE_THROTTLE_MS) {
                  setRecordedPositions([...recordedPosRef.current]);
                  setTripDistance(distanceRef.current);
                  lastRecordedStateUpdateRef.current = now;
                }

                // Update odometer
                setOdometerKm((prev) => {
                  const nextKm = prev + newDist / 1000;
                  AsyncStorage.setItem(KM_KEY, String(nextKm)).catch(() => {});
                  return nextKm;
                });

                // Update display polyline
                setPositions((prev) => {
                  const bgPoints = validCoords.map(c => ({ latitude: c.latitude, longitude: c.longitude }));
                  const merged = [...prev, ...bgPoints];
                  return merged.length > 5000 ? merged.slice(-5000) : merged;
                });
              }

              // Clear the merged coordinates from background storage
              await Promise.all([
                AsyncStorage.setItem(BG_COORDS_KEY, '[]'),
                AsyncStorage.setItem(BG_DISTANCE_KEY, '0'),
                AsyncStorage.setItem(BG_SYNCED_INDEX_KEY, '0'),
              ]);
            }
          }
        } catch (e) {
          console.warn('[Periodic merge] Error:', e);
        }
      };

      // Check immediately and then every 5 seconds
      mergeBackgroundCoords();
      bgMergeIntervalRef.current = setInterval(mergeBackgroundCoords, 5000);
      
      return () => {
        if (bgMergeIntervalRef.current) {
          clearInterval(bgMergeIntervalRef.current);
          bgMergeIntervalRef.current = null;
        }
      };
    }
  }, [isRecording, activeTripId, applyMotionSegment]);

  // Initialize device ID and check for active trip
  useEffect(() => {
    initializeDeviceTracking();
  }, []);

  // Sync pending offline trips on app startup
  useEffect(() => {
    const syncPendingOfflineTrips = async () => {
      try {
        const pendingEndRaw = await AsyncStorage.getItem(PENDING_TRIP_END_KEY);
        if (pendingEndRaw) {
          console.log('[OfflineSync] Found pending trip to sync...');

          const pendingEnd = JSON.parse(pendingEndRaw);
          const coords = pendingEnd.coordinates || pendingEnd.positions || [];
          const pendingStartRaw = await AsyncStorage.getItem(PENDING_TRIP_START_KEY);
          const pendingStart = pendingStartRaw ? JSON.parse(pendingStartRaw) : null;

          let serverTripId = pendingEnd.tripId && !isLocalTripId(pendingEnd.tripId)
            ? pendingEnd.tripId
            : null;

          try {
            if (!serverTripId) {
              const storedDeviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
              const initialCoordinate = pendingStart?.initialCoord || coords[0];

              if (!initialCoordinate) {
                console.log('[OfflineSync] Missing initial coordinate, keeping pending data for retry');
                return;
              }

              const startRes = await axios.post(`${BASE_URL}/api/tracking/start`, {
                deviceId: pendingStart?.deviceId || storedDeviceId,
                name: pendingStart?.name || `Offline Trip ${new Date().toLocaleDateString()}`,
                initialCoordinate,
                bookingId: pendingStart?.bookingId,
              }, { timeout: 10000 });

              if (startRes.data?.success && startRes.data?.tripId) {
                serverTripId = startRes.data.tripId;
                console.log('[OfflineSync] Created server trip:', serverTripId);
              }
            }

            if (serverTripId) {
              const finalCoordinates = coords.length > 1 ? coords.slice(1) : coords;
              await axios.post(`${BASE_URL}/api/tracking/${serverTripId}/end`, {
                finalCoordinates: finalCoordinates.length > 0 ? finalCoordinates : undefined,
              }, { timeout: 15000 });

              console.log('[OfflineSync] Successfully synced offline trip');
              await AsyncStorage.removeItem(PENDING_TRIP_END_KEY);
              await AsyncStorage.removeItem(PENDING_TRIP_START_KEY);
            }
          } catch (syncErr) {
            console.log('[OfflineSync] Sync failed, will retry later:', syncErr.message);
          }
        }
        
        // Check for trips that were started offline but never completed
        const pendingStartData = await AsyncStorage.getItem(PENDING_TRIP_START_KEY);
        if (pendingStartData && !isRecordingRef.current) {
          // This shouldn't normally happen - just clean up stale data
          console.log('[OfflineSync] Cleaning up stale pending start data');
          await AsyncStorage.removeItem(PENDING_TRIP_START_KEY);
        }
      } catch (err) {
        console.warn('[OfflineSync] Error syncing pending trips:', err);
      }
    };
    
    // Delay initial sync to let device initialize
    const syncTimer = setTimeout(syncPendingOfflineTrips, 5000);
    return () => clearTimeout(syncTimer);
  }, []);

  // Check for booking trigger to auto-start recording
  useEffect(() => {
    let checkInterval;
    
    const checkBookingTrigger = async () => {
      try {
        // Wait until device tracking is initialized (deviceId is set)
        if (!deviceId) return;

        const triggerData = await AsyncStorage.getItem(BOOKING_TRIGGER_RECORDING_KEY);
        // Use BOTH state and ref to guard against stale closures
        if (triggerData && !isRecording && !isRecordingRef.current && !activeTripIdRef.current) {
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
        isRecordingRef.current = true;
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
        const stats = computeMovingStats(savedPositions || []);
        movingTimeSecRef.current = stats.movingSeconds;
        maxTripSpeedKphRef.current = stats.maxSpeedKph;
        setTripMovingTime(Math.round(stats.movingSeconds));
        setTripMaxSpeedKph(Math.round(stats.maxSpeedKph * 10) / 10);
        setTripAvgMovingSpeedKph(
          stats.movingSeconds > 0
            ? Math.round(((dist / stats.movingSeconds) * 3.6) * 10) / 10
            : 0
        );
        // When resuming a trip, we don't know exactly what was synced before, 
        // so start fresh — coords may get re-synced but that's safer than missing data
        lastSyncedIndexRef.current = 0;
        // Set last merged timestamp to the last saved position's timestamp for deduplication
        if (savedPositions && savedPositions.length > 0) {
          const lastSaved = savedPositions[savedPositions.length - 1];
          lastMergedTimestampRef.current = lastSaved.timestamp || 0;
        } else {
          lastMergedTimestampRef.current = 0;
        }

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
          const timestamp = loc.timestamp || Date.now();

          // When DEV simulation is active, skip real GPS positions to prevent
          // spaghetti polyline between stationary real position and sim path
          if (!simActiveRef.current) {
            // Use display filter for polyline (less strict than trip recording)
            const displayResult = displayFilterRef.current.filter({
              latitude,
              longitude,
              accuracy: acc,
              timestamp,
            });
            
            if (displayResult.accepted) {
              setPositions((p) => {
                // Cap stored positions at 2000 to prevent memory bloat
                const next = [...p, newPoint];
                if (next.length > 2000) return next.slice(-2000);
                return next;
              });
            }
          }

          // Update additional GPS stats
          setAltitude(alt ? Math.round(alt * 10) / 10 : 0);
          setAccuracy(acc ? Math.round(acc * 10) / 10 : 0);
          setHeading(hdg ? Math.round(hdg) : 0);

          let kph = (typeof speed === 'number' && !isNaN(speed)) ? speed * 3.6 : 0;

          const last = lastPosRef.current;
          if ((!kph || kph === 0) && last) {
            const dt = (timestamp - last.timestamp) / 1000;
            if (dt > 0) {
              const meters = haversineMeters(
                { latitude: last.coords.latitude, longitude: last.coords.longitude },
                { latitude, longitude }
              );
              kph = (meters / dt) * 3.6;
            }
          }

          // Skip odometer, speed, camera from real GPS when sim is active
          if (!simActiveRef.current) {
            if (last) {
              const meters = haversineMeters(
                { latitude: last.coords.latitude, longitude: last.coords.longitude },
                { latitude, longitude }
              );
              const dt = (timestamp - last.timestamp) / 1000;
              // Enhanced odometer filter: check accuracy, distance bounds, and speed
              const isAccurate = !acc || acc <= 15;
              const isReasonableDistance = meters > 0.5 && meters < 100;
              const isReasonableSpeed = dt > 0 ? (meters / dt) * 3.6 < 90 : true; // Max 90 km/h for tricycle
              
              if (isAccurate && isReasonableDistance && isReasonableSpeed) {
                setOdometerKm((prev) => {
                  const nextKm = prev + meters / 1000;
                  AsyncStorage.setItem(KM_KEY, String(nextKm)).catch(() => {});
                  return nextKm;
                });
              }
            }

            setSpeedKph(Math.round(kph * 10) / 10);
          }
          lastPosRef.current = { coords: loc.coords, timestamp };

          if (follow && !reliveActiveRef.current && !simActiveRef.current && mapRef.current) {
            // When navigating with booking route, use Waze-style tilted + heading-locked camera
            if (activeBooking && bookingRoute) {
              updateNavigationCamera(
                { latitude, longitude },
                hdg || 0,
                kph || 0
              );
            } else {
              mapRef.current.animateCamera({ center: { latitude, longitude } }, { duration: 300 });
            }
          }

          // Handle trip recording with comprehensive GPS filtering
          // Skip real GPS recording when simulation is active — simulated coords
          // are already being recorded by the simulation broadcast listener above,
          // so real (stationary) GPS would pollute the route.
          if (activeTripIdRef.current && !simActiveRef.current) {
            const newCoord = {
              latitude,
              longitude,
              altitude: alt || 0,
              accuracy: acc || 0,
              speed: speed || 0,
              heading: hdg || 0,
              timestamp,
            };

            // Use the GPS filter for intelligent jitter/bounce detection
            const filterResult = gpsFilterRef.current.filter({
              latitude,
              longitude,
              accuracy: acc,
              timestamp,
            });

            if (filterResult.accepted) {
              const distance = filterResult.distance || 0;
              const prevAccepted = recordedPosRef.current[recordedPosRef.current.length - 1];
              const dt = prevAccepted ? ((newCoord.timestamp || 0) - (prevAccepted.timestamp || 0)) / 1000 : 0;
              if (distance > 0) {
                distanceRef.current += distance;
                setTripDistance(distanceRef.current);
                if (dt > 0) {
                  applyMotionSegment(distance, dt);
                }
              }
              recordedPosRef.current.push(newCoord);
              // Throttle state update to prevent excessive re-renders & OOM
              const now = Date.now();
              if (now - lastRecordedStateUpdateRef.current >= RECORDED_STATE_THROTTLE_MS) {
                lastRecordedStateUpdateRef.current = now;
                setRecordedPositions([...recordedPosRef.current]);
              }
              updateLocalStorage();
            }
            // Log filter rejections for debugging (uncomment if needed)
            // else if (filterResult.reason !== 'too_soon' && filterResult.reason !== 'insufficient_movement') {
            //   console.log(`GPS filtered: ${filterResult.reason}`, filterResult);
            // }
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
  }, [follow, applyMotionSegment]);

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
          pausesUpdatesAutomatically: false,
          activityType: Location.ActivityType.AutomotiveNavigation,
          showsBackgroundLocationIndicator: true,
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

  // ============== DEV-ONLY: BOOKING ROUTE SIMULATION ==============
  // Simulates a trip along the actual booking route while the driver stays stationary.
  // Records positions directly, updates odometer, and builds a relive-able path.
  // Only available in __DEV__ (development) builds when a booking is active.
  // Uses expo-keep-awake to keep the screen on during simulation.

  const devSimSpeedUp = useCallback(() => {
    const speeds = [0.5, 1, 2, 4, 8, 16];
    const curIdx = speeds.indexOf(devSimSpeedRef.current);
    if (curIdx < speeds.length - 1) {
      devSimSpeedRef.current = speeds[curIdx + 1];
      setDevSimSpeed(speeds[curIdx + 1]);
    }
  }, []);

  const devSimSlowDown = useCallback(() => {
    const speeds = [0.5, 1, 2, 4, 8, 16];
    const curIdx = speeds.indexOf(devSimSpeedRef.current);
    if (curIdx > 0) {
      devSimSpeedRef.current = speeds[curIdx - 1];
      setDevSimSpeed(speeds[curIdx - 1]);
    }
  }, []);

  const startDevSimulation = useCallback(async () => {
    if (!__DEV__) return; // safety guard
    if (devSimRunningRef.current) {
      Alert.alert('Simulation', 'A simulation is already running');
      return;
    }
    if (!bookingRoute || bookingRoute.length < 2) {
      Alert.alert('Simulation', 'No booking route available to simulate');
      return;
    }

    const routeCoords = bookingRoute; // [{latitude, longitude}, ...]
    const routeLabel = activeBooking?.passengerName
      ? `Booking - ${activeBooking.passengerName}`
      : 'Booking Route';

    // Prevent screen from sleeping during simulation
    try { await activateKeepAwakeAsync('dev_sim'); } catch (_) {}

    // Auto-start trip recording if not already recording
    if (!isRecordingRef.current && !activeTripIdRef.current) {
      try {
        const initialCoord = {
          latitude: routeCoords[0].latitude,
          longitude: routeCoords[0].longitude,
          altitude: 15,
          accuracy: 5,
          speed: 0,
          heading: 0,
          timestamp: Date.now(),
        };

        const response = await axios.post(`${BASE_URL}/api/tracking/start`, {
          deviceId: deviceId || 'dev_sim_device',
          name: `DEV Sim: ${routeLabel} ${new Date().toLocaleDateString()}`,
          initialCoordinate: initialCoord,
        });

        if (response.data.success) {
          const { tripId, startTime } = response.data;
          setActiveTripId(tripId);
          activeTripIdRef.current = tripId;
          setIsRecording(true);
          isRecordingRef.current = true;
          tripStartRef.current = new Date(startTime).getTime();
          recordedPosRef.current = [initialCoord];
          distanceRef.current = 0;
          lastSyncedIndexRef.current = 0;
          setRecordedPositions([initialCoord]);
          setTripDistance(0);
          setTripDuration(0);
          setTripMovingTime(0);
          setTripAvgMovingSpeedKph(0);
          setTripMaxSpeedKph(0);
          movingTimeSecRef.current = 0;
          maxTripSpeedKphRef.current = 0;
          await AsyncStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify({
            tripId,
            startTime: tripStartRef.current,
            positions: [initialCoord],
          }));
          syncIntervalRef.current = setInterval(syncToServer, SYNC_INTERVAL_MS);
          await AsyncStorage.setItem(BG_COORDS_KEY, '[]');
          await AsyncStorage.setItem(BG_DISTANCE_KEY, '0');
          await AsyncStorage.setItem(BG_SYNCED_INDEX_KEY, '0');
        }
      } catch (err) {
        console.warn('DEV sim: failed to auto-start recording', err);
      }
    }

    // Interpolate the booking route for smoother movement
    const points = interpolateWaypoints(routeCoords, 10);

    // Reset positions to start clean (no stale real GPS points)
    setPositions([{ latitude: points[0].latitude, longitude: points[0].longitude }]);

    devSimRunningRef.current = true;
    devSimCancelRef.current = false;
    devSimPausedRef.current = false;
    setDevSimRunning(true);
    setDevSimPaused(false);
    setDevSimProgress(0);
    setSimActive(true);
    simActiveRef.current = true;

    console.log(`DEV SIM: Starting "${routeLabel}" with ${points.length} points (from ${routeCoords.length} booking route coords)`);

    // Simulate walking through points with realistic timing
    const SIM_SPEED_MPS = 8; // ~29 km/h tricycle speed
    let lastSimPos = null;

    for (let i = 0; i < points.length; i++) {
      if (devSimCancelRef.current) break;

      // Pause loop
      while (devSimPausedRef.current && !devSimCancelRef.current) {
        await new Promise(r => setTimeout(r, 200));
      }
      if (devSimCancelRef.current) break;

      const pt = points[i];
      const now = Date.now();
      const hdg = lastSimPos ? headingBetween(lastSimPos, pt) : 0;
      const dist = lastSimPos ? haversineMeters(lastSimPos, pt) : 0;
      const speedMps = dist > 0 ? SIM_SPEED_MPS + (Math.random() * 2 - 1) : 0;

      const simCoord = {
        latitude: pt.latitude,
        longitude: pt.longitude,
        altitude: 15 + Math.random() * 3,
        accuracy: 3 + Math.random() * 2,
        speed: speedMps,
        heading: hdg,
        timestamp: now,
      };

      // ── Write sim broadcast for camera/UI updates via poll listener ──
      await AsyncStorage.setItem(SIM_BROADCAST_KEY, JSON.stringify({
        isActive: true,
        ...simCoord,
      }));

      // ── Directly add to positions array (polyline + current-session relive) ──
      const newPoint = { latitude: pt.latitude, longitude: pt.longitude };
      setPositions(prev => [...prev, newPoint].slice(-5000));

      // ── Directly record into trip for server sync + history relive ──
      if (activeTripIdRef.current && isRecordingRef.current) {
        if (recordedPosRef.current.length > 0) {
          const lastRecorded = recordedPosRef.current[recordedPosRef.current.length - 1];
          const meters = haversineMeters(lastRecorded, simCoord);
          if (meters >= 0.5 && meters <= 500) {
            distanceRef.current += meters;
            setTripDistance(distanceRef.current);
            recordedPosRef.current.push(simCoord);
            const tn = Date.now();
            if (tn - lastRecordedStateUpdateRef.current >= RECORDED_STATE_THROTTLE_MS) {
              lastRecordedStateUpdateRef.current = tn;
              setRecordedPositions([...recordedPosRef.current]);
            }
            updateLocalStorage();
          }
        } else {
          recordedPosRef.current.push(simCoord);
          setRecordedPositions([...recordedPosRef.current]);
          updateLocalStorage(true);
        }
      }

      // ── Update odometer directly ──
      if (lastSimPos) {
        const meters = haversineMeters(lastSimPos, newPoint);
        if (meters > 0.5 && meters < 500) {
          setOdometerKm(prev => {
            const nextKm = prev + meters / 1000;
            AsyncStorage.setItem(KM_KEY, String(nextKm)).catch(() => {});
            return nextKm;
          });
        }
      }

      // ── Update speed display ──
      if (speedMps > 0) {
        setSpeedKph(Math.round(speedMps * 3.6 * 10) / 10);
      }

      // Update progress
      setDevSimProgress((i + 1) / points.length);

      // Wait realistic interval based on distance, divided by speed multiplier
      const baseDelayMs = dist > 0 ? (dist / SIM_SPEED_MPS) * 1000 : 300;
      const adjustedDelay = Math.min(Math.max(baseDelayMs / devSimSpeedRef.current, 50), 2000);
      await new Promise(r => setTimeout(r, adjustedDelay));

      lastSimPos = pt;
    }

    // Cleanup
    const reachedEnd = !devSimCancelRef.current;
    await AsyncStorage.setItem(SIM_BROADCAST_KEY, JSON.stringify({
      isActive: false,
      reachedDestination: reachedEnd,
      ...(reachedEnd && lastSimPos ? { latitude: lastSimPos.latitude, longitude: lastSimPos.longitude } : {}),
    }));
    devSimRunningRef.current = false;
    setDevSimRunning(false);
    setDevSimProgress(reachedEnd ? 1 : 0);
    // Allow screen to sleep again
    try { deactivateKeepAwake('dev_sim'); } catch (_) {}

    if (reachedEnd) {
      // Keep simActive true so the blue dot stays hidden and icon stays at destination
      // (will be cleared when trip is completed/cancelled or manual stop)
      setSimActive(true);
      simActiveRef.current = true;
      // Force a final recordedPositions state update so relive has all points
      setRecordedPositions([...recordedPosRef.current]);
      Alert.alert('DEV Simulation Complete', `Route "${routeLabel}" reached destination.\nYou can now complete the trip from the booking screen.`);
    }
  }, [deviceId, bookingRoute, activeBooking]);

  const stopDevSimulation = useCallback(async () => {
    devSimCancelRef.current = true;
    devSimPausedRef.current = false;
    setDevSimPaused(false);
    await AsyncStorage.setItem(SIM_BROADCAST_KEY, JSON.stringify({ isActive: false, reachedDestination: false }));
    devSimRunningRef.current = false;
    setDevSimRunning(false);
    setDevSimProgress(0);
    // Clear sim so native blue dot comes back
    setSimActive(false);
    simActiveRef.current = false;
    try { deactivateKeepAwake('dev_sim'); } catch (_) {}
  }, []);

  const toggleDevSimPause = useCallback(() => {
    const next = !devSimPausedRef.current;
    devSimPausedRef.current = next;
    setDevSimPaused(next);
  }, []);

  // Clear sim state when booking ends (trip completed/cancelled)
  useEffect(() => {
    if (!activeBooking && simActive) {
      setSimActive(false);
      simActiveRef.current = false;
      AsyncStorage.setItem(SIM_BROADCAST_KEY, JSON.stringify({ isActive: false, reachedDestination: false })).catch(() => {});
    }
  }, [activeBooking, simActive]);

  // ============== TRIP RECORDING ==============

  const updateLocalStorage = async (force = false) => {
    const now = Date.now();
    if (!force && now - lastLocalStorageWriteRef.current < LOCAL_STORAGE_THROTTLE_MS) {
      // Schedule a deferred write if one isn't already pending
      if (!pendingStorageWriteRef.current) {
        pendingStorageWriteRef.current = setTimeout(() => {
          pendingStorageWriteRef.current = null;
          updateLocalStorage(true);
        }, LOCAL_STORAGE_THROTTLE_MS);
      }
      return;
    }
    lastLocalStorageWriteRef.current = now;
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

    // Skip sync if we have a local (offline) trip ID - wait until we get a server ID
    if (isLocalTripId(activeTripIdRef.current)) {
      console.log('Offline mode - coordinates saved locally, waiting for server connection');
      return;
    }

    // Only sync coordinates that haven't been sent yet
    const startIdx = lastSyncedIndexRef.current;
    const allCoords = recordedPosRef.current;
    const coordsToSync = allCoords.slice(startIdx, startIdx + SYNC_BATCH_SIZE);
    if (coordsToSync.length < 3) return;

    setIsSyncing(true);
    try {
      await axios.post(`${BASE_URL}/api/tracking/${activeTripIdRef.current}/sync`, {
        coordinates: coordsToSync,
      }, { timeout: 15000 });
      lastSyncedIndexRef.current = startIdx + coordsToSync.length;
      console.log(`Synced ${coordsToSync.length} coordinates (index ${startIdx}→${lastSyncedIndexRef.current})`);
    } catch (error) {
      // If trip no longer exists (404), stop syncing to avoid repeated errors
      if (error.response?.status === 404) {
        console.log('Trip no longer active, stopping sync interval');
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
          syncIntervalRef.current = null;
        }
      } else {
        // Network error - coordinates stay local, will retry next interval
        console.log('Sync failed (will retry):', error.message);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Helper function to initialize local recording state (used by both online and offline start)
  const initializeLocalRecording = async (tripId, startTime, initialCoord, isOffline = false) => {
    setActiveTripId(tripId);
    activeTripIdRef.current = tripId;
    setIsRecording(true);
    isRecordingRef.current = true;
    tripStartRef.current = startTime;
    recordedPosRef.current = [initialCoord];
    distanceRef.current = 0;
    lastSyncedIndexRef.current = 0;
    lastMergedTimestampRef.current = initialCoord.timestamp;
    setRecordedPositions([initialCoord]);
    setTripDistance(0);
    setTripDuration(0);
    setTripMovingTime(0);
    setTripAvgMovingSpeedKph(0);
    setTripMaxSpeedKph(0);
    setIsOfflineMode(isOffline);
    pendingServerTripIdRef.current = null;
    movingTimeSecRef.current = 0;
    maxTripSpeedKphRef.current = 0;

    // Reset GPS filter for new trip
    gpsFilterRef.current.reset();
    displayFilterRef.current.reset();

    // Save to AsyncStorage for persistence
    await AsyncStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify({
      tripId,
      startTime,
      positions: [initialCoord],
      isOffline,
    }));

    // Clear any stale background coordinates
    await Promise.all([
      AsyncStorage.setItem(BG_COORDS_KEY, '[]'),
      AsyncStorage.setItem(BG_DISTANCE_KEY, '0'),
      AsyncStorage.setItem(BG_SYNCED_INDEX_KEY, '0'),
    ]);

    // Keep screen awake while recording
    try { await activateKeepAwakeAsync('trip_recording'); } catch (_) {}

    // Start background location task
    try {
      const bgPerm = await Location.requestBackgroundPermissionsAsync();
      if (bgPerm.status === 'granted') {
        if (lastPosRef.current) {
          await AsyncStorage.setItem('bg_last_position_v1', JSON.stringify({
            latitude: lastPosRef.current.coords?.latitude ?? initialCoord.latitude,
            longitude: lastPosRef.current.coords?.longitude ?? initialCoord.longitude,
          }));
          await AsyncStorage.setItem('bg_last_ts_v1', String(Date.now()));
        }
        const isRegistered = await TaskManager.isTaskRegisteredAsync(BG_TASK_NAME);
        if (!isRegistered) {
          await Location.startLocationUpdatesAsync(BG_TASK_NAME, {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 2000,
            distanceInterval: 1,
            foregroundService: {
              notificationTitle: 'Trip Recording Active',
              notificationBody: isOffline ? 'Recording offline - will sync when connected' : 'Your trip is being recorded',
              notificationColor: '#FF0000',
            },
            pausesUpdatesAutomatically: false,
            activityType: Location.ActivityType.AutomotiveNavigation,
            showsBackgroundLocationIndicator: true,
          });
        }
      }
    } catch (bgErr) {
      console.warn('Error starting background tracking:', bgErr);
    }

    // Start sync interval (will handle both online and offline modes)
    syncIntervalRef.current = setInterval(syncToServer, SYNC_INTERVAL_MS);

    // If offline, also start the offline sync retry interval
    if (isOffline) {
      offlineSyncIntervalRef.current = setInterval(tryCreateTripOnServer, OFFLINE_SYNC_RETRY_MS);
    }
  };

  // Try to create the offline trip on server (called periodically when in offline mode)
  const tryCreateTripOnServer = async () => {
    if (!isOfflineMode || !activeTripIdRef.current || !isLocalTripId(activeTripIdRef.current)) {
      return;
    }

    try {
      const pendingRaw = await AsyncStorage.getItem(PENDING_TRIP_START_KEY);
      if (!pendingRaw) return;

      const pending = JSON.parse(pendingRaw);
      console.log('Attempting to sync offline trip to server...');

      const response = await axios.post(`${BASE_URL}/api/tracking/start`, {
        deviceId: pending.deviceId,
        name: pending.name,
        initialCoordinate: pending.initialCoord,
        bookingId: pending.bookingId,
      });

      if (response.data.success) {
        const { tripId: serverTripId, startTime } = response.data;
        console.log(`Offline trip synced! Local: ${activeTripIdRef.current} → Server: ${serverTripId}`);

        // Update trip ID to server ID
        const oldLocalId = activeTripIdRef.current;
        setActiveTripId(serverTripId);
        activeTripIdRef.current = serverTripId;
        pendingServerTripIdRef.current = serverTripId;
        setIsOfflineMode(false);

        // Update AsyncStorage
        const activeTripRaw = await AsyncStorage.getItem(ACTIVE_TRIP_KEY);
        if (activeTripRaw) {
          const activeTrip = JSON.parse(activeTripRaw);
          activeTrip.tripId = serverTripId;
          activeTrip.isOffline = false;
          activeTrip.localTripId = oldLocalId; // Keep reference to old ID
          await AsyncStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(activeTrip));
        }

        // Clear pending trip start
        await AsyncStorage.removeItem(PENDING_TRIP_START_KEY);

        // Stop the offline sync interval
        if (offlineSyncIntervalRef.current) {
          clearInterval(offlineSyncIntervalRef.current);
          offlineSyncIntervalRef.current = null;
        }

        // Now sync all accumulated coordinates
        const allCoords = recordedPosRef.current;
        if (allCoords.length > 1) {
          try {
            await axios.post(`${BASE_URL}/api/tracking/${serverTripId}/sync`, {
              coordinates: allCoords.slice(1), // Skip first coord (already sent with start)
            });
            lastSyncedIndexRef.current = allCoords.length;
            console.log(`Synced ${allCoords.length - 1} offline coordinates to server`);
          } catch (syncErr) {
            console.warn('Failed to sync offline coordinates:', syncErr.message);
          }
        }

        Alert.alert('Online', 'Trip synced to server. Recording continues.');
      }
    } catch (error) {
      // Still offline or server error - will retry later
      console.log('Still offline, will retry sync later:', error.message);
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

      const tripName = `Driver Trip ${new Date().toLocaleDateString()}`;
      let tripId;
      let startTime = Date.now();
      let isOffline = false;

      // Try to start trip on server first
      try {
        const response = await axios.post(`${BASE_URL}/api/tracking/start`, {
          deviceId,
          name: tripName,
          initialCoordinate: initialCoord,
        }, { timeout: 10000 }); // 10 second timeout

        if (response.data.success) {
          tripId = response.data.tripId;
          startTime = new Date(response.data.startTime).getTime();
        } else {
          throw new Error(response.data.message);
        }
      } catch (serverError) {
        // Check if it's a network error (offline) vs server error
        const isNetworkError = !serverError.response || 
          serverError.code === 'ECONNABORTED' ||
          serverError.message?.includes('Network Error') ||
          serverError.message?.includes('timeout');

        // Handle existing active trip (400 with tripId)
        const errorData = serverError.response?.data;
        if (errorData?.tripId) {
          // Existing trip on server - show dialog
          Alert.alert(
            'Existing Trip Found',
            'You have an active trip. Would you like to resume or cancel it?',
            [
              {
                text: 'Cancel Old Trip',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await axios.post(`${BASE_URL}/api/tracking/${errorData.tripId}/cancel`);
                    await AsyncStorage.removeItem(ACTIVE_TRIP_KEY);
                    setIsRecording(false);
                    setActiveTripId(null);
                    activeTripIdRef.current = null;
                    recordedPosRef.current = [];
                    setRecordedPositions([]);
                    Alert.alert('Cancelled', 'Old trip cancelled. You can start a new recording now.');
                  } catch (cancelErr) {
                    Alert.alert('Error', 'Failed to cancel old trip.');
                  }
                },
              },
              {
                text: 'Resume Trip',
                onPress: async () => {
                  await initializeLocalRecording(errorData.tripId, Date.now(), initialCoord, false);
                  Alert.alert('Resumed', 'Continuing with existing trip recording.');
                },
              },
              { text: 'Dismiss', style: 'cancel' },
            ]
          );
          return;
        }

        if (isNetworkError) {
          // Offline - generate local trip ID and continue
          console.log('Network unavailable - starting offline recording');
          tripId = generateLocalTripId();
          isOffline = true;

          // Save pending trip start for later sync
          await AsyncStorage.setItem(PENDING_TRIP_START_KEY, JSON.stringify({
            deviceId,
            name: tripName,
            initialCoord,
            localTripId: tripId,
            startTime,
          }));
        } else {
          // Server error - show error
          throw serverError;
        }
      }

      // Initialize recording (works both online and offline)
      await initializeLocalRecording(tripId, startTime, initialCoord, isOffline);

      if (isOffline) {
        Alert.alert('Recording Started (Offline)', 'Your trip is being recorded locally. It will sync to the server when you have internet connection.');
      } else {
        Alert.alert('Recording Started', 'Your trip is being recorded');
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to start recording');
    }
  };

  // Start recording triggered from booking screen (auto-start without alert, offline-first)
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

    // Guard: if already recording, skip
    if (isRecordingRef.current && activeTripIdRef.current) {
      console.log('Already recording trip', activeTripIdRef.current, '— skipping auto-start from booking');
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

      const tripName = passengerName 
        ? `Booking Trip - ${passengerName} ${new Date().toLocaleDateString()}`
        : `Booking Trip ${new Date().toLocaleDateString()}`;

      let tripId;
      let startTime = Date.now();
      let isOffline = false;

      // Try to start trip on server first
      try {
        const response = await axios.post(`${BASE_URL}/api/tracking/start`, {
          deviceId,
          name: tripName,
          initialCoordinate: initialCoord,
          bookingId,
        }, { timeout: 10000 });

        if (response.data.success) {
          tripId = response.data.tripId;
          startTime = new Date(response.data.startTime).getTime();
        } else {
          throw new Error(response.data.message);
        }
      } catch (serverError) {
        const isNetworkError = !serverError.response || 
          serverError.code === 'ECONNABORTED' ||
          serverError.message?.includes('Network Error') ||
          serverError.message?.includes('timeout');

        // Handle existing active trip
        const errorData = serverError.response?.data;
        if (errorData?.tripId && serverError.response?.status === 400) {
          console.log('Resuming existing active trip from booking trigger:', errorData.tripId);
          await initializeLocalRecording(errorData.tripId, Date.now(), initialCoord, false);
          console.log('Resumed existing trip:', errorData.tripId);
          return;
        }

        if (isNetworkError) {
          // Offline - generate local trip ID
          console.log('Network unavailable - starting offline recording from booking');
          tripId = generateLocalTripId();
          isOffline = true;

          // Save pending trip start
          await AsyncStorage.setItem(PENDING_TRIP_START_KEY, JSON.stringify({
            deviceId,
            name: tripName,
            initialCoord,
            bookingId,
            localTripId: tripId,
            startTime,
          }));
        } else {
          throw serverError;
        }
      }

      // Initialize recording (works both online and offline)
      await initializeLocalRecording(tripId, startTime, initialCoord, isOffline);
      
      console.log(`Auto-started recording from booking: ${tripId}${isOffline ? ' (offline)' : ''}`);
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
      // Clear offline sync interval if running
      if (offlineSyncIntervalRef.current) {
        clearInterval(offlineSyncIntervalRef.current);
        offlineSyncIntervalRef.current = null;
      }
      // Clear periodic background merge interval
      if (bgMergeIntervalRef.current) {
        clearInterval(bgMergeIntervalRef.current);
        bgMergeIntervalRef.current = null;
      }
      // Clear any pending throttled storage write
      if (pendingStorageWriteRef.current) {
        clearTimeout(pendingStorageWriteRef.current);
        pendingStorageWriteRef.current = null;
      }

      // Stop background tracking and keepAwake
      try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(BG_TASK_NAME);
        if (isRegistered) {
          await Location.stopLocationUpdatesAsync(BG_TASK_NAME);
          console.log('Background tracking stopped on trip save');
        }
      } catch (bgStopErr) { console.warn('Error stopping bg task on save:', bgStopErr); }
      try { deactivateKeepAwake('trip_recording'); } catch (_) {}

      // Merge any remaining background coordinates before saving
      try {
        const [bgCoordsRaw, bgDistRaw] = await Promise.all([
          AsyncStorage.getItem(BG_COORDS_KEY),
          AsyncStorage.getItem(BG_DISTANCE_KEY),
        ]);
        const bgCoords = bgCoordsRaw ? JSON.parse(bgCoordsRaw) : [];
        if (bgCoords.length > 0) {
          const lastTs = lastMergedTimestampRef.current;
          const newCoords = bgCoords.filter(c => c.timestamp > lastTs);
          
          if (newCoords.length > 0) {
            let newDist = 0;
            const existingLast = recordedPosRef.current[recordedPosRef.current.length - 1];
            let prevCoord = existingLast || null;
            let prevTs = existingLast?.timestamp || 0;
            const validCoords = [];
            for (const coord of newCoords) {
              if (coord.accuracy && coord.accuracy > 30) continue;
              if (prevCoord) {
                const d = haversineMeters(prevCoord, coord);
                const dt = (coord.timestamp - prevTs) / 1000;
                if (d > 120) continue;
                if (dt <= 0 || dt > 30) continue;
                if ((d / dt) > 33.33) continue;
                if (d < 2) continue;
                newDist += d;
                applyMotionSegment(d, dt);
              }
              validCoords.push(coord);
              prevCoord = coord;
              prevTs = coord.timestamp;
            }
            if (validCoords.length > 0) {
              console.log(`Merging ${validCoords.length} final background coords before save (${(newDist/1000).toFixed(3)} km)`);
              recordedPosRef.current = [...recordedPosRef.current, ...validCoords];
              distanceRef.current += newDist;
              lastMergedTimestampRef.current = validCoords[validCoords.length - 1].timestamp;
            }
          }
        }
        await Promise.all([
          AsyncStorage.setItem(BG_COORDS_KEY, '[]'),
          AsyncStorage.setItem(BG_DISTANCE_KEY, '0'),
          AsyncStorage.setItem(BG_SYNCED_INDEX_KEY, '0'),
        ]);
      } catch (mergeErr) { console.warn('Error merging bg coords on save:', mergeErr); }

      let tripId = activeTripIdRef.current;
      if (!tripId) {
        Alert.alert('Error', 'No active trip ID found. Trip may have already been saved or discarded.');
        return;
      }

      const allCoords = recordedPosRef.current;
      const totalDistanceMeters = distanceRef.current;
      const durationSeconds = tripStartRef.current ? Math.floor((Date.now() - tripStartRef.current) / 1000) : 0;

      // Handle offline trip - need to create on server first, then end
      if (isLocalTripId(tripId)) {
        console.log('Saving offline trip - attempting to sync to server...');
        
        try {
          // Get pending trip start data
          const pendingRaw = await AsyncStorage.getItem(PENDING_TRIP_START_KEY);
          if (pendingRaw) {
            const pending = JSON.parse(pendingRaw);
            
            // Try to create trip on server
            const startResponse = await axios.post(`${BASE_URL}/api/tracking/start`, {
              deviceId: pending.deviceId,
              name: pending.name,
              initialCoordinate: pending.initialCoord,
              bookingId: pending.bookingId,
            }, { timeout: 15000 });

            if (startResponse.data.success) {
              tripId = startResponse.data.tripId;
              console.log(`Offline trip created on server: ${tripId}`);
              await AsyncStorage.removeItem(PENDING_TRIP_START_KEY);
            }
          }
        } catch (createErr) {
          console.log('Could not create trip on server:', createErr.message);
          
          // Still offline - save trip data locally for later sync
          const pendingEndData = {
            localTripId: tripId,
            coordinates: allCoords,
            totalDistance: totalDistanceMeters,
            duration: durationSeconds,
            savedAt: Date.now(),
          };
          await AsyncStorage.setItem(PENDING_TRIP_END_KEY, JSON.stringify(pendingEndData));
          
          // Clear state
          await AsyncStorage.removeItem(ACTIVE_TRIP_KEY);
          setIsRecording(false);
          setIsOfflineMode(false);
          setActiveTripId(null);
          activeTripIdRef.current = null;
          setRecordedPositions([]);
          setTripDistance(0);
          setTripDuration(0);
          setTripMovingTime(0);
          setTripAvgMovingSpeedKph(0);
          setTripMaxSpeedKph(0);
          recordedPosRef.current = [];
          tripStartRef.current = null;
          distanceRef.current = 0;
          lastSyncedIndexRef.current = 0;
          lastMergedTimestampRef.current = 0;
          movingTimeSecRef.current = 0;
          maxTripSpeedKphRef.current = 0;

          Alert.alert(
            'Trip Saved Locally',
            `Distance: ${(totalDistanceMeters / 1000).toFixed(2)} km\nDuration: ${formatDuration(durationSeconds)}\n\nYour trip has been saved locally and will sync to the server when you have internet connection.`,
            [{ text: 'OK' }]
          );
          return;
        }
      }

      // Now end the trip on server (either regular trip or just-created offline trip)
      const unsynced = allCoords.slice(lastSyncedIndexRef.current);
      console.log(`Ending trip ${tripId} with ${unsynced.length} unsent coords`);

      const response = await axios.post(`${BASE_URL}/api/tracking/${tripId}/end`, {
        finalCoordinates: unsynced.length > 0 ? unsynced : undefined,
      }, { timeout: 15000 });

      if (response.data.success) {
        const { trip } = response.data;

        // Sync odometer to server after trip ends
        try {
          const trikeId = await AsyncStorage.getItem('active_tricycle_id');
          if (trikeId) {
            const currentKmStr = await AsyncStorage.getItem(KM_KEY);
            const currentKm = currentKmStr ? parseFloat(currentKmStr) : 0;
            if (currentKm > 0) {
              await axios.put(`${BASE_URL}/api/tricycles/${trikeId}/odometer`, {
                odometer: Math.round(currentKm),
              });
              console.log('Odometer synced to server:', Math.round(currentKm));
            }
          }
        } catch (syncErr) {
          console.warn('Failed to sync odometer after trip:', syncErr);
        }

        Alert.alert(
          'Trip Saved!',
          `Distance: ${(trip.totalDistance / 1000).toFixed(2)} km\nDuration: ${trip.formattedDuration}`,
          [{ text: 'OK' }]
        );
      }

      // Clear state
      await AsyncStorage.removeItem(ACTIVE_TRIP_KEY);
      await AsyncStorage.removeItem(PENDING_TRIP_START_KEY);
      setIsRecording(false);
      setIsOfflineMode(false);
      setActiveTripId(null);
      activeTripIdRef.current = null;
      setRecordedPositions([]);
      setTripDistance(0);
      setTripDuration(0);
      setTripMovingTime(0);
      setTripAvgMovingSpeedKph(0);
      setTripMaxSpeedKph(0);
      recordedPosRef.current = [];
      tripStartRef.current = null;
      distanceRef.current = 0;
      lastSyncedIndexRef.current = 0;
      lastMergedTimestampRef.current = 0;
      movingTimeSecRef.current = 0;
      maxTripSpeedKphRef.current = 0;

    } catch (error) {
      const status = error.response?.status;
      const serverMsg = error.response?.data?.message;
      console.error('Error saving trip:', status, serverMsg, error.message);

      // Check if it's a network error - save locally
      const isNetworkError = !error.response || 
        error.code === 'ECONNABORTED' ||
        error.message?.includes('Network Error') ||
        error.message?.includes('timeout');

      if (isNetworkError) {
        // Save trip data locally for later sync
        const totalDistanceMeters = distanceRef.current;
        const durationSeconds = tripStartRef.current ? Math.floor((Date.now() - tripStartRef.current) / 1000) : 0;
        
        const pendingEndData = {
          tripId: activeTripIdRef.current,
          coordinates: recordedPosRef.current,
          totalDistance: totalDistanceMeters,
          duration: durationSeconds,
          savedAt: Date.now(),
        };
        await AsyncStorage.setItem(PENDING_TRIP_END_KEY, JSON.stringify(pendingEndData));
        
        // Clear state
        await AsyncStorage.removeItem(ACTIVE_TRIP_KEY);
        setIsRecording(false);
        setIsOfflineMode(false);
        setActiveTripId(null);
        activeTripIdRef.current = null;
        setRecordedPositions([]);
        setTripDistance(0);
        setTripDuration(0);
        setTripMovingTime(0);
        setTripAvgMovingSpeedKph(0);
        setTripMaxSpeedKph(0);
        recordedPosRef.current = [];
        tripStartRef.current = null;
        distanceRef.current = 0;
        lastSyncedIndexRef.current = 0;
        lastMergedTimestampRef.current = 0;
        movingTimeSecRef.current = 0;
        maxTripSpeedKphRef.current = 0;

        Alert.alert(
          'Trip Saved Locally',
          `Distance: ${(totalDistanceMeters / 1000).toFixed(2)} km\nDuration: ${formatDuration(durationSeconds)}\n\nNo internet connection. Your trip has been saved locally and will sync when you reconnect.`,
          [{ text: 'OK' }]
        );
        return;
      }

      if (status === 404) {
        Alert.alert(
          'Trip Not Found',
          'The trip was not found on the server (it may have been cancelled or already saved). Clearing local state.',
          [{
            text: 'OK',
            onPress: async () => {
              await AsyncStorage.removeItem(ACTIVE_TRIP_KEY);
              setIsRecording(false);
              isRecordingRef.current = false;
              setActiveTripId(null);
              activeTripIdRef.current = null;
              setRecordedPositions([]);
              setTripDistance(0);
              setTripDuration(0);
              setTripMovingTime(0);
              setTripAvgMovingSpeedKph(0);
              setTripMaxSpeedKph(0);
              recordedPosRef.current = [];
              tripStartRef.current = null;
              distanceRef.current = 0;
              lastSyncedIndexRef.current = 0;
              movingTimeSecRef.current = 0;
              maxTripSpeedKphRef.current = 0;
            },
          }]
        );
      } else if (status === 409) {
        // Trip was cancelled by something else (booking auto-start, etc.)
        const currentStatus = error.response?.data?.currentStatus || 'unknown';
        Alert.alert(
          'Trip Was Cancelled',
          `This trip was '${currentStatus}' and could not be saved. This can happen if a booking auto-start cancelled a previous recording. Clearing local state.`,
          [{
            text: 'OK',
            onPress: async () => {
              await AsyncStorage.removeItem(ACTIVE_TRIP_KEY);
              setIsRecording(false);
              isRecordingRef.current = false;
              setActiveTripId(null);
              activeTripIdRef.current = null;
              setRecordedPositions([]);
              setTripDistance(0);
              setTripDuration(0);
              setTripMovingTime(0);
              setTripAvgMovingSpeedKph(0);
              setTripMaxSpeedKph(0);
              recordedPosRef.current = [];
              tripStartRef.current = null;
              distanceRef.current = 0;
              lastSyncedIndexRef.current = 0;
              movingTimeSecRef.current = 0;
              maxTripSpeedKphRef.current = 0;
            },
          }]
        );
      } else {
        Alert.alert('Error', `Failed to save trip: ${serverMsg || error.message}`);
      }
    }
  };

  const discardTrip = async () => {
    try {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      // Clear offline sync interval if running
      if (offlineSyncIntervalRef.current) {
        clearInterval(offlineSyncIntervalRef.current);
        offlineSyncIntervalRef.current = null;
      }
      // Clear periodic background merge interval
      if (bgMergeIntervalRef.current) {
        clearInterval(bgMergeIntervalRef.current);
        bgMergeIntervalRef.current = null;
      }
      // Clear any pending throttled storage write
      if (pendingStorageWriteRef.current) {
        clearTimeout(pendingStorageWriteRef.current);
        pendingStorageWriteRef.current = null;
      }

      // Stop background tracking and keepAwake
      try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(BG_TASK_NAME);
        if (isRegistered) {
          await Location.stopLocationUpdatesAsync(BG_TASK_NAME);
          console.log('Background tracking stopped on trip discard');
        }
      } catch (bgStopErr) { console.warn('Error stopping bg task on discard:', bgStopErr); }
      try { deactivateKeepAwake('trip_recording'); } catch (_) {}
      // Clear background accumulators
      await Promise.all([
        AsyncStorage.setItem(BG_COORDS_KEY, '[]'),
        AsyncStorage.setItem(BG_DISTANCE_KEY, '0'),
        AsyncStorage.setItem(BG_SYNCED_INDEX_KEY, '0'),
      ]).catch(() => {});

      // Cancel on server (only if not a local/offline trip)
      if (activeTripIdRef.current && !isLocalTripId(activeTripIdRef.current)) {
        try {
          await axios.post(`${BASE_URL}/api/tracking/${activeTripIdRef.current}/cancel`, {}, { timeout: 10000 });
        } catch (cancelErr) {
          console.log('Could not cancel on server (may be offline):', cancelErr.message);
        }
      }

      // Clear state and offline pending data
      await Promise.all([
        AsyncStorage.removeItem(ACTIVE_TRIP_KEY),
        AsyncStorage.removeItem(PENDING_TRIP_START_KEY),
        AsyncStorage.removeItem(PENDING_TRIP_END_KEY),
      ]);
      setIsRecording(false);
      setIsOfflineMode(false);
      setActiveTripId(null);
      activeTripIdRef.current = null;
      setRecordedPositions([]);
      setTripDistance(0);
      setTripDuration(0);
      setTripMovingTime(0);
      setTripAvgMovingSpeedKph(0);
      setTripMaxSpeedKph(0);
      recordedPosRef.current = [];
      tripStartRef.current = null;
      distanceRef.current = 0;
      lastSyncedIndexRef.current = 0;
      lastMergedTimestampRef.current = 0;
      movingTimeSecRef.current = 0;
      maxTripSpeedKphRef.current = 0;

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
        const tripData = response.data.trip;
        // Set positions from trip data — include speed, heading, altitude for stats overlay
        let coords = tripData.coordinates.map(c => ({
          latitude: c.latitude,
          longitude: c.longitude,
          timestamp: c.timestamp ? new Date(c.timestamp).getTime() : 0,
          altitude: c.altitude || 0,
          speed: c.speed || 0,
          heading: c.heading || 0,
          accuracy: c.accuracy || 0,
        }));

        // ── Fix crazy lines: sort, deduplicate, and filter GPS spikes ──

        // 1. Sort chronologically by timestamp
        coords.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        // 2. Deduplicate (same timestamp + location = same reading synced multiple times)
        const seen = new Set();
        coords = coords.filter(c => {
          const key = `${c.timestamp}_${c.latitude.toFixed(6)}_${c.longitude.toFixed(6)}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // 3. Remove GPS spikes (impossible speed jumps between consecutive points)
        if (coords.length >= 2) {
          const cleaned = [coords[0]];
          for (let i = 1; i < coords.length; i++) {
            const prev = cleaned[cleaned.length - 1];
            const curr = coords[i];
            const dist = haversineMeters(prev, curr);
            const dt = ((curr.timestamp || 0) - (prev.timestamp || 0)) / 1000;

            // Skip if: no time delta, impossibly fast (>100 km/h), or huge jump with tiny dt
            if (dt <= 0) continue;
            const speedMps = dist / dt;
            if (speedMps > 28) continue; // ~100 km/h max for tricycle
            if (dist > 500 && dt < 10) continue; // 500m jump in <10s

            cleaned.push(curr);
          }
          coords = cleaned;
        }

        if (coords.length < 2) {
          Alert.alert('Error', 'Trip has insufficient data after filtering for playback');
          return;
        }

        setPositions(coords);

        // Store trip-level stats for relive overlay
        setReliveStats({
          totalDistance: tripData.totalDistance || 0,
          duration: tripData.duration || 0,
          avgSpeed: tripData.avgSpeed || 0,
          maxSpeed: tripData.maxSpeed || 0,
          elevationGain: tripData.elevationGain || 0,
          name: tripData.name || trip.name || 'Trip',
        });
        
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
    setReliveCurrentSpeed(0);
    setReliveCurrentAltitude(0);
    setReliveDistanceCovered(0);
    setReliveStats(null);
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

    // Update speed from coordinate data (speed is in m/s, convert to km/h)
    if (typeof end.speed === 'number' && end.speed > 0) {
      setReliveCurrentSpeed(Math.round(end.speed * 3.6 * 10) / 10);
    } else if (start.timestamp && end.timestamp) {
      // Calculate speed from distance/time
      const dt = (new Date(end.timestamp).getTime() - new Date(start.timestamp).getTime()) / 1000;
      if (dt > 0) {
        setReliveCurrentSpeed(Math.round((meters / dt) * 3.6 * 10) / 10);
      }
    }

    // Update altitude
    if (typeof end.altitude === 'number') {
      setReliveCurrentAltitude(Math.round(end.altitude * 10) / 10);
    }

    // Calculate cumulative distance covered
    let distCovered = 0;
    for (let i = 1; i <= idx + 1 && i < path.length; i++) {
      distCovered += haversineMeters(path[i-1], path[i]);
    }
    setReliveDistanceCovered(distCovered);

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

    // Update speed/altitude at seek position
    if (typeof pos.speed === 'number' && pos.speed > 0) {
      setReliveCurrentSpeed(Math.round(pos.speed * 3.6 * 10) / 10);
    }
    if (typeof pos.altitude === 'number') {
      setReliveCurrentAltitude(Math.round(pos.altitude * 10) / 10);
    }
    // Recalculate cumulative distance
    let distCovered = 0;
    for (let i = 1; i <= newIdx && i < path.length; i++) {
      distCovered += haversineMeters(path[i-1], path[i]);
    }
    setReliveDistanceCovered(distCovered);

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

    // Update speed/altitude at seek position
    if (typeof pos.speed === 'number' && pos.speed > 0) {
      setReliveCurrentSpeed(Math.round(pos.speed * 3.6 * 10) / 10);
    }
    if (typeof pos.altitude === 'number') {
      setReliveCurrentAltitude(Math.round(pos.altitude * 10) / 10);
    }
    // Recalculate cumulative distance
    let distCovered = 0;
    for (let i = 1; i <= newIdx && i < path.length; i++) {
      distCovered += haversineMeters(path[i-1], path[i]);
    }
    setReliveDistanceCovered(distCovered);

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

  // Toggle controls collapse with animation
  const toggleControlsCollapse = useCallback(() => {
    const toValue = controlsCollapsed ? 1 : 0;
    setControlsCollapsed(!controlsCollapsed);
    RNAnimated.timing(controlsAnim, {
      toValue,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [controlsCollapsed, controlsAnim]);

  // When not visible (tab not focused), keep hooks alive but skip rendering
  // This keeps recording and location tracking alive across tab switches
  if (!isVisible) return null;

  return (
    <View style={styles.container}>
      {region ? (
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          mapType={mapType}
          initialRegion={region}
          showsUserLocation={!simActive}
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
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={false}
                >
                  <View style={styles.terminalMarker}>
                    <Ionicons name="flag" size={16} color="#fff" />
                  </View>
                </Marker>
              ))}

              {/* Current position polyline - only show when recording */}
              {positions.length > 1 && !reliveActive && isRecording && (
                <Polyline
                  key="position-polyline"
                  coordinates={positions}
                  strokeColor={colors.primary}
                  strokeWidth={5}
                />
              )}

              {/* Current position marker - Waze-style navigation arrow (only when navigating a booking) */}
              {/* When not navigating, the native blue dot (showsUserLocation) is used instead */}
              {positions.length > 0 && !reliveActive && activeBooking && bookingRoute && (
                <Marker
                  key="position-marker"
                  coordinate={positions[positions.length - 1]}
                  anchor={{ x: 0.5, y: 0.5 }}
                  flat={true}
                  rotation={heading || 0}
                  tracksViewChanges={false}
                >
                  <View style={styles.wazeNavContainer}>
                    {/* Outer pulsing accuracy ring */}
                    <View style={styles.wazeNavPulseRing} />
                    {/* Navigation beam / cone showing direction */}
                    <View style={styles.wazeNavBeam} />
                    {/* Main Waze-style arrow body */}
                    <View style={styles.wazeNavArrowBody}>
                      {/* Arrow chevron pointing up (forward) */}
                      <View style={styles.wazeNavChevron} />
                      {/* Inner dot */}
                      <View style={styles.wazeNavDot} />
                    </View>
                  </View>
                </Marker>
              )}

              {/* Booking route polyline - Google Maps style solid navigation line */}
              {bookingRoute && bookingRoute.length > 1 && !reliveActive && (() => {
                // Trim route to only show remaining path ahead of driver
                const driverPos = positions.length > 0 ? positions[positions.length - 1] : null;
                let trimmedRoute = bookingRoute;
                if (driverPos && bookingRoute.length > 2) {
                  let closestIdx = 0;
                  let closestDist = Infinity;
                  for (let i = 0; i < bookingRoute.length; i++) {
                    const d = haversineMeters(driverPos, bookingRoute[i]);
                    if (d < closestDist) {
                      closestDist = d;
                      closestIdx = i;
                    }
                  }
                  // Start from closest point on route, prepend driver position
                  trimmedRoute = [driverPos, ...bookingRoute.slice(closestIdx)];
                }
                return (
                  <>
                    {/* Route border/outline for depth */}
                    <Polyline
                      key="booking-route-border"
                      coordinates={trimmedRoute}
                      strokeColor="#1a53a0"
                      strokeWidth={8}
                    />
                    {/* Main route line - Google Maps blue */}
                    <Polyline
                      key="booking-route-polyline"
                      coordinates={trimmedRoute}
                      strokeColor="#4A89F3"
                      strokeWidth={5}
                    />
                  </>
                );
              })()}

              {/* Booking pickup marker */}
              {activeBooking?.pickup && !isPickedUp && !reliveActive && (
                <Marker
                  key="booking-pickup-marker"
                  coordinate={{
                    latitude: activeBooking.pickup.latitude,
                    longitude: activeBooking.pickup.longitude,
                  }}
                  title="Pickup Location"
                  description={activeBooking.pickup.address || 'Pick up passenger here'}
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={false}
                >
                  <View style={[styles.bookingMarker, styles.pickupMarker]}>
                    <Ionicons name="person" size={16} color="#fff" />
                  </View>
                </Marker>
              )}

              {/* Booking destination marker */}
              {activeBooking?.destination && !reliveActive && (
                <Marker
                  key="booking-destination-marker"
                  coordinate={{
                    latitude: activeBooking.destination.latitude,
                    longitude: activeBooking.destination.longitude,
                  }}
                  title="Destination"
                  description={activeBooking.destination.address || 'Drop off here'}
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={false}
                >
                  <View style={[styles.bookingMarker, styles.destinationMarker]}>
                    <Ionicons name="flag" size={16} color="#fff" />
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

      {/* Rerouting Indicator */}
      {isRerouting && activeBooking && (
        <View style={styles.reroutingBanner}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.reroutingText}>Rerouting...</Text>
        </View>
      )}



      {/* Navigation Mode Top Info Bar — shows speed + heading in Waze-style */}
      {isNavigationMode && !reliveActive && (
        <View style={styles.navInfoBar}>
          <View style={styles.navInfoItem}>
            <Ionicons name="speedometer" size={16} color="#fff" />
            <Text style={styles.navInfoText}>{speedKph} km/h</Text>
          </View>
          <View style={styles.navInfoDivider} />
          <View style={styles.navInfoItem}>
            <Ionicons name="compass" size={16} color="#fff" />
            <Text style={styles.navInfoText}>{heading}°</Text>
          </View>
          {activeBooking?.destination && (
            <>
              <View style={styles.navInfoDivider} />
              <View style={styles.navInfoItem}>
                <Ionicons name="flag" size={16} color="#4ADE80" />
                <Text style={styles.navInfoText}>
                  {isPickedUp ? 'To Drop-off' : 'To Pickup'}
                </Text>
              </View>
            </>
          )}
        </View>
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
              <Text style={styles.recordingStatValue}>{formatDuration(tripMovingTime)}</Text>
              <Text style={styles.recordingStatLabel}>moving</Text>
            </View>
            <View style={styles.recordingStatDivider} />
            <View style={styles.recordingStat}>
              <Text style={styles.recordingStatValue}>{tripAvgMovingSpeedKph.toFixed(1)}</Text>
              <Text style={styles.recordingStatLabel}>avg km/h</Text>
            </View>
          </View>
          <Text style={styles.recordingMetaText}>
            Elapsed {formatDuration(tripDuration)} · Max {tripMaxSpeedKph.toFixed(1)} km/h · {recordedPositions.length} pts
          </Text>
        </View>
      )}

      {/* Collapsible Map Controls Container */}
      <View style={styles.hud}>
        {/* Collapse / Expand Header */}
        <TouchableOpacity
          style={styles.controlsToggleHeader}
          onPress={toggleControlsCollapse}
          activeOpacity={0.8}
        >
          <View style={styles.controlsToggleLeft}>
            <Ionicons name="settings-outline" size={16} color={colors.primary} />
            <Text style={styles.controlsToggleText}>Map Controls</Text>
          </View>
          {/* Quick-action icons visible even when collapsed */}
          <View style={styles.controlsQuickActions}>
            {onQueuePress && (
              <TouchableOpacity
                style={styles.quickActionQueueBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  onQueuePress();
                }}
              >
                <Ionicons name="list" size={14} color="#fff" />
                <Text style={styles.quickActionQueueText}>Queue</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.quickActionBtn}
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
                size={18}
                color={colors.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionBtn}
              onPress={isRecording ? stopRecording : startRecording}
            >
              <Ionicons
                name={isRecording ? 'stop-circle' : 'radio-button-on'}
                size={18}
                color={isRecording ? '#dc3545' : colors.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionBtn} onPress={openHistory}>
              <Ionicons name="time-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <Ionicons
            name={controlsCollapsed ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.orangeShade5}
          />
        </TouchableOpacity>

        {/* Animated collapsible content */}
        <RNAnimated.View
          style={{
            maxHeight: controlsAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 500],
            }),
            opacity: controlsAnim,
            overflow: 'hidden',
          }}
        >
          {/* Retractable GPS Stats Panel */}
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

          {/* DEV: Simulation active indicator */}
          {simActive && (
            <View style={styles.simBanner}>
              <Ionicons name="flask" size={14} color="#fff" />
              <Text style={styles.simBannerText}>DEV Simulation Active — trip recording for relive</Text>
            </View>
          )}

          {/* DEV-ONLY: Booking route simulation controls (only when booking is active with a route) */}
          {__DEV__ && activeBooking && bookingRoute && bookingRoute.length > 1 && (
            <View style={styles.devSimSection}>
              {!devSimRunning ? (
                <TouchableOpacity
                  onPress={startDevSimulation}
                  style={styles.devSimBtn}
                >
                  <Ionicons name="flask-outline" size={16} color="#fff" />
                  <Text style={styles.devSimBtnText}>DEV Simulate Route</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.devSimRunningPanel}>
                  <View style={styles.devSimProgressRow}>
                    <View style={styles.devSimProgressTrack}>
                      <View style={[styles.devSimProgressFill, { width: `${Math.round(devSimProgress * 100)}%` }]} />
                    </View>
                    <Text style={styles.devSimProgressText}>{Math.round(devSimProgress * 100)}%</Text>
                  </View>
                  <View style={styles.devSimRunningControls}>
                    <TouchableOpacity onPress={devSimSlowDown} style={styles.devSimControlBtn}>
                      <Ionicons name="remove" size={14} color="#fff" />
                    </TouchableOpacity>
                    <View style={[styles.devSimControlBtn, styles.devSimSpeedBtn]}>
                      <Text style={styles.devSimSpeedText}>{devSimSpeed}x</Text>
                    </View>
                    <TouchableOpacity onPress={devSimSpeedUp} style={styles.devSimControlBtn}>
                      <Ionicons name="add" size={14} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={toggleDevSimPause} style={styles.devSimControlBtn}>
                      <Ionicons name={devSimPaused ? 'play' : 'pause'} size={14} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={stopDevSimulation} style={[styles.devSimControlBtn, { backgroundColor: '#dc3545' }]}>
                      <Ionicons name="stop" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

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

            <View style={styles.rightControlsCol}>
              {/* Navigation Recenter Button — above History */}
              {isNavigationMode && !reliveActive && (
                <TouchableOpacity
                  style={styles.navRecenterBtnInline}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (positions.length > 0 && mapRef.current) {
                      const lastPos = positions[positions.length - 1];
                      updateNavigationCamera(lastPos, heading || 0, speedKph || 0);
                    }
                  }}
                >
                  <Ionicons name="navigate" size={18} color="#fff" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={openHistory}
                style={styles.historyBtn}
              >
                <Ionicons name="time-outline" size={20} color="#fff" />
                <Text style={styles.historyBtnText}>History</Text>
              </TouchableOpacity>
            </View>
          </View>
        </RNAnimated.View>
      </View>

      {/* Relive Panel - Compact bottom bar with stats */}
      {reliveActive && (
        <View style={styles.relivePanel}>
          {/* Stats Row */}
          <View style={styles.reliveStatsRow}>
            <View style={styles.reliveStatItem}>
              <Ionicons name="speedometer-outline" size={14} color={colors.primary} />
              <Text style={styles.reliveStatValue}>{reliveCurrentSpeed}</Text>
              <Text style={styles.reliveStatUnit}>km/h</Text>
            </View>
            <View style={styles.reliveStatItem}>
              <Ionicons name="navigate-outline" size={14} color={colors.primary} />
              <Text style={styles.reliveStatValue}>
                {reliveDistanceCovered >= 1000
                  ? `${(reliveDistanceCovered / 1000).toFixed(2)}`
                  : `${Math.round(reliveDistanceCovered)}`}
              </Text>
              <Text style={styles.reliveStatUnit}>
                {reliveDistanceCovered >= 1000 ? 'km' : 'm'}
              </Text>
            </View>
            <View style={styles.reliveStatItem}>
              <Ionicons name="arrow-up-outline" size={14} color={colors.primary} />
              <Text style={styles.reliveStatValue}>{reliveCurrentAltitude}</Text>
              <Text style={styles.reliveStatUnit}>m alt</Text>
            </View>
            {reliveStats ? (
              <>
                <View style={styles.reliveStatItem}>
                  <Ionicons name="trending-up-outline" size={14} color="#28a745" />
                  <Text style={styles.reliveStatValue}>{reliveStats.avgSpeed?.toFixed(1) || '0'}</Text>
                  <Text style={styles.reliveStatUnit}>avg</Text>
                </View>
                <View style={styles.reliveStatItem}>
                  <Ionicons name="flash-outline" size={14} color="#dc3545" />
                  <Text style={styles.reliveStatValue}>{reliveStats.maxSpeed?.toFixed(1) || '0'}</Text>
                  <Text style={styles.reliveStatUnit}>max</Text>
                </View>
              </>
            ) : null}
          </View>

          {/* Progress Row: Progress bar with timestamp */}
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
              {[1, 2, 4, 8, 16].map((speed) => (
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
  // Google Maps-style navigation arrow marker
  // Waze-style navigation arrow marker
  wazeNavContainer: {
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wazeNavPulseRing: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(74, 137, 243, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(74, 137, 243, 0.2)',
  },
  wazeNavBeam: {
    position: 'absolute',
    top: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 18,
    borderRightWidth: 18,
    borderBottomWidth: 28,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(74, 137, 243, 0.18)',
  },
  wazeNavArrowBody: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4A89F3',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1a53a0',
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
    borderWidth: 3,
    borderColor: '#fff',
  },
  wazeNavChevron: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#fff',
    marginTop: -4,
  },
  wazeNavDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fff',
    marginTop: 1,
  },
  // Rerouting banner
  reroutingBanner: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    backgroundColor: '#4A89F3',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
    zIndex: 999,
  },
  reroutingText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 10,
    letterSpacing: 0.5,
  },
  // ── Waze-style navigation mode UI ──
  navRecenterBtn: {
    position: 'absolute',
    right: 16,
    bottom: 200,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4A89F3',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1a53a0',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
    zIndex: 100,
  },
  navRecenterBtnInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A89F3',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 6,
  },
  navInfoBar: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30, 30, 30, 0.88)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
    zIndex: 100,
  },
  navInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  navInfoText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  navInfoDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginHorizontal: 14,
  },
  marker: {
    backgroundColor: colors.primary,
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.ivory1,
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  terminalMarker: {
    backgroundColor: '#f97316',
    padding: 6,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#fff',
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
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
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingMarker: {
    padding: 10,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupMarker: {
    backgroundColor: '#28a745',
  },
  destinationMarker: {
    backgroundColor: '#dc3545',
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
  controlsToggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  controlsToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  controlsToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  controlsQuickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    justifyContent: 'flex-end',
    marginRight: 8,
  },
  quickActionQueueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.orangeShade7,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
  },
  quickActionQueueText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  rightControlsCol: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  quickActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.ivory2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  hudRow: { flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 6 },
  hudLabel: { color: colors.orangeShade5, marginRight: 8 },
  hudValue: { fontWeight: '700', color: colors.orangeShade7 },
  simBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6f42c1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 6,
  },
  simBannerText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 6,
  },
  /* centerBtn and mapTypeBtn now replaced by quickActionBtn in the collapsible header */
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
    top: 55,
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
  recordingMetaText: {
    marginTop: 8,
    textAlign: 'center',
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
  reliveStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  reliveStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  reliveStatValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'monospace',
  },
  reliveStatUnit: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
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
  // ── DEV-ONLY: Simulation styles ──
  devSimSection: {
    marginBottom: 6,
  },
  devSimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6f42c1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  devSimBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  devSimRunningPanel: {
    backgroundColor: '#6f42c120',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#6f42c1',
  },
  devSimProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  devSimProgressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#e0d4f5',
    borderRadius: 3,
    overflow: 'hidden',
  },
  devSimProgressFill: {
    height: '100%',
    backgroundColor: '#6f42c1',
    borderRadius: 3,
  },
  devSimProgressText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6f42c1',
    width: 36,
    textAlign: 'right',
  },
  devSimRunningControls: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  devSimControlBtn: {
    backgroundColor: '#6f42c1',
    borderRadius: 6,
    padding: 6,
    minWidth: 32,
    alignItems: 'center',
  },
  devSimSpeedBtn: {
    backgroundColor: '#5a32a3',
    paddingHorizontal: 10,
  },
  devSimSpeedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});