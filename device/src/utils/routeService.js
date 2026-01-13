/**
 * Route Service Utility
 * 
 * This utility provides functions to:
 * - Calculate actual road routes between two points using OSRM API
 * - Get route distance and duration
 * - Calculate fare based on distance
 * - Decode polyline for map display
 */

/**
 * OSRM (Open Source Routing Machine) API - Free routing service
 * Uses the public demo server. For production, consider hosting your own OSRM server.
 */
const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1';

/**
 * Fare configuration for tricycle rides (WEBTODA Special Booking)
 */
export const FARE_CONFIG = {
  baseFare: 70, // Base fare in pesos - covers up to 1 km within WEBTODA area
  baseDistanceKm: 1, // Distance covered by base fare (in km)
  perKmRateOutside: 20, // Rate per kilometer OUTSIDE the base 1km (₱20/km)
  minimumFare: 70, // Minimum fare (same as base fare)
  nightSurcharge: 10, // Additional charge for night trips (10PM - 5AM)
  nightHourStart: 22, // 10 PM
  nightHourEnd: 5, // 5 AM
};

/**
 * Decode Google-style encoded polyline to array of coordinates
 * @param {string} encoded - Encoded polyline string
 * @returns {Array<{latitude: number, longitude: number}>}
 */
export const decodePolyline = (encoded) => {
  if (!encoded) return [];
  
  const poly = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    poly.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return poly;
};

/**
 * Get route between two points using OSRM
 * @param {Object} origin - {latitude, longitude}
 * @param {Object} destination - {latitude, longitude}
 * @param {Object} options - Additional options
 * @returns {Promise<{success: boolean, route?: Object, error?: string}>}
 */
export const getRoute = async (origin, destination, options = {}) => {
  try {
    const { alternatives = false, overview = 'full', timeout = 10000 } = options;
    
    // Validate inputs
    if (!origin?.latitude || !origin?.longitude || !destination?.latitude || !destination?.longitude) {
      console.warn('Invalid coordinates provided to getRoute');
      return createFallbackResult(origin, destination, 'Invalid coordinates');
    }
    
    // OSRM expects coordinates as longitude,latitude
    const originStr = `${origin.longitude},${origin.latitude}`;
    const destStr = `${destination.longitude},${destination.latitude}`;
    
    const url = `${OSRM_BASE_URL}/driving/${originStr};${destStr}?overview=${overview}&geometries=polyline&alternatives=${alternatives}`;
    
    console.log('Fetching route from OSRM:', url);
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    let response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.warn('Fetch error (using fallback):', fetchError.message);
      return createFallbackResult(origin, destination, fetchError.message);
    }
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.warn('OSRM response not ok:', response.status);
      return createFallbackResult(origin, destination, `OSRM API error: ${response.status}`);
    }
    
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.warn('Failed to parse OSRM response:', parseError.message);
      return createFallbackResult(origin, destination, 'Failed to parse response');
    }
    
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      console.warn('OSRM returned no routes:', data.code, data.message);
      return createFallbackResult(origin, destination, data.message || 'No route found');
    }
    
    const route = data.routes[0];
    
    // Decode the polyline to get route coordinates
    const routeCoordinates = decodePolyline(route.geometry);
    
    // Validate decoded coordinates
    if (!routeCoordinates || routeCoordinates.length < 2) {
      console.warn('Failed to decode route polyline');
      return createFallbackResult(origin, destination, 'Failed to decode route');
    }
    
    return {
      success: true,
      route: {
        coordinates: routeCoordinates,
        distance: route.distance, // in meters
        distanceKm: route.distance / 1000, // in kilometers
        duration: route.duration, // in seconds
        durationMinutes: Math.round(route.duration / 60), // in minutes
        geometry: route.geometry, // encoded polyline (useful for caching)
        legs: route.legs, // detailed leg information
      },
    };
  } catch (error) {
    console.error('Error in getRoute:', error);
    return createFallbackResult(origin, destination, error.message);
  }
};

/**
 * Create a fallback result using straight-line calculation
 */
const createFallbackResult = (origin, destination, errorMessage) => {
  try {
    const straightLineDistance = calculateHaversineDistance(
      origin?.latitude || 0,
      origin?.longitude || 0,
      destination?.latitude || 0,
      destination?.longitude || 0
    );
    
    return {
      success: false,
      error: errorMessage,
      fallback: {
        distance: straightLineDistance,
        distanceKm: straightLineDistance / 1000,
        coordinates: [origin, destination].filter(c => c?.latitude && c?.longitude),
        isStraightLine: true,
      },
    };
  } catch (fallbackError) {
    console.error('Error creating fallback:', fallbackError);
    return {
      success: false,
      error: errorMessage,
      fallback: {
        distance: 1000, // Default 1km
        distanceKm: 1,
        coordinates: [],
        isStraightLine: true,
      },
    };
  }
};

/**
 * Calculate distance between two coordinates using Haversine formula (fallback)
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distance in meters
 */
export const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

