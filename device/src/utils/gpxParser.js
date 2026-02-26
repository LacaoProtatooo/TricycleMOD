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
 * Sampled every 3rd point from 892-point GPX for a smooth, continuous polyline
 */
export const WEBTODA_ROUTE_COORDINATES = [
  { latitude: 14.5145639, longitude: 121.042821 },
  { latitude: 14.514578, longitude: 121.0427645 },
  { latitude: 14.5145454, longitude: 121.0426802 },
  { latitude: 14.5145085, longitude: 121.0425828 },
  { latitude: 14.5144564, longitude: 121.0424568 },
  { latitude: 14.5144277, longitude: 121.042328 },
  { latitude: 14.5143809, longitude: 121.0421882 },
  { latitude: 14.5143541, longitude: 121.0420694 },
  { latitude: 14.5143295, longitude: 121.0419726 },
  { latitude: 14.5143088, longitude: 121.0418795 },
  { latitude: 14.5142911, longitude: 121.0417919 },
  { latitude: 14.514272, longitude: 121.0417277 },
  { latitude: 14.5142503, longitude: 121.0416738 },
  { latitude: 14.5142252, longitude: 121.0416023 },
  { latitude: 14.5142775, longitude: 121.0415532 },
  { latitude: 14.514374, longitude: 121.0415046 },
  { latitude: 14.5144352, longitude: 121.0414687 },
  { latitude: 14.5144504, longitude: 121.0414045 },
  { latitude: 14.5143893, longitude: 121.0413149 },
  { latitude: 14.5142881, longitude: 121.0411356 },
  { latitude: 14.5142141, longitude: 121.0410126 },
  { latitude: 14.5141587, longitude: 121.0408067 },
  { latitude: 14.5141019, longitude: 121.0406897 },
  { latitude: 14.5140568, longitude: 121.0406048 },
  { latitude: 14.5139954, longitude: 121.0404877 },
  { latitude: 14.5139362, longitude: 121.0403601 },
  { latitude: 14.5138969, longitude: 121.0402756 },
  { latitude: 14.5138549, longitude: 121.0402159 },
  { latitude: 14.5138269, longitude: 121.0401446 },
  { latitude: 14.5137926, longitude: 121.0400506 },
  { latitude: 14.5137694, longitude: 121.0399809 },
  { latitude: 14.5137144, longitude: 121.0398489 },
  { latitude: 14.5136582, longitude: 121.0397055 },
  { latitude: 14.5135945, longitude: 121.0395374 },
  { latitude: 14.5135276, longitude: 121.0393637 },
  { latitude: 14.5134837, longitude: 121.0392356 },
  { latitude: 14.5134385, longitude: 121.0391288 },
  { latitude: 14.5134096, longitude: 121.0390375 },
  { latitude: 14.5133878, longitude: 121.038981 },
  { latitude: 14.5133487, longitude: 121.038905 },
  { latitude: 14.5133273, longitude: 121.038845 },
  { latitude: 14.5133012, longitude: 121.0387713 },
  { latitude: 14.5132551, longitude: 121.038701 },
  { latitude: 14.5132224, longitude: 121.0386409 },
  { latitude: 14.5131828, longitude: 121.0385715 },
  { latitude: 14.5131203, longitude: 121.0384145 },
  { latitude: 14.5130436, longitude: 121.0382305 },
  { latitude: 14.5130059, longitude: 121.0381124 },
  { latitude: 14.5129584, longitude: 121.0379789 },
  { latitude: 14.5129104, longitude: 121.0378742 },
  { latitude: 14.5128838, longitude: 121.0377676 },
  { latitude: 14.5128621, longitude: 121.0377016 },
  { latitude: 14.5128339, longitude: 121.0376199 },
  { latitude: 14.5127981, longitude: 121.0375325 },
  { latitude: 14.5127615, longitude: 121.0374237 },
  { latitude: 14.512711, longitude: 121.0373146 },
  { latitude: 14.5126585, longitude: 121.0372191 },
  { latitude: 14.5125876, longitude: 121.0371251 },
  { latitude: 14.5125245, longitude: 121.0370466 },
  { latitude: 14.5124826, longitude: 121.0369743 },
  { latitude: 14.5124193, longitude: 121.0368934 },
  { latitude: 14.5123639, longitude: 121.0368281 },
  { latitude: 14.5123302, longitude: 121.0367671 },
  { latitude: 14.5122726, longitude: 121.0366778 },
  { latitude: 14.5122156, longitude: 121.0366121 },
  { latitude: 14.5121661, longitude: 121.0365055 },
  { latitude: 14.5121087, longitude: 121.0364367 },
  { latitude: 14.5120342, longitude: 121.0363354 },
  { latitude: 14.5119771, longitude: 121.0362413 },
  { latitude: 14.5119241, longitude: 121.036123 },
  { latitude: 14.5118799, longitude: 121.0359823 },
  { latitude: 14.5118191, longitude: 121.0358323 },
  { latitude: 14.5117737, longitude: 121.0356897 },
  { latitude: 14.5117492, longitude: 121.0356213 },
  { latitude: 14.5117081, longitude: 121.0355155 },
  { latitude: 14.5116911, longitude: 121.0354423 },
  { latitude: 14.5116671, longitude: 121.0353581 },
  { latitude: 14.5116366, longitude: 121.0352908 },
  { latitude: 14.5115996, longitude: 121.0351581 },
  { latitude: 14.5115575, longitude: 121.0349873 },
  { latitude: 14.511499, longitude: 121.0348206 },
  { latitude: 14.5114358, longitude: 121.0346694 },
  { latitude: 14.5113828, longitude: 121.0345729 },
  { latitude: 14.5113935, longitude: 121.0344832 },
  { latitude: 14.5114725, longitude: 121.0344043 },
  { latitude: 14.5115376, longitude: 121.0343459 },
  { latitude: 14.5115747, longitude: 121.0342855 },
  { latitude: 14.5115512, longitude: 121.0342106 },
  { latitude: 14.5114857, longitude: 121.0341174 },
  { latitude: 14.5114218, longitude: 121.0340383 },
  { latitude: 14.511366, longitude: 121.0339724 },
  { latitude: 14.5113285, longitude: 121.0339161 },
  { latitude: 14.5113007, longitude: 121.0338623 },
  { latitude: 14.5113097, longitude: 121.0338137 },
  { latitude: 14.5112892, longitude: 121.0337498 },
  { latitude: 14.5112731, longitude: 121.0336848 },
  { latitude: 14.511284, longitude: 121.033597 },
  { latitude: 14.5112577, longitude: 121.0335586 },
  { latitude: 14.5111666, longitude: 121.0335905 },
  { latitude: 14.5109938, longitude: 121.0336813 },
  { latitude: 14.5107945, longitude: 121.0337633 },
  { latitude: 14.5105857, longitude: 121.0338634 },
  { latitude: 14.510361, longitude: 121.0339825 },
  { latitude: 14.510119, longitude: 121.0341143 },
  { latitude: 14.5098772, longitude: 121.0342443 },
  { latitude: 14.5096257, longitude: 121.0343859 },
  { latitude: 14.5093618, longitude: 121.034519 },
  { latitude: 14.5090694, longitude: 121.0346319 },
  { latitude: 14.508766, longitude: 121.0347049 },
  { latitude: 14.5085031, longitude: 121.0347599 },
  { latitude: 14.5082872, longitude: 121.0348195 },
  { latitude: 14.5081535, longitude: 121.0348644 },
  { latitude: 14.508023, longitude: 121.0349109 },
  { latitude: 14.5078968, longitude: 121.0349672 },
  { latitude: 14.5077523, longitude: 121.0350413 },
  { latitude: 14.5075684, longitude: 121.0351413 },
  { latitude: 14.5073279, longitude: 121.0352831 },
  { latitude: 14.5070468, longitude: 121.0354326 },
  { latitude: 14.5067879, longitude: 121.0355681 },
  { latitude: 14.5065653, longitude: 121.035682 },
  { latitude: 14.5063608, longitude: 121.0357991 },
  { latitude: 14.5061543, longitude: 121.0359517 },
  { latitude: 14.5059888, longitude: 121.0361464 },
  { latitude: 14.5058045, longitude: 121.0363582 },
  { latitude: 14.5055987, longitude: 121.0365553 },
  { latitude: 14.5054012, longitude: 121.0367293 },
  { latitude: 14.505309, longitude: 121.0369501 },
  { latitude: 14.5053855, longitude: 121.0371863 },
  { latitude: 14.5055002, longitude: 121.0374753 },
  { latitude: 14.505623, longitude: 121.0377755 },
  { latitude: 14.505697, longitude: 121.0380406 },
  { latitude: 14.5057101, longitude: 121.0383071 },
  { latitude: 14.5056926, longitude: 121.0385204 },
  { latitude: 14.5056888, longitude: 121.0386433 },
  { latitude: 14.5057371, longitude: 121.0387345 },
  { latitude: 14.5058316, longitude: 121.038781 },
  { latitude: 14.5059334, longitude: 121.0387554 },
  { latitude: 14.5060212, longitude: 121.0386478 },
  { latitude: 14.5060496, longitude: 121.0385169 },
  { latitude: 14.5060714, longitude: 121.0384213 },
  { latitude: 14.5060659, longitude: 121.0383533 },
  { latitude: 14.5060296, longitude: 121.0382496 },
  { latitude: 14.5060039, longitude: 121.0380651 },
  { latitude: 14.5059775, longitude: 121.0378426 },
  { latitude: 14.505971, longitude: 121.0376197 },
  { latitude: 14.5060147, longitude: 121.0374047 },
  { latitude: 14.5061438, longitude: 121.0372063 },
  { latitude: 14.5063036, longitude: 121.0370149 },
  { latitude: 14.5064432, longitude: 121.0368192 },
  { latitude: 14.5065087, longitude: 121.0365972 },
  { latitude: 14.5065193, longitude: 121.0363739 },
  { latitude: 14.5065188, longitude: 121.0361699 },
  { latitude: 14.5065103, longitude: 121.0360041 },
  { latitude: 14.5065295, longitude: 121.0358857 },
  { latitude: 14.5065578, longitude: 121.0358187 },
  { latitude: 14.5065959, longitude: 121.0357605 },
  { latitude: 14.5066529, longitude: 121.0357078 },
  { latitude: 14.5067308, longitude: 121.0356722 },
  { latitude: 14.5067944, longitude: 121.035604 },
  { latitude: 14.5068562, longitude: 121.0355715 },
  { latitude: 14.5069143, longitude: 121.0355394 },
  { latitude: 14.5069743, longitude: 121.0355017 },
  { latitude: 14.5070277, longitude: 121.0354708 },
  { latitude: 14.5070984, longitude: 121.0354379 },
  { latitude: 14.5071677, longitude: 121.0354088 },
  { latitude: 14.5072301, longitude: 121.0353845 },
  { latitude: 14.5072796, longitude: 121.0353482 },
  { latitude: 14.5073446, longitude: 121.0353132 },
  { latitude: 14.5074174, longitude: 121.0352793 },
  { latitude: 14.5074818, longitude: 121.0352513 },
  { latitude: 14.5075572, longitude: 121.035212 },
  { latitude: 14.5076132, longitude: 121.0351849 },
  { latitude: 14.5076781, longitude: 121.0351537 },
  { latitude: 14.5077442, longitude: 121.0351149 },
  { latitude: 14.5078106, longitude: 121.0350807 },
  { latitude: 14.5078882, longitude: 121.0350429 },
  { latitude: 14.5079743, longitude: 121.0349973 },
  { latitude: 14.508056, longitude: 121.0349616 },
  { latitude: 14.5081157, longitude: 121.0349369 },
  { latitude: 14.5081952, longitude: 121.0349042 },
  { latitude: 14.5082687, longitude: 121.0348862 },
  { latitude: 14.5083884, longitude: 121.0348586 },
  { latitude: 14.5085573, longitude: 121.0348181 },
  { latitude: 14.5087837, longitude: 121.0347712 },
  { latitude: 14.5090272, longitude: 121.034716 },
  { latitude: 14.5092303, longitude: 121.0346525 },
  { latitude: 14.5094102, longitude: 121.0345754 },
  { latitude: 14.5095599, longitude: 121.0345031 },
  { latitude: 14.5096974, longitude: 121.0344341 },
  { latitude: 14.5097837, longitude: 121.0343843 },
  { latitude: 14.5098612, longitude: 121.0343421 },
  { latitude: 14.5099553, longitude: 121.0343071 },
  { latitude: 14.5100831, longitude: 121.034338 },
  { latitude: 14.5102421, longitude: 121.0344056 },
  { latitude: 14.5103914, longitude: 121.0344983 },
  { latitude: 14.5104635, longitude: 121.0345994 },
  { latitude: 14.5105444, longitude: 121.0346742 },
  { latitude: 14.5106237, longitude: 121.0347061 },
  { latitude: 14.5107333, longitude: 121.034703 },
  { latitude: 14.5108225, longitude: 121.0347022 },
  { latitude: 14.5108973, longitude: 121.0347035 },
  { latitude: 14.5109665, longitude: 121.0346924 },
  { latitude: 14.5110392, longitude: 121.0346632 },
  { latitude: 14.5111246, longitude: 121.0346317 },
  { latitude: 14.5112113, longitude: 121.0346047 },
  { latitude: 14.511274, longitude: 121.0345758 },
  { latitude: 14.5113341, longitude: 121.0345339 },
  { latitude: 14.5114263, longitude: 121.0345445 },
  { latitude: 14.5114765, longitude: 121.034675 },
  { latitude: 14.5115291, longitude: 121.0348141 },
  { latitude: 14.5115666, longitude: 121.0349247 },
  { latitude: 14.5115883, longitude: 121.0349989 },
  { latitude: 14.5116111, longitude: 121.0350807 },
  { latitude: 14.5116587, longitude: 121.0352034 },
  { latitude: 14.5117017, longitude: 121.0353497 },
  { latitude: 14.5117214, longitude: 121.0354369 },
  { latitude: 14.5117485, longitude: 121.0355185 },
  { latitude: 14.5117964, longitude: 121.0356493 },
  { latitude: 14.5118251, longitude: 121.035728 },
  { latitude: 14.5118697, longitude: 121.0358305 },
  { latitude: 14.5119212, longitude: 121.0359611 },
  { latitude: 14.5119612, longitude: 121.0360614 },
  { latitude: 14.5119831, longitude: 121.0361414 },
  { latitude: 14.5120125, longitude: 121.0362024 },
  { latitude: 14.5120682, longitude: 121.0362961 },
  { latitude: 14.5121417, longitude: 121.036409 },
  { latitude: 14.512209, longitude: 121.0365112 },
  { latitude: 14.5122735, longitude: 121.0366197 },
  { latitude: 14.5123583, longitude: 121.0367318 },
  { latitude: 14.5124432, longitude: 121.0368521 },
  { latitude: 14.5125226, longitude: 121.036973 },
  { latitude: 14.512604, longitude: 121.0370859 },
  { latitude: 14.5126634, longitude: 121.0371761 },
  { latitude: 14.5127031, longitude: 121.0372566 },
  { latitude: 14.5127411, longitude: 121.0373057 },
  { latitude: 14.5127917, longitude: 121.037402 },
  { latitude: 14.5128375, longitude: 121.0374966 },
  { latitude: 14.512865, longitude: 121.0375817 },
  { latitude: 14.5128762, longitude: 121.0376583 },
  { latitude: 14.5129095, longitude: 121.0377164 },
  { latitude: 14.5129436, longitude: 121.0377859 },
  { latitude: 14.5129914, longitude: 121.0379334 },
  { latitude: 14.5130267, longitude: 121.0381014 },
  { latitude: 14.5130749, longitude: 121.0382131 },
  { latitude: 14.5130992, longitude: 121.0382857 },
  { latitude: 14.5131435, longitude: 121.0383512 },
  { latitude: 14.5131725, longitude: 121.0384307 },
  { latitude: 14.5132152, longitude: 121.0384879 },
  { latitude: 14.5132423, longitude: 121.0385521 },
  { latitude: 14.513266, longitude: 121.0386067 },
  { latitude: 14.5132952, longitude: 121.038662 },
  { latitude: 14.5133262, longitude: 121.038718 },
  { latitude: 14.5133579, longitude: 121.0387757 },
  { latitude: 14.5133941, longitude: 121.0388485 },
  { latitude: 14.5134314, longitude: 121.0389332 },
  { latitude: 14.5134475, longitude: 121.0390094 },
  { latitude: 14.5134611, longitude: 121.0390722 },
  { latitude: 14.513492, longitude: 121.039161 },
  { latitude: 14.5135307, longitude: 121.0392722 },
  { latitude: 14.5135728, longitude: 121.039381 },
  { latitude: 14.5136159, longitude: 121.0394779 },
  { latitude: 14.513659, longitude: 121.0395845 },
  { latitude: 14.5136974, longitude: 121.0396654 },
  { latitude: 14.513737, longitude: 121.0397794 },
  { latitude: 14.5137699, longitude: 121.0398493 },
  { latitude: 14.5138147, longitude: 121.0399313 },
  { latitude: 14.5138269, longitude: 121.0400119 },
  { latitude: 14.5138516, longitude: 121.0400734 },
  { latitude: 14.5138911, longitude: 121.0401326 },
  { latitude: 14.5139317, longitude: 121.0401921 },
  { latitude: 14.5139666, longitude: 121.0402865 },
  { latitude: 14.5140175, longitude: 121.0404566 },
  { latitude: 14.5140731, longitude: 121.0405782 },
  { latitude: 14.5141068, longitude: 121.040661 },
  { latitude: 14.5141454, longitude: 121.0407327 },
  { latitude: 14.5141957, longitude: 121.0408516 },
  { latitude: 14.5142471, longitude: 121.0409354 },
  { latitude: 14.5142764, longitude: 121.0410058 },
  { latitude: 14.5143272, longitude: 121.0411074 },
  { latitude: 14.51437, longitude: 121.0412068 },
  { latitude: 14.5144067, longitude: 121.0412928 },
  { latitude: 14.5144414, longitude: 121.0413602 },
  { latitude: 14.5144658, longitude: 121.0414284 },
  { latitude: 14.5144167, longitude: 121.0414752 },
  { latitude: 14.5143487, longitude: 121.0415072 },
  { latitude: 14.5142882, longitude: 121.0415284 },
  { latitude: 14.5142596, longitude: 121.041588 },
  { latitude: 14.5142709, longitude: 121.0416746 },
  { latitude: 14.514299, longitude: 121.0417462 },
  { latitude: 14.5143354, longitude: 121.0418332 },
  { latitude: 14.514356, longitude: 121.041936 },
  { latitude: 14.5143872, longitude: 121.0420768 },
  { latitude: 14.5144268, longitude: 121.0422247 },
  { latitude: 14.5144508, longitude: 121.0423496 },
  { latitude: 14.5144743, longitude: 121.0424661 },
  { latitude: 14.5145018, longitude: 121.0425909 },
  { latitude: 14.51452, longitude: 121.0426916 },
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
