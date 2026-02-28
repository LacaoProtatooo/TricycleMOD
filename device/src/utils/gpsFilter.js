/**
 * GPS Filtering Utilities
 * 
 * Prevents GPS jitter, back-and-forth oscillation, and inaccurate readings
 * from inflating distance calculations and creating messy polylines.
 */

// GPS filter configuration constants
export const GPS_FILTER_CONFIG = {
  // Maximum acceptable GPS accuracy in meters (readings worse than this are rejected)
  MAX_ACCURACY_METERS: 15,
  
  // Maximum realistic speed for a tricycle in m/s (~120 km/h is generous upper bound)
  MAX_SPEED_MPS: 33.33,
  
  // Minimum distance in meters between recorded points (filters micro-jitter)
  MIN_DISTANCE_METERS: 2,
  
  // Maximum distance per reading (filters GPS teleportation glitches)
  MAX_DISTANCE_METERS: 200,
  
  // Minimum time interval between recordings in milliseconds
  MIN_TIME_INTERVAL_MS: 1500,
  
  // Maximum bearing change in degrees that's considered realistic (filters GPS bounce)
  // A 180° change in bearing with short distance usually indicates GPS bounce
  SUSPICIOUS_BEARING_CHANGE_DEG: 150,
  
  // Number of recent positions to track for anti-jitter analysis
  JITTER_HISTORY_SIZE: 5,
  
  // If the user returns within this distance of a recent position, it's likely jitter
  JITTER_RETURN_DISTANCE_METERS: 10,
};

/**
 * Calculate the haversine distance between two GPS coordinates in meters
 */
