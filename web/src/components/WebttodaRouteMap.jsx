import { useCallback, useEffect, useState } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Polyline,
  Polygon,
} from "@react-google-maps/api";
import {
  webttodaRouteCoordinates,
  WBT_CENTER,
  COVERAGE_BUFFER_METERS,
} from "../data/webttodaRoute";

const containerStyle = {
  width: "100%",
  height: "500px",
  borderRadius: "16px",
};

const mapOptions = {
  mapTypeId: "satellite",
  mapTypeControl: true,
  mapTypeControlOptions: {
    position: 3, // TOP_RIGHT
  },
  streetViewControl: false,
  fullscreenControl: true,
  zoomControl: true,
};

// Function to calculate offset point for buffer polygon
const offsetPoint = (lat, lng, bearing, distanceMeters) => {
  const R = 6371000; // Earth's radius in meters
  const δ = distanceMeters / R; // Angular distance
  const θ = (bearing * Math.PI) / 180; // Convert bearing to radians
  const φ1 = (lat * Math.PI) / 180; // Convert lat to radians
  const λ1 = (lng * Math.PI) / 180; // Convert lng to radians

  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
    );

  return {
    lat: (φ2 * 180) / Math.PI,
    lng: (λ2 * 180) / Math.PI,
  };
};

// Calculate bearing between two points
const calculateBearing = (p1, p2) => {
  const φ1 = (p1.lat * Math.PI) / 180;
  const φ2 = (p2.lat * Math.PI) / 180;
  const Δλ = ((p2.lng - p1.lng) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);

  return ((θ * 180) / Math.PI + 360) % 360;
};

// Generate smooth rounded arc around a point
const generateArc = (centerLat, centerLng, startBearing, endBearing, radius, numPoints = 8) => {
  const points = [];
  
  // Normalize bearings to handle wrap-around
  let start = startBearing;
  let end = endBearing;
  
  // Determine the shortest arc direction
  let diff = end - start;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  
  // Generate arc points
  for (let i = 0; i <= numPoints; i++) {
    const bearing = start + (diff * i) / numPoints;
    points.push(offsetPoint(centerLat, centerLng, bearing, radius));
  }
  
  return points;
};