/**
 * Calculate fare based on route distance
 * - Base fare: ₱70 covers up to 2 km (within WEBTODA area)
 * - Beyond 2 km: ₱20 per additional km
 * @param {number} distanceKm - Distance in kilometers
 * @param {Object} options - Additional options
 * @returns {Object} Fare breakdown
 */
export const calculateFare = (distanceKm, options = {}) => {
  const {
    isNightTime = null,
  } = options;
  
  // Check if it's night time (10PM - 5AM)
  const now = new Date();
  const currentHour = now.getHours();
  const isNight = isNightTime !== null 
    ? isNightTime 
    : (currentHour >= FARE_CONFIG.nightHourStart || currentHour < FARE_CONFIG.nightHourEnd);
  
  // Start with base fare (covers first 2 km)
  let totalFare = FARE_CONFIG.baseFare;
  let extraDistanceFare = 0;
  let extraDistanceKm = 0;
  
  // Calculate extra distance beyond base 2 km
  if (distanceKm > FARE_CONFIG.baseDistanceKm) {
    extraDistanceKm = distanceKm - FARE_CONFIG.baseDistanceKm;
    extraDistanceFare = extraDistanceKm * FARE_CONFIG.perKmRateOutside;
    totalFare += extraDistanceFare;
  }
  
  // Add night surcharge if applicable
  let nightSurcharge = 0;
  if (isNight) {
    nightSurcharge = FARE_CONFIG.nightSurcharge;
    totalFare += nightSurcharge;
  }
  
  // Ensure minimum fare
  totalFare = Math.max(totalFare, FARE_CONFIG.minimumFare);
  
  // Round to nearest peso
  totalFare = Math.round(totalFare);
  extraDistanceFare = Math.round(extraDistanceFare);
  
  // Build breakdown
  const breakdown = [
    { label: `Base fare (up to ${FARE_CONFIG.baseDistanceKm} km)`, amount: FARE_CONFIG.baseFare },
  ];
  
  if (extraDistanceKm > 0) {
    breakdown.push({
      label: `Extra distance (${extraDistanceKm.toFixed(2)} km × ₱${FARE_CONFIG.perKmRateOutside}/km)`,
      amount: extraDistanceFare,
    });
  }
  
  if (nightSurcharge > 0) {
    breakdown.push({ label: 'Night surcharge (10PM-5AM)', amount: nightSurcharge });
  }
  
  return {
    baseFare: FARE_CONFIG.baseFare,
    baseDistanceKm: FARE_CONFIG.baseDistanceKm,
    extraDistanceKm: Math.round(extraDistanceKm * 100) / 100,
    extraDistanceFare,
    distanceKm: Math.round(distanceKm * 100) / 100, // Round to 2 decimal places
    nightSurcharge,
    totalFare,
    suggestedFare: totalFare,
    fareRange: {
      min: Math.max(FARE_CONFIG.minimumFare, totalFare - 10),
      max: totalFare + 20,
    },
    isNightTime: isNight,
    breakdown,
  };
};

/**
 * Get route and calculate fare in one call
 * @param {Object} origin - {latitude, longitude}
 * @param {Object} destination - {latitude, longitude}
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Route and fare information
 */
export const getRouteWithFare = async (origin, destination, options = {}) => {
  const routeResult = await getRoute(origin, destination);
  
  let distanceKm;
  let routeCoordinates;
  let isStraightLine = false;
  let durationMinutes = 0;
  
  if (routeResult.success && routeResult.route) {
    distanceKm = routeResult.route.distanceKm;
    routeCoordinates = routeResult.route.coordinates;
    durationMinutes = routeResult.route.durationMinutes;
  } else if (routeResult.fallback) {
    // Use fallback straight-line calculation
    distanceKm = routeResult.fallback.distanceKm;
    routeCoordinates = routeResult.fallback.coordinates;
    isStraightLine = true;
    // Estimate duration based on average tricycle speed (15 km/h)
    durationMinutes = Math.round((distanceKm / 15) * 60);
  } else {
    return {
      success: false,
      error: routeResult.error || 'Failed to calculate route',
    };
  }
  
  const fareInfo = calculateFare(distanceKm, options);
  
  return {
    success: true,
    route: {
      coordinates: routeCoordinates,
      distanceKm,
      distanceMeters: distanceKm * 1000,
      durationMinutes,
      isStraightLine,
    },
    fare: fareInfo,
    error: isStraightLine ? 'Using straight-line estimate (routing unavailable)' : null,
  };
};

/**
 * Format distance for display
 * @param {number} meters - Distance in meters
 * @returns {string} Formatted distance string
 */
export const formatDistance = (meters) => {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
};

/**
 * Format duration for display
 * @param {number} minutes - Duration in minutes
 * @returns {string} Formatted duration string
 */
export const formatDuration = (minutes) => {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

export default {
  getRoute,
  getRouteWithFare,
  calculateFare,
  decodePolyline,
  calculateHaversineDistance,
  formatDistance,
  formatDuration,
  FARE_CONFIG,
};
