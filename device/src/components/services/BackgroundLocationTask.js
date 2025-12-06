import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const BACKEND = (Constants?.expoConfig?.extra?.BACKEND_URL) || (Constants?.manifest?.extra?.BACKEND_URL) || 'http://192.168.254.105:5000';

// same key used elsewhere
const KM_KEY = 'vehicle_current_km_v1';
const LAST_POS_KEY = 'bg_last_position_v1';
const LAST_TS_KEY = 'bg_last_ts_v1';
export const BG_TASK_NAME = 'TRICYCLE_BG_LOCATION_TASK';

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
    const [lastPosRaw, odometerRaw, lastTsRaw] = await Promise.all([
      AsyncStorage.getItem(LAST_POS_KEY),
      AsyncStorage.getItem(KM_KEY),
      AsyncStorage.getItem(LAST_TS_KEY),
    ]);
    let lastPos = lastPosRaw ? JSON.parse(lastPosRaw) : null;
    let odometer = odometerRaw ? Number(odometerRaw) || 0 : 0;
    let lastTs = lastTsRaw ? Number(lastTsRaw) || 0 : 0;
    let odometerChanged = false;

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
          odometer = +(odometer + meters / 1000).toFixed(3);
          odometerChanged = true;
        }
      }

      lastPos = cur;
      lastTs = curTs;
    }

    // persist updated values (always persist last pos + ts for continuity)
    await Promise.all([
      AsyncStorage.setItem(LAST_POS_KEY, JSON.stringify(lastPos || {})),
      AsyncStorage.setItem(LAST_TS_KEY, String(lastTs || Date.now())),
      AsyncStorage.setItem(KM_KEY, String(odometer)),
    ]);

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

  } catch (e) {
    console.warn('BG task save error', e);
  }
});