// Generate smooth buffer polygon with rounded corners
const generateSmoothBufferPolygon = (routeCoords, bufferMeters) => {
  if (routeCoords.length < 2) return [];

  const polygonPoints = [];
  
  // Generate left side with smooth corners
  for (let i = 0; i < routeCoords.length; i++) {
    const current = routeCoords[i];
    
    if (i === 0) {
      // Start cap - semicircle at the beginning
      const nextBearing = calculateBearing(current, routeCoords[i + 1]);
      const arcPoints = generateArc(
        current.lat, current.lng,
        nextBearing + 180, // Start from back
        nextBearing - 90,  // End at left
        bufferMeters,
        6
      );
      polygonPoints.push(...arcPoints);
    } else if (i === routeCoords.length - 1) {
      // End point on left side
      const prevBearing = calculateBearing(routeCoords[i - 1], current);
      const leftBearing = (prevBearing - 90 + 360) % 360;
      polygonPoints.push(offsetPoint(current.lat, current.lng, leftBearing, bufferMeters));
    } else {
      // Middle points - generate smooth corners
      const prevBearing = calculateBearing(routeCoords[i - 1], current);
      const nextBearing = calculateBearing(current, routeCoords[i + 1]);
      
      const leftPrevBearing = (prevBearing - 90 + 360) % 360;
      const leftNextBearing = (nextBearing - 90 + 360) % 360;
      
      // Check if we need to generate a rounded corner
      let bearingDiff = Math.abs(leftNextBearing - leftPrevBearing);
      if (bearingDiff > 180) bearingDiff = 360 - bearingDiff;
      
      if (bearingDiff > 15) {
        // Generate smooth arc for corner
        const arcPoints = generateArc(
          current.lat, current.lng,
          leftPrevBearing,
          leftNextBearing,
          bufferMeters,
          Math.max(3, Math.floor(bearingDiff / 20))
        );
        polygonPoints.push(...arcPoints);
      } else {
        // Small angle - just add single point
        const avgBearing = (leftPrevBearing + leftNextBearing) / 2;
        polygonPoints.push(offsetPoint(current.lat, current.lng, avgBearing, bufferMeters));
      }
    }
  }
  
  // End cap - semicircle at the end
  const lastPoint = routeCoords[routeCoords.length - 1];
  const lastPrevBearing = calculateBearing(routeCoords[routeCoords.length - 2], lastPoint);
  const endArcPoints = generateArc(
    lastPoint.lat, lastPoint.lng,
    lastPrevBearing - 90,  // Start from left
    lastPrevBearing + 90,  // End at right
    bufferMeters,
    8
  );
  polygonPoints.push(...endArcPoints);
  
  // Generate right side (reversed) with smooth corners
  for (let i = routeCoords.length - 1; i >= 0; i--) {
    const current = routeCoords[i];
    
    if (i === routeCoords.length - 1) {
      // Already handled by end cap
      continue;
    } else if (i === 0) {
      // Start point on right side - already handled by start cap
      continue;
    } else {
      // Middle points - generate smooth corners for right side
      const prevBearing = calculateBearing(routeCoords[i + 1], current); // Reversed direction
      const nextBearing = calculateBearing(current, routeCoords[i - 1]); // Reversed direction
      
      const rightPrevBearing = (prevBearing - 90 + 360) % 360;
      const rightNextBearing = (nextBearing - 90 + 360) % 360;
      
      // Check if we need to generate a rounded corner
      let bearingDiff = Math.abs(rightNextBearing - rightPrevBearing);
      if (bearingDiff > 180) bearingDiff = 360 - bearingDiff;
      
      if (bearingDiff > 15) {
        // Generate smooth arc for corner
        const arcPoints = generateArc(
          current.lat, current.lng,
          rightPrevBearing,
          rightNextBearing,
          bufferMeters,
          Math.max(3, Math.floor(bearingDiff / 20))
        );
        polygonPoints.push(...arcPoints);
      } else {
        // Small angle - just add single point
        const avgBearing = (rightPrevBearing + rightNextBearing) / 2;
        polygonPoints.push(offsetPoint(current.lat, current.lng, avgBearing, bufferMeters));
      }
    }
  }
  
  // Close the polygon back to start with start cap
  const firstPoint = routeCoords[0];
  const firstNextBearing = calculateBearing(firstPoint, routeCoords[1]);
  const startArcPoints = generateArc(
    firstPoint.lat, firstPoint.lng,
    firstNextBearing + 90,   // Start from right
    firstNextBearing + 180,  // End at back (connects to left side)
    bufferMeters,
    6
  );
  polygonPoints.push(...startArcPoints);
  
  return polygonPoints;
};

export default function WebttodaRouteMap() {
  const [map, setMap] = useState(null);
  const [bufferPolygon, setBufferPolygon] = useState([]);

  // Use your Google Maps API key from environment variables
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
  });

  useEffect(() => {
    // Generate smooth buffer polygon on mount
    const polygon = generateSmoothBufferPolygon(
      webttodaRouteCoordinates,
      COVERAGE_BUFFER_METERS
    );
    setBufferPolygon(polygon);
  }, []);

  const onLoad = useCallback((map) => {
    // Fit bounds to show entire route
    const bounds = new window.google.maps.LatLngBounds();
    webttodaRouteCoordinates.forEach((coord) => {
      bounds.extend(coord);
    });
    map.fitBounds(bounds);
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-[500px] bg-gray-100 dark:bg-gray-800 rounded-2xl">
        <div className="text-center">
          <svg
            className="w-16 h-16 text-gray-400 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">
            Error loading Google Maps
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Please check your API key configuration
          </p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-[500px] bg-gray-100 dark:bg-gray-800 rounded-2xl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={WBT_CENTER}
      zoom={16}
      onLoad={onLoad}
      onUnmount={onUnmount}
      options={mapOptions}
    >
      {/* 30 meter coverage buffer polygon with smooth rounded edges */}
      {bufferPolygon.length > 0 && (
        <Polygon
          paths={bufferPolygon}
          options={{
            fillColor: "#FF6B00",
            fillOpacity: 0.2,
            strokeColor: "#FF6B00",
            strokeOpacity: 0.6,
            strokeWeight: 2,
          }}
        />
      )}

      {/* Main route polyline */}
      <Polyline
        path={webttodaRouteCoordinates}
        options={{
          strokeColor: "#FF6B00",
          strokeOpacity: 1,
          strokeWeight: 4,
        }}
      />
    </GoogleMap>
  );
}
