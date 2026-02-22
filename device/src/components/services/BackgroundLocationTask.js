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
    const [lastPosRaw, odometerRaw, lastTsRaw, activeTripRaw, bgCoordsRaw, bgDistRaw] = await Promise.all([
      AsyncStorage.getItem(LAST_POS_KEY),
      AsyncStorage.getItem(KM_KEY),
      AsyncStorage.getItem(LAST_TS_KEY),
      AsyncStorage.getItem(ACTIVE_TRIP_KEY),
      AsyncStorage.getItem(BG_COORDS_KEY),
      AsyncStorage.getItem(BG_DISTANCE_KEY),
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
    let tripCoordsChanged = false;

    for (const loc of locations) {
      // support multiple shapes: loc.coords or loc (some platforms)
      const coords = (loc && loc.coords) ? loc.coords : loc;
      if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') continue;

      const cur = { latitude: coords.latitude, longitude: coords.longitude };
      const curTs = loc.timestamp ? Number(loc.timestamp) : Date.now();

      if (lastPos) {
        const meters = haversineMeters(lastPos, cur);

        // filter unrealistic jumps (GPS glitch)
        if (meters > 2000) {
          // large jump — skip but still update lastPos to current to avoid repeated huge jumps
          lastPos = cur;
          lastTs = curTs;
          continue;
        }

        // optional dt check
        const dt = curTs && lastTs ? (curTs - lastTs) / 1000 : null;
        if (meters > 0.25 && (!dt || dt >= 0)) {
          odometer = Math.round(odometer + meters / 1000);
          odometerChanged = true;
        }

        // Accumulate trip coordinates in background when there's an active trip
        if (hasActiveTrip && meters >= 1 && meters <= 500) {
          const accuracy = coords.accuracy || 0;
          if (accuracy <= 30) { // skip inaccurate readings
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
            // Cap stored coords to prevent memory issues (keep last 500)
            if (bgCoords.length > 500) {
              bgCoords = bgCoords.slice(-500);
            }
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

    // Sync to server if odometer changed
    if (odometerChanged) {
        const trikeId = await AsyncStorage.getItem('active_tricycle_id');
        const token = await AsyncStorage.getItem('auth_token_str');
        
        if (trikeId && token) {
            // Simple fire-and-forget fetch
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

    // Sync trip coordinates to server periodically in background
    if (hasActiveTrip && bgCoords.length >= 10) {
      try {
        const response = await fetch(`${BACKEND}/api/tracking/${activeTrip.tripId}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coordinates: bgCoords }),
        });
        if (response.ok) {
          // Clear synced coords
          await AsyncStorage.setItem(BG_COORDS_KEY, '[]');
          await AsyncStorage.setItem(BG_DISTANCE_KEY, '0');
        }
      } catch (syncErr) {
        console.warn('BG trip coord sync failed', syncErr);
      }
    }

  } catch (e) {
    console.warn('BG task save error', e);
  }
});