export function haversineMeters(a, b) {
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

/**
 * Calculate bearing (heading) between two GPS coordinates in degrees (0-360)
 */
export function bearingBetween(a, b) {
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

/**
 * Calculate the angular difference between two bearings (handles wrap-around)
 */
export function bearingDifference(bearing1, bearing2) {
  let diff = Math.abs(bearing1 - bearing2);
  if (diff > 180) diff = 360 - diff;
  return diff;
}

/**
 * GPS Filter class that maintains state for intelligent filtering
 */
export class GPSFilter {
  constructor(config = GPS_FILTER_CONFIG) {
    this.config = config;
    this.lastAcceptedPosition = null;
    this.lastAcceptedTimestamp = 0;
    this.lastBearing = null;
    this.recentPositions = []; // Ring buffer for jitter detection
    this.totalFilteredCount = 0;
    this.totalAcceptedCount = 0;
  }

  /**
   * Reset the filter state (call when starting a new trip)
   */
  reset() {
    this.lastAcceptedPosition = null;
    this.lastAcceptedTimestamp = 0;
    this.lastBearing = null;
    this.recentPositions = [];
    this.totalFilteredCount = 0;
    this.totalAcceptedCount = 0;
  }

  /**
   * Validate and filter a GPS coordinate
   * 
   * @param {Object} coord - GPS coordinate with latitude, longitude, accuracy, timestamp
   * @returns {Object} { accepted: boolean, reason?: string, distance?: number }
   */
  filter(coord) {
    const { latitude, longitude, accuracy, timestamp } = coord;
    
    // 1. Basic validity check
    if (typeof latitude !== 'number' || typeof longitude !== 'number' ||
        isNaN(latitude) || isNaN(longitude)) {
      this.totalFilteredCount++;
      return { accepted: false, reason: 'invalid_coordinates' };
    }

    // 2. Accuracy check - reject readings with poor GPS accuracy
    if (accuracy && accuracy > this.config.MAX_ACCURACY_METERS) {
      this.totalFilteredCount++;
      return { accepted: false, reason: 'poor_accuracy', accuracy };
    }

    const newPos = { latitude, longitude };
    const now = timestamp || Date.now();

    // 3. First point - always accept (with reasonable accuracy)
    if (!this.lastAcceptedPosition) {
      this._acceptPoint(newPos, now, 0);
      return { accepted: true, distance: 0, isFirst: true };
    }

    // 4. Time interval check - don't record too frequently
    const timeDelta = now - this.lastAcceptedTimestamp;
    if (timeDelta < this.config.MIN_TIME_INTERVAL_MS) {
      // Don't count as filtered - just too soon
      return { accepted: false, reason: 'too_soon', timeDelta };
    }

    // 5. Calculate distance
    const distance = haversineMeters(this.lastAcceptedPosition, newPos);

    // 6. Minimum distance check - filter micro-jitter
    if (distance < this.config.MIN_DISTANCE_METERS) {
      // Don't count as filtered - user just hasn't moved enough
      return { accepted: false, reason: 'insufficient_movement', distance };
    }

    // 7. Maximum distance check - filter GPS teleportation
    if (distance > this.config.MAX_DISTANCE_METERS) {
      this.totalFilteredCount++;
      return { accepted: false, reason: 'teleportation', distance };
    }

    // 8. Speed validation - calculate implied speed and reject impossible values
    const speedMps = distance / (timeDelta / 1000);
    if (speedMps > this.config.MAX_SPEED_MPS) {
      this.totalFilteredCount++;
      return { accepted: false, reason: 'impossible_speed', speedMps, speedKph: speedMps * 3.6 };
    }

    // 9. Bearing change check - detect GPS bounce (rapid direction reversals)
    const newBearing = bearingBetween(this.lastAcceptedPosition, newPos);
    if (this.lastBearing !== null) {
      const bearingChange = bearingDifference(this.lastBearing, newBearing);
      // Only flag as suspicious if bearing change is large AND distance is small
      // (Real U-turns happen, but they cover more distance)
      if (bearingChange > this.config.SUSPICIOUS_BEARING_CHANGE_DEG && distance < 20) {
        this.totalFilteredCount++;
        return { accepted: false, reason: 'gps_bounce', bearingChange, distance };
      }
    }

    // 10. Jitter pattern detection - check if returning to a recent position
    for (const recentPos of this.recentPositions) {
      const distToRecent = haversineMeters(recentPos, newPos);
      if (distToRecent < this.config.JITTER_RETURN_DISTANCE_METERS) {
        // We're back near where we were recently - likely GPS jitter
        this.totalFilteredCount++;
        return { accepted: false, reason: 'jitter_pattern', distToRecent };
      }
    }

    // All checks passed - accept the point
    this._acceptPoint(newPos, now, newBearing);
    return { accepted: true, distance, speedMps, bearing: newBearing };
  }

  /**
   * Internal: Record an accepted position
   */
  _acceptPoint(pos, timestamp, bearing) {
    this.lastAcceptedPosition = pos;
    this.lastAcceptedTimestamp = timestamp;
    this.lastBearing = bearing;
    this.totalAcceptedCount++;

    // Add to recent positions ring buffer
    this.recentPositions.push({ ...pos });
    if (this.recentPositions.length > this.config.JITTER_HISTORY_SIZE) {
      this.recentPositions.shift();
    }
  }

  /**
   * Get filter statistics for debugging
   */
  getStats() {
    return {
      accepted: this.totalAcceptedCount,
      filtered: this.totalFilteredCount,
      filterRate: this.totalFilteredCount / (this.totalAcceptedCount + this.totalFilteredCount) || 0,
    };
  }
}

/**
 * Simple stateless filter function for one-off checks
 * Use GPSFilter class for trip recording (maintains state for jitter detection)
 */
export function isValidGPSReading(coord, lastCoord = null, lastTimestamp = 0, config = GPS_FILTER_CONFIG) {
  const { latitude, longitude, accuracy, timestamp } = coord;
  
  // Basic validity
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return false;
  
  // Accuracy check
  if (accuracy && accuracy > config.MAX_ACCURACY_METERS) return false;
  
  if (!lastCoord) return true;
  
  const distance = haversineMeters(lastCoord, { latitude, longitude });
  const now = timestamp || Date.now();
  const timeDelta = now - lastTimestamp;
  
  // Distance bounds
  if (distance < config.MIN_DISTANCE_METERS || distance > config.MAX_DISTANCE_METERS) return false;
  
  // Speed check
  if (timeDelta > 0) {
    const speedMps = distance / (timeDelta / 1000);
    if (speedMps > config.MAX_SPEED_MPS) return false;
  }
  
  return true;
}

export default GPSFilter;
