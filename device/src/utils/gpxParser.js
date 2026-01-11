/**
 * GPX Parser Utility for WEBTODA Service Area
 * 
 * This utility parses GPX files and provides functions to:
 * - Extract route coordinates
 * - Calculate bounding box and polygon from route
 * - Check if a point is within the service area
 * - Calculate distance to nearest point on route
 */

/**
 * Parse GPX XML content and extract track points
 * @param {string} gpxContent - Raw GPX XML string
 * @returns {Array<{latitude: number, longitude: number, elevation?: number}>}
 */
export const parseGPXContent = (gpxContent) => {
  const coordinates = [];
  
  // Simple regex-based parsing for track points
  const trkptRegex = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>/g;
  const eleRegex = /<ele>([^<]+)<\/ele>/;
  
  let match;
  while ((match = trkptRegex.exec(gpxContent)) !== null) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    
    if (!isNaN(lat) && !isNaN(lon)) {
      coordinates.push({
        latitude: lat,
        longitude: lon,
      });
    }
  }
  
  return coordinates;
};

/**
 * Pre-parsed WEBTODA service area coordinates from the GPX file
 * This is the official operating area boundary
 */
export const WEBTODA_SERVICE_AREA = {
  // Bounding box from GPX track
  bounds: {
    minLat: 14.505309,
    maxLat: 14.514586,
    minLon: 121.033559,
    maxLon: 121.042821,
  },
  
  // Center point of the service area
  center: {
    latitude: (14.505309 + 14.514586) / 2, // 14.5099475
    longitude: (121.033559 + 121.042821) / 2, // 121.03819
  },
  
  // Buffer distance in meters for destination warnings
  // Destinations within this buffer beyond the route get a warning
  warningBuffer: 300, // 300 meters buffer
  
  // Maximum allowed distance from route for pickup (meters)
  maxPickupDistance: 150, // 150 meters from route
};

/**
 * Accurate route coordinates extracted from the WEBTODA GPX file
 * These coordinates represent the actual tricycle service route
 * Sampled at regular intervals for smooth polyline display
 */
