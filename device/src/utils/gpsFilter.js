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
  
  // Maximum realistic speed for a tricycle in m/s (~90 km/h — generous but more realistic than 120)
  MAX_SPEED_MPS: 25,
  
  // Minimum distance in meters between recorded points (filters micro-jitter)
  MIN_DISTANCE_METERS: 2,
  
  // Maximum distance per reading (filters GPS teleportation glitches)
  // At 2-second intervals and ~25 m/s max, realistic max is ~50m. 100m provides headroom.
  MAX_DISTANCE_METERS: 100,
  
  // Minimum time interval between recordings in milliseconds
  MIN_TIME_INTERVAL_MS: 1500,
  
  // Maximum bearing change in degrees that's considered realistic (filters GPS bounce)
  // A 180° change in bearing with short distance usually indicates GPS bounce
  SUSPICIOUS_BEARING_CHANGE_DEG: 150,
  
  // Number of recent positions to track for anti-jitter analysis
  JITTER_HISTORY_SIZE: 5,
  
  // If the user returns within this distance of a recent position, it's likely jitter
  JITTER_RETURN_DISTANCE_METERS: 10,

  // --- Post-gap settling configuration ---
  // After a GPS gap longer than this, enter settling mode to filter cold-start noise
  SETTLING_GAP_THRESHOLD_MS: 10000,
  // Number of consecutive consistent readings required before trusting GPS after a gap
  SETTLING_REQUIRED_POINTS: 3,
  // All settling candidate points must be within this radius to be considered consistent
  SETTLING_CONSISTENCY_RADIUS_M: 25,
  // Maximum points to buffer during settling before force-accepting the best cluster
  SETTLING_MAX_BUFFER: 20,
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
    // Post-gap settling state
    this._settling = false;
    this._settleBuffer = [];
    this._preGapPosition = null; // Last accepted position before the gap
    this._preGapTimestamp = 0;
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
    this._settling = false;
    this._settleBuffer = [];
    this._preGapPosition = null;
    this._preGapTimestamp = 0;
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

    // 4b. Post-gap settling mode detection
    // When there's been a long gap (e.g., app was in background, screen off),
    // the first GPS fixes after waking up are often wildly inaccurate (cell-tower
    // positions, GPS cold start). We buffer readings until we get N consistent
    // readings within a tight radius, then accept the settled position.
    const gapThreshold = this.config.SETTLING_GAP_THRESHOLD_MS || 10000;
    if (timeDelta > gapThreshold && !this._settling) {
      this._settling = true;
      this._settleBuffer = [];
      this._preGapPosition = this.lastAcceptedPosition ? { ...this.lastAcceptedPosition } : null;
      this._preGapTimestamp = this.lastAcceptedTimestamp;
    }

    if (this._settling) {
      return this._handleSettling(newPos, now, accuracy);
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
   * Handle GPS settling after a time gap.
   * Buffers candidate points and waits for N consecutive consistent readings
   * before accepting the settled position. This filters GPS cold-start noise.
   * @private
   */
  _handleSettling(newPos, timestamp, accuracy) {
    const requiredPoints = this.config.SETTLING_REQUIRED_POINTS || 3;
    const consistencyRadius = this.config.SETTLING_CONSISTENCY_RADIUS_M || 25;
    const maxBuffer = this.config.SETTLING_MAX_BUFFER || 20;

    // Prefer readings with better accuracy during settling
    const settleAccuracyLimit = Math.min(this.config.MAX_ACCURACY_METERS, 12);
    if (accuracy && accuracy > settleAccuracyLimit) {
      // During settling, be extra strict about accuracy — skip noisy readings
      return { accepted: false, reason: 'settling_poor_accuracy', accuracy };
    }

    this._settleBuffer.push({ ...newPos, timestamp, accuracy: accuracy || 0 });

    // Check last N points for consistency (all within radius of each other)
    if (this._settleBuffer.length >= requiredPoints) {
      const candidates = this._settleBuffer.slice(-requiredPoints);
      let consistent = true;

      for (let i = 0; i < candidates.length && consistent; i++) {
        for (let j = i + 1; j < candidates.length && consistent; j++) {
          if (haversineMeters(candidates[i], candidates[j]) > consistencyRadius) {
            consistent = false;
          }
        }
      }

      if (consistent) {
        // GPS has settled! Pick the candidate with the best (lowest) accuracy value
        const best = candidates.reduce((a, b) =>
          (a.accuracy || 999) < (b.accuracy || 999) ? a : b
        );

        // Calculate distance from the pre-gap position to the settled position
        let distance = 0;
        if (this._preGapPosition) {
          distance = haversineMeters(this._preGapPosition, best);
          // Validate the settled distance with a gap-aware speed check
          const gapDt = (best.timestamp - this._preGapTimestamp) / 1000;
          if (gapDt > 0) {
            const gapSpeedMps = distance / gapDt;
            if (gapSpeedMps > this.config.MAX_SPEED_MPS) {
              // Even the settled position is too far away — the user probably
              // didn't move that fast. Accept position but don't count full distance.
              // Use a capped distance based on max plausible speed.
              distance = this.config.MAX_SPEED_MPS * gapDt;
            }
          }
        }

        // Exit settling mode and accept the settled point
        this._settling = false;
        this._settleBuffer = [];
        this._acceptPoint(best, best.timestamp, 0);

        return {
          accepted: true,
          distance,
          reason: 'settled_after_gap',
          settlePoints: candidates.length,
        };
      }
    }

    // If buffer is full without finding consistency, force-accept the best-accuracy reading
    // (GPS in a noisy area — better to accept something than buffer forever)
    if (this._settleBuffer.length >= maxBuffer) {
      const best = this._settleBuffer.reduce((a, b) =>
        (a.accuracy || 999) < (b.accuracy || 999) ? a : b
      );
      let distance = 0;
      if (this._preGapPosition) {
        distance = haversineMeters(this._preGapPosition, best);
        const gapDt = (best.timestamp - this._preGapTimestamp) / 1000;
        if (gapDt > 0) {
          const gapSpeedMps = distance / gapDt;
          if (gapSpeedMps > this.config.MAX_SPEED_MPS) {
            distance = this.config.MAX_SPEED_MPS * gapDt;
          }
        }
      }

      this._settling = false;
      this._settleBuffer = [];
      this._acceptPoint(best, best.timestamp, 0);

      return {
        accepted: true,
        distance,
        reason: 'force_settled_after_max_buffer',
      };
    }

    // Still settling — not enough consistent readings yet
    return { accepted: false, reason: 'settling', bufferSize: this._settleBuffer.length };
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
