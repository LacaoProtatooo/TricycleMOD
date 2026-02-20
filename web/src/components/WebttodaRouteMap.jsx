import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Polyline, Polygon, useMap } from "react-leaflet";
import {
  webttodaRouteCoordinates,
  WBT_CENTER,
  COVERAGE_BUFFER_METERS,
} from "../data/webttodaRoute";
import L from "leaflet";

const containerStyle = {
  width: "100%",
  height: "500px",
  borderRadius: "16px",
};

// Component to fit map bounds to route on load
function FitBounds({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length > 0) {
      const bounds = L.latLngBounds(coords.map((c) => [c.lat, c.lng]));
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [map, coords]);
  return null;
}

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
  const [bufferPolygon, setBufferPolygon] = useState([]);

  useEffect(() => {
    // Generate smooth buffer polygon on mount
    const polygon = generateSmoothBufferPolygon(
      webttodaRouteCoordinates,
      COVERAGE_BUFFER_METERS
    );
    setBufferPolygon(polygon);
  }, []);

  // Convert {lat, lng} to [lat, lng] for Leaflet
  const routePositions = webttodaRouteCoordinates.map((c) => [c.lat, c.lng]);
  const bufferPositions = bufferPolygon.map((c) => [c.lat, c.lng]);

  return (
    <MapContainer
      center={[WBT_CENTER.lat, WBT_CENTER.lng]}
      zoom={16}
      style={containerStyle}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds coords={webttodaRouteCoordinates} />

      {/* 30 meter coverage buffer polygon with smooth rounded edges */}
      {bufferPositions.length > 0 && (
        <Polygon
          positions={bufferPositions}
          pathOptions={{
            fillColor: "#FF6B00",
            fillOpacity: 0.2,
            color: "#FF6B00",
            opacity: 0.6,
            weight: 2,
          }}
        />
      )}

      {/* Main route polyline */}
      <Polyline
        positions={routePositions}
        pathOptions={{
          color: "#FF6B00",
          opacity: 1,
          weight: 4,
        }}
      />
    </MapContainer>
  );
}
