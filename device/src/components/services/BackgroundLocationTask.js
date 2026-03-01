import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../utils/config';

const BACKEND = API_URL;

// same key used elsewhere
const KM_KEY = 'vehicle_current_km_v1';
const LAST_POS_KEY = 'bg_last_position_v1';
const LAST_TS_KEY = 'bg_last_ts_v1';
export const BG_TASK_NAME = 'TRICYCLE_BG_LOCATION_TASK';

// Keys shared with TrackingMap for background trip recording
const ACTIVE_TRIP_KEY = 'driver_tracking_active_trip_v1';
const BG_COORDS_KEY = 'bg_trip_coords_v1'; // coordinates accumulated in background
const BG_DISTANCE_KEY = 'bg_trip_distance_v1'; // distance accumulated in background
const BG_SYNCED_INDEX_KEY = 'bg_trip_synced_index_v1'; // how many coords have been synced to server (don't re-send)

// Key for active booking ID (for pushing driver location to passenger)
const ACTIVE_BOOKING_ID_KEY = 'bg_active_booking_id_v1';

function toRad(v) { return (v * Math.PI) / 180; }
function haversineMeters(a, b) {
  if (!a || !b) return 0;
  const R = 6371000;
  const φ1 = toRad(a.latitude), φ2 = toRad(b.latitude);
  const Δφ = toRad(b.latitude - a.latitude);
  const Δλ = toRad(b.longitude - a.longitude);
  const aa = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1-aa));
  return R * c;
}