export const WEBTODA_ROUTE_COORDINATES = [
  // Start point - heading southwest along main route
  { latitude: 14.5145639, longitude: 121.042821 },
  { latitude: 14.5144787, longitude: 121.0425035 },
  { latitude: 14.5143466, longitude: 121.0420345 },
  { latitude: 14.514272, longitude: 121.0417277 },
  { latitude: 14.5143439, longitude: 121.0415211 },
  { latitude: 14.5143474, longitude: 121.0412466 },
  { latitude: 14.5141019, longitude: 121.0406897 },
  { latitude: 14.5139043, longitude: 121.0402952 },
  { latitude: 14.513787, longitude: 121.0400268 },
  { latitude: 14.5135945, longitude: 121.0395374 },
  { latitude: 14.5134176, longitude: 121.0390613 },
  { latitude: 14.513323, longitude: 121.0388188 },
  { latitude: 14.5131828, longitude: 121.0385715 },
  { latitude: 14.5129725, longitude: 121.0380198 },
  { latitude: 14.5128557, longitude: 121.0376796 },
  { latitude: 14.512711, longitude: 121.0373146 },
  { latitude: 14.5124952, longitude: 121.0369966 },
  { latitude: 14.5123136, longitude: 121.0367374 },
  { latitude: 14.5121087, longitude: 121.0364367 },
  { latitude: 14.511894, longitude: 121.0360288 },
  { latitude: 14.5117365, longitude: 121.0355899 },
  { latitude: 14.5116366, longitude: 121.0352908 },
  { latitude: 14.5114574, longitude: 121.0347171 },
  { latitude: 14.5114974, longitude: 121.0343828 },
  { latitude: 14.5114857, longitude: 121.0341174 },
  { latitude: 14.5113044, longitude: 121.0338819 },
  { latitude: 14.5112659, longitude: 121.0336639 },
  // Turn point - route curves
  { latitude: 14.5109938, longitude: 121.0336813 },
  { latitude: 14.5102024, longitude: 121.034071 },
  { latitude: 14.5092677, longitude: 121.0345607 },
  { latitude: 14.5082872, longitude: 121.0348195 },
  { latitude: 14.5078008, longitude: 121.0350107 },
  { latitude: 14.5069548, longitude: 121.0354807 },
  { latitude: 14.5061543, longitude: 121.0359517 },
  // Southern portion of route
  { latitude: 14.5054651, longitude: 121.0366703 },
  { latitude: 14.505544, longitude: 121.0375765 },
  { latitude: 14.5056926, longitude: 121.0385204 },
  { latitude: 14.5058957, longitude: 121.0387724 },
  { latitude: 14.5060748, longitude: 121.0383971 },
  { latitude: 14.5059775, longitude: 121.0378426 },
  { latitude: 14.5062516, longitude: 121.0370771 },
  { latitude: 14.506521, longitude: 121.0363046 },
  { latitude: 14.5065578, longitude: 121.0358187 },
  // Return route heading north
  { latitude: 14.5067748, longitude: 121.0356218 },
  { latitude: 14.5069923, longitude: 121.0354916 },
  { latitude: 14.5072301, longitude: 121.0353845 },
  { latitude: 14.5074594, longitude: 121.0352607 },
  { latitude: 14.5076959, longitude: 121.0351454 },
  { latitude: 14.5079743, longitude: 121.0349973 },
  { latitude: 14.5082495, longitude: 121.0348908 },
  { latitude: 14.5088671, longitude: 121.0347545 },
  { latitude: 14.5095599, longitude: 121.0345031 },
  { latitude: 14.5099235, longitude: 121.034312 },
  { latitude: 14.5104202, longitude: 121.0345328 },
  { latitude: 14.5107333, longitude: 121.034703 },
  { latitude: 14.5110129, longitude: 121.0346759 },
  { latitude: 14.5112938, longitude: 121.0345675 },
  // Final section heading northeast back to start
  { latitude: 14.5115291, longitude: 121.0348141 },
  { latitude: 14.5116384, longitude: 121.0351505 },
  { latitude: 14.5117643, longitude: 121.0355597 },
  { latitude: 14.5119212, longitude: 121.0359611 },
  { latitude: 14.5120447, longitude: 121.0362604 },
  { latitude: 14.5123001, longitude: 121.0366544 },
  { latitude: 14.512604, longitude: 121.0370859 },
  { latitude: 14.5127745, longitude: 121.0373686 },
  { latitude: 14.5128821, longitude: 121.0376774 },
  { latitude: 14.5130267, longitude: 121.0381014 },
  { latitude: 14.5131628, longitude: 121.0384095 },
  { latitude: 14.5132768, longitude: 121.0386236 },
  { latitude: 14.5133941, longitude: 121.0388485 },
  { latitude: 14.5134803, longitude: 121.0391276 },
  { latitude: 14.5136272, longitude: 121.0395175 },
  { latitude: 14.5137699, longitude: 121.0398493 },
  { latitude: 14.5138798, longitude: 121.0401156 },
  { latitude: 14.5140424, longitude: 121.0404993 },
  { latitude: 14.5141957, longitude: 121.0408516 },
  { latitude: 14.5143576, longitude: 121.0411763 },
  { latitude: 14.5144553, longitude: 121.0414482 },
  { latitude: 14.5142596, longitude: 121.041588 },
  { latitude: 14.5143493, longitude: 121.0418957 },
  { latitude: 14.5144554, longitude: 121.0423819 },
  { latitude: 14.5145337, longitude: 121.0427585 },
];

/**
 * Calculate distance between two coordinates using Haversine formula
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
 * Find the minimum distance from a point to the route
 * @param {number} lat - Point latitude
 * @param {number} lon - Point longitude
 * @param {Array} routeCoordinates - Array of route coordinates
 * @returns {number} Minimum distance in meters
 */
export const getDistanceToRoute = (lat, lon, routeCoordinates = WEBTODA_ROUTE_COORDINATES) => {
  let minDistance = Infinity;
  
  for (const coord of routeCoordinates) {
    const distance = calculateHaversineDistance(lat, lon, coord.latitude, coord.longitude);
    if (distance < minDistance) {
      minDistance = distance;
    }
  }
  
  return minDistance;
};

/**
 * Find the nearest point on the route to a given location
 * @param {number} lat 
 * @param {number} lon 
 * @param {Array} routeCoordinates 
 * @returns {{latitude: number, longitude: number, distance: number}}
 */
export const getNearestPointOnRoute = (lat, lon, routeCoordinates = WEBTODA_ROUTE_COORDINATES) => {
  let minDistance = Infinity;
  let nearestPoint = null;
  
  for (const coord of routeCoordinates) {
    const distance = calculateHaversineDistance(lat, lon, coord.latitude, coord.longitude);
    if (distance < minDistance) {
      minDistance = distance;
      nearestPoint = coord;
    }
  }
  
  return {
    ...nearestPoint,
    distance: minDistance,
  };
};

/**
 * Check if a point is within the WEBTODA service area bounding box
 * @param {number} lat 
 * @param {number} lon 
 * @returns {boolean}
 */
export const isWithinBoundingBox = (lat, lon) => {
  const { bounds } = WEBTODA_SERVICE_AREA;
  return (
    lat >= bounds.minLat &&
    lat <= bounds.maxLat &&
    lon >= bounds.minLon &&
    lon <= bounds.maxLon
  );
};

/**
 * Check if a pickup location is valid (within acceptable distance from route)
 * @param {number} lat 
 * @param {number} lon 
 * @returns {{valid: boolean, distance: number, message: string}}
 */
export const validatePickupLocation = (lat, lon) => {
  const distance = getDistanceToRoute(lat, lon);
  const maxDistance = WEBTODA_SERVICE_AREA.maxPickupDistance;
  
  if (distance <= maxDistance) {
    return {
      valid: true,
      distance,
      message: 'Pickup location is within WEBTODA service area',
    };
  }
  
  return {
    valid: false,
    distance,
    message: `Pickup location is ${Math.round(distance)}m from WEBTODA route. Please select a location within ${maxDistance}m of the route.`,
  };
};

/**
 * Check if destination is within service area or needs additional charge warning
 * @param {number} lat 
 * @param {number} lon 
 * @returns {{withinArea: boolean, distance: number, warning: string|null, additionalChargeExpected: boolean}}
 */
export const validateDestinationLocation = (lat, lon) => {
  const distance = getDistanceToRoute(lat, lon);
  const { warningBuffer } = WEBTODA_SERVICE_AREA;
  const isInBoundingBox = isWithinBoundingBox(lat, lon);
  
  // If within bounding box and close to route, it's fully within service area
  if (isInBoundingBox && distance <= warningBuffer) {
    return {
      withinArea: true,
      distance,
      warning: null,
      additionalChargeExpected: false,
    };
  }
  
  // If outside bounding box or far from route, show warning
  if (!isInBoundingBox || distance > warningBuffer) {
    return {
      withinArea: false,
      distance,
      warning: `This destination is ${Math.round(distance)}m outside the WEBTODA service area. Additional charges may apply for destinations beyond the regular route coverage.`,
      additionalChargeExpected: true,
    };
  }
  
  return {
    withinArea: true,
    distance,
    warning: null,
    additionalChargeExpected: false,
  };
};

/**
 * Get the bounding region for the map to show the entire WEBTODA service area
 * @returns {{latitude: number, longitude: number, latitudeDelta: number, longitudeDelta: number}}
 */
export const getServiceAreaRegion = () => {
  const { bounds, center } = WEBTODA_SERVICE_AREA;
  
  // Add some padding to the deltas
  const latDelta = (bounds.maxLat - bounds.minLat) * 1.3;
  const lonDelta = (bounds.maxLon - bounds.minLon) * 1.3;
  
  return {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: Math.max(latDelta, 0.015),
    longitudeDelta: Math.max(lonDelta, 0.015),
  };
};

/**
 * Generate polygon coordinates for the service area boundary
 * Creates a convex hull-like boundary around the route
 * @returns {Array<{latitude: number, longitude: number}>}
 */
export const getServiceAreaPolygon = () => {
  const { bounds } = WEBTODA_SERVICE_AREA;
  const buffer = 0.002; // ~200m buffer
  
  return [
    { latitude: bounds.maxLat + buffer, longitude: bounds.minLon - buffer },
    { latitude: bounds.maxLat + buffer, longitude: bounds.maxLon + buffer },
    { latitude: bounds.minLat - buffer, longitude: bounds.maxLon + buffer },
    { latitude: bounds.minLat - buffer, longitude: bounds.minLon - buffer },
    { latitude: bounds.maxLat + buffer, longitude: bounds.minLon - buffer },
  ];
};

export default {
  parseGPXContent,
  WEBTODA_SERVICE_AREA,
  WEBTODA_ROUTE_COORDINATES,
  calculateHaversineDistance,
  getDistanceToRoute,
  getNearestPointOnRoute,
  isWithinBoundingBox,
  validatePickupLocation,
  validateDestinationLocation,
  getServiceAreaRegion,
  getServiceAreaPolygon,
};