TaskManager.defineTask(BG_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.warn('BG location task error', error);
    return;
  }
  if (!data) return;
  const { locations } = data; // array of location objects
  if (!locations || locations.length === 0) return;

  try {
    // load last position and odometer
    const [lastPosRaw, odometerRaw, lastTsRaw, activeTripRaw, bgCoordsRaw, bgDistRaw, bgSyncedIdxRaw] = await Promise.all([
      AsyncStorage.getItem(LAST_POS_KEY),
      AsyncStorage.getItem(KM_KEY),
      AsyncStorage.getItem(LAST_TS_KEY),
      AsyncStorage.getItem(ACTIVE_TRIP_KEY),
      AsyncStorage.getItem(BG_COORDS_KEY),
      AsyncStorage.getItem(BG_DISTANCE_KEY),
      AsyncStorage.getItem(BG_SYNCED_INDEX_KEY),
    ]);
    let lastPos = lastPosRaw ? JSON.parse(lastPosRaw) : null;
    let odometer = odometerRaw ? Number(odometerRaw) || 0 : 0;
    let lastTs = lastTsRaw ? Number(lastTsRaw) || 0 : 0;
    let odometerChanged = false;

    // Check if there's an active trip recording
    const activeTrip = activeTripRaw ? JSON.parse(activeTripRaw) : null;
    const hasActiveTrip = activeTrip && activeTrip.tripId;
    let bgCoords = bgCoordsRaw ? JSON.parse(bgCoordsRaw) : [];
    let bgDistance = bgDistRaw ? Number(bgDistRaw) || 0 : 0;
    let bgSyncedIndex = bgSyncedIdxRaw ? Number(bgSyncedIdxRaw) || 0 : 0;
    let tripCoordsChanged = false;
    
    // GPS Filter constants for background task
    // NOTE: Background GPS on Android can be significantly less accurate when
    // the screen is off (cell-tower fallback, GPS chip power saving).
    // We use tighter speed/distance limits to compensate.
    const MAX_ACCURACY_METERS = 20;       // Tighter accuracy gate (was 25)
    const MAX_SPEED_MPS = 25;             // Max ~90 km/h (realistic for tricycle)
    const MIN_DISTANCE_METERS = 3;        // Minimum movement to record (higher for bg noise)
    const MIN_TIME_INTERVAL_MS = 2000;    // Minimum time between recordings
    const HARD_DISTANCE_CAP_METERS = 300; // Absolute max distance per reading regardless of gap

    for (const loc of locations) {
      // support multiple shapes: loc.coords or loc (some platforms)
      const coords = (loc && loc.coords) ? loc.coords : loc;
      if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') continue;

      const cur = { latitude: coords.latitude, longitude: coords.longitude };
      const curTs = loc.timestamp ? Number(loc.timestamp) : Date.now();
      const accuracy = coords.accuracy || 0;

      // Filter 1: Reject poor accuracy readings (don't advance anchor — wait for good fix)
      if (accuracy > MAX_ACCURACY_METERS) {
        continue;
      }

      if (lastPos) {
        const meters = haversineMeters(lastPos, cur);
        const dt = curTs && lastTs ? (curTs - lastTs) / 1000 : 0;

        // Reject out-of-order timestamps only (removed MAX_STALE_SECONDS — it was
        // causing ALL background points to be rejected after any >30s gap, which is
        // normal when the phone screen is off. The speed check below handles stale
        // points correctly by using gap-proportional validation.)
        if (dt <= 0) {
          continue;
        }

        // Filter 2: Gap-aware speed check — reject impossible speed for any gap duration.
        // This replaces both the old stale-seconds check and the fixed distance cap.
        // For long gaps, the speed check naturally allows larger distances.
        const speedMps = meters / Math.max(dt, 0.5);
        if (speedMps > MAX_SPEED_MPS) {
          // Impossible speed — ADVANCE anchor to prevent cascading rejection.
          // Without this, the anchor stays at the old position forever and all
          // future points also fail the speed check (the "stale anchor deadlock").
          lastPos = cur;
          lastTs = curTs;
          continue;
        }

        // Filter 3: Hard distance cap — even at reasonable speed, very large jumps
        // between individual GPS samples indicate poor tracking (the actual path
        // isn't a straight line). Better to skip than record inaccurate straight segments.
        if (meters > HARD_DISTANCE_CAP_METERS) {
          // Advance anchor so we don't get stuck
          lastPos = cur;
          lastTs = curTs;
          continue;
        }

        // Filter 4: Skip if too soon (prevent rapid-fire readings)
        if ((curTs - lastTs) < MIN_TIME_INTERVAL_MS) {
          // Don't advance anchor — user hasn't moved enough time
          continue;
        }

        // Filter 5: Minimum distance check (prevents micro-jitter)
        if (meters < MIN_DISTANCE_METERS) {
          // Don't advance anchor — user is stationary
          continue;
        }

        // All filters passed — update odometer
        odometer += meters / 1000;
        odometerChanged = true;

        // Accumulate trip coordinates in background when there's an active trip
        if (hasActiveTrip) {
          bgCoords.push({
            latitude: coords.latitude,
            longitude: coords.longitude,
            altitude: coords.altitude || 0,
            accuracy: accuracy,
            speed: coords.speed || 0,
            heading: coords.heading || 0,
            timestamp: curTs,
          });
          bgDistance += meters;
          tripCoordsChanged = true;
          // Cap stored coords to prevent memory issues (keep last 2000 ≈ ~67 min at 2s intervals)
          if (bgCoords.length > 2000) {
            const dropped = bgCoords.length - 2000;
            bgCoords = bgCoords.slice(-2000);
            // Adjust synced index since we dropped old entries
            bgSyncedIndex = Math.max(0, bgSyncedIndex - dropped);
          }
        }
      }

      lastPos = cur;
      lastTs = curTs;
    }

    // persist updated values (always persist last pos + ts for continuity)
    const saveOps = [
      AsyncStorage.setItem(LAST_POS_KEY, JSON.stringify(lastPos || {})),
      AsyncStorage.setItem(LAST_TS_KEY, String(lastTs || Date.now())),
      AsyncStorage.setItem(KM_KEY, String(odometer)),
    ];

    // Save background trip coordinates if changed
    if (tripCoordsChanged && hasActiveTrip) {
      saveOps.push(AsyncStorage.setItem(BG_COORDS_KEY, JSON.stringify(bgCoords)));
      saveOps.push(AsyncStorage.setItem(BG_DISTANCE_KEY, String(bgDistance)));
    }

    await Promise.all(saveOps);

    // Sync odometer to server if changed (fire-and-forget, no trip coords)
    if (odometerChanged) {
        const trikeId = await AsyncStorage.getItem('active_tricycle_id');
        const token = await AsyncStorage.getItem('auth_token_str');
        
        if (trikeId && token) {
            fetch(`${BACKEND}/api/tricycles/${trikeId}/odometer`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ odometer })
            }).catch(err => console.warn('BG sync failed', err));
        }
    }

    // Push driver location to server for active booking (so passenger can track driver even with screen off)
    if (lastPos && lastPos.latitude && lastPos.longitude) {
        const bookingId = await AsyncStorage.getItem(ACTIVE_BOOKING_ID_KEY);
        const token = await AsyncStorage.getItem('auth_token_str');
        
        if (bookingId && token) {
            fetch(`${BACKEND}/api/booking/${bookingId}/driver-location`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    latitude: lastPos.latitude,
                    longitude: lastPos.longitude,
                })
            }).catch(err => console.warn('BG booking location push failed', err));
        }
    }

    // NOTE: We do NOT sync trip coordinates to the server from the background task.
    // The foreground periodic merge (every 5s) reads BG_COORDS_KEY and is the SOLE
    // path to the server via syncToServer(). Syncing from both BG task and foreground
    // caused duplicate coordinates on the server, inflating distance (e.g. 0.35 km → 13 km)
    // and creating "crazy lines" in relive playback.

  } catch (e) {
    console.warn('BG task save error', e);
  }
});