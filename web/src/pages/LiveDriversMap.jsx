import { useCallback, useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  GoogleMap,
  useJsApiLoader,
  Polyline,
  Polygon,
  Marker,
  InfoWindow,
} from "@react-google-maps/api";
import PageMeta from "../components/common/PageMeta";
import PageBreadCrumb from "../components/common/PageBreadCrumb";
import { fetchActiveDrivers } from "../redux/actions/liveTrackingAction";
import {
  selectDriver,
  clearSelectedDriver,
  toggleAutoRefresh,
  toggleShowRoute,
  toggleShowServiceArea,
} from "../redux/reducers/liveTrackingReducer";
import {
  webttodaRouteCoordinates,
  WBT_CENTER,
  COVERAGE_BUFFER_METERS,
} from "../data/webttodaRoute";

// Map container style
const containerStyle = {
  width: "100%",
  height: "calc(100vh - 280px)",
  minHeight: "500px",
  borderRadius: "16px",
};

// Map options
const mapOptions = {
  mapTypeId: "roadmap",
  mapTypeControl: true,
  mapTypeControlOptions: {
    position: 3, // TOP_RIGHT
  },
  streetViewControl: false,
  fullscreenControl: true,
  zoomControl: true,
};

// Tricycle marker icon (SVG path for tricycle shape)
const createTricycleIcon = (heading = 0, isSelected = false) => ({
  path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
  fillColor: isSelected ? "#2563eb" : "#FF6B00",
  fillOpacity: 1,
  strokeWeight: 2,
  strokeColor: "#ffffff",
  scale: isSelected ? 1.8 : 1.5,
  anchor: { x: 12, y: 22 },
  rotation: heading,
});

// Helper functions for buffer polygon (same as WebttodaRouteMap)
const offsetPoint = (lat, lng, bearing, distanceMeters) => {
  const R = 6371000;
  const δ = distanceMeters / R;
  const θ = (bearing * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lng * Math.PI) / 180;

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

const generateArc = (centerLat, centerLng, startBearing, endBearing, radius, numPoints = 8) => {
  const points = [];
  let start = startBearing;
  let end = endBearing;
  let diff = end - start;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;

  for (let i = 0; i <= numPoints; i++) {
    const bearing = start + (diff * i) / numPoints;
    points.push(offsetPoint(centerLat, centerLng, bearing, radius));
  }
  return points;
};

const generateSmoothBufferPolygon = (routeCoords, bufferMeters) => {
  if (routeCoords.length < 2) return [];

  const polygonPoints = [];

  for (let i = 0; i < routeCoords.length; i++) {
    const current = routeCoords[i];

    if (i === 0) {
      const nextBearing = calculateBearing(current, routeCoords[i + 1]);
      const arcPoints = generateArc(
        current.lat, current.lng,
        nextBearing + 180,
        nextBearing - 90,
        bufferMeters,
        6
      );
      polygonPoints.push(...arcPoints);
    } else if (i === routeCoords.length - 1) {
      const prevBearing = calculateBearing(routeCoords[i - 1], current);
      const leftBearing = (prevBearing - 90 + 360) % 360;
      polygonPoints.push(offsetPoint(current.lat, current.lng, leftBearing, bufferMeters));
    } else {
      const prevBearing = calculateBearing(routeCoords[i - 1], current);
      const nextBearing = calculateBearing(current, routeCoords[i + 1]);
      const leftPrevBearing = (prevBearing - 90 + 360) % 360;
      const leftNextBearing = (nextBearing - 90 + 360) % 360;

      let bearingDiff = Math.abs(leftNextBearing - leftPrevBearing);
      if (bearingDiff > 180) bearingDiff = 360 - bearingDiff;

      if (bearingDiff > 15) {
        const arcPoints = generateArc(
          current.lat, current.lng,
          leftPrevBearing,
          leftNextBearing,
          bufferMeters,
          Math.max(3, Math.floor(bearingDiff / 20))
        );
        polygonPoints.push(...arcPoints);
      } else {
        const avgBearing = (leftPrevBearing + leftNextBearing) / 2;
        polygonPoints.push(offsetPoint(current.lat, current.lng, avgBearing, bufferMeters));
      }
    }
  }

  const lastPoint = routeCoords[routeCoords.length - 1];
  const lastPrevBearing = calculateBearing(routeCoords[routeCoords.length - 2], lastPoint);
  const endArcPoints = generateArc(
    lastPoint.lat, lastPoint.lng,
    lastPrevBearing - 90,
    lastPrevBearing + 90,
    bufferMeters,
    8
  );
  polygonPoints.push(...endArcPoints);

  for (let i = routeCoords.length - 1; i >= 0; i--) {
    const current = routeCoords[i];

    if (i === routeCoords.length - 1 || i === 0) continue;

    const prevBearing = calculateBearing(routeCoords[i + 1], current);
    const nextBearing = calculateBearing(current, routeCoords[i - 1]);
    const rightPrevBearing = (prevBearing - 90 + 360) % 360;
    const rightNextBearing = (nextBearing - 90 + 360) % 360;

    let bearingDiff = Math.abs(rightNextBearing - rightPrevBearing);
    if (bearingDiff > 180) bearingDiff = 360 - bearingDiff;

    if (bearingDiff > 15) {
      const arcPoints = generateArc(
        current.lat, current.lng,
        rightPrevBearing,
        rightNextBearing,
        bufferMeters,
        Math.max(3, Math.floor(bearingDiff / 20))
      );
      polygonPoints.push(...arcPoints);
    } else {
      const avgBearing = (rightPrevBearing + rightNextBearing) / 2;
      polygonPoints.push(offsetPoint(current.lat, current.lng, avgBearing, bufferMeters));
    }
  }

  const firstPoint = routeCoords[0];
  const firstNextBearing = calculateBearing(firstPoint, routeCoords[1]);
  const startArcPoints = generateArc(
    firstPoint.lat, firstPoint.lng,
    firstNextBearing + 90,
    firstNextBearing + 180,
    bufferMeters,
    6
  );
  polygonPoints.push(...startArcPoints);

  return polygonPoints;
};

// Icons
const RefreshIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const LocationIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const TricycleIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
  </svg>
);

export default function LiveDriversMap() {
  const dispatch = useDispatch();
  const { drivers, driversNoLocation, count, totalOnline, loading, error, selectedDriver, mapSettings, lastUpdated } = useSelector(
    (state) => state.liveTracking
  );

  const [map, setMap] = useState(null);
  const [bufferPolygon, setBufferPolygon] = useState([]);
  const [infoWindowOpen, setInfoWindowOpen] = useState(null);
  const refreshIntervalRef = useRef(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
  });

  // Fetch active drivers on mount
  useEffect(() => {
    dispatch(fetchActiveDrivers());
  }, [dispatch]);

  // Auto-refresh
  useEffect(() => {
    if (mapSettings.autoRefresh) {
      refreshIntervalRef.current = setInterval(() => {
        dispatch(fetchActiveDrivers());
      }, mapSettings.refreshInterval);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [dispatch, mapSettings.autoRefresh, mapSettings.refreshInterval]);

  // Generate buffer polygon on mount
  useEffect(() => {
    const polygon = generateSmoothBufferPolygon(
      webttodaRouteCoordinates,
      COVERAGE_BUFFER_METERS
    );
    setBufferPolygon(polygon);
  }, []);

  const onLoad = useCallback((map) => {
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

  const handleMarkerClick = (driver) => {
    dispatch(selectDriver(driver));
    setInfoWindowOpen(driver.driver?._id);
  };

  const handleInfoWindowClose = () => {
    dispatch(clearSelectedDriver());
    setInfoWindowOpen(null);
  };

  const handleManualRefresh = () => {
    dispatch(fetchActiveDrivers());
  };

  const formatTime = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatSpeed = (speed) => {
    if (!speed || speed === 0) return "Stationary";
    const kmh = (speed * 3.6).toFixed(1);
    return `${kmh} km/h`;
  };

  if (loadError) {
    return (
      <>
        <PageMeta title="Live Tracking | WEBT-TRaC Admin Dashboard" />
        <PageBreadCrumb pageTitle="Live Driver Tracking" />
        <div className="flex items-center justify-center h-[500px] bg-gray-100 dark:bg-gray-800 rounded-2xl">
          <div className="text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400">Error loading Google Maps</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Please check your API key configuration</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageMeta title="Live Tracking | WEBT-TRaC Admin Dashboard" />
      <PageBreadCrumb pageTitle="Live Driver Tracking" />

      <div className="space-y-6">
        {/* Header Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Stats Cards */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
              <div>
                <p className="text-xs text-green-600 dark:text-green-400">Online Drivers</p>
                <p className="text-lg font-bold text-green-700 dark:text-green-300">{totalOnline}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <TricycleIcon />
              <div>
                <p className="text-xs text-orange-600 dark:text-orange-400">On Map</p>
                <p className="text-lg font-bold text-orange-700 dark:text-orange-300">{count}</p>
              </div>
            </div>
            {lastUpdated && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Last updated: {formatTime(lastUpdated)}
              </div>
            )}
          </div>

          {/* Control Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Auto-refresh toggle */}
            <button
              onClick={() => dispatch(toggleAutoRefresh())}
              className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                mapSettings.autoRefresh
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${mapSettings.autoRefresh ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
              Auto-refresh {mapSettings.autoRefresh ? "ON" : "OFF"}
            </button>

            {/* Show Route toggle */}
            <button
              onClick={() => dispatch(toggleShowRoute())}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                mapSettings.showRoute
                  ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
              }`}
            >
              Route
            </button>

            {/* Show Service Area toggle */}
            <button
              onClick={() => dispatch(toggleShowServiceArea())}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                mapSettings.showServiceArea
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
              }`}
            >
              Service Area
            </button>

            {/* Manual Refresh */}
            <button
              onClick={handleManualRefresh}
              disabled={loading}
              className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <RefreshIcon />
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Map and Driver List Container */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Map */}
          <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
            {!isLoaded ? (
              <div className="flex items-center justify-center h-[500px]">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
                  <p className="text-gray-500 dark:text-gray-400">Loading map...</p>
                </div>
              </div>
            ) : (
              <GoogleMap
                mapContainerStyle={containerStyle}
                center={WBT_CENTER}
                zoom={16}
                onLoad={onLoad}
                onUnmount={onUnmount}
                options={mapOptions}
              >
                {/* Service area buffer polygon */}
                {mapSettings.showServiceArea && bufferPolygon.length > 0 && (
                  <Polygon
                    paths={bufferPolygon}
                    options={{
                      fillColor: "#FF6B00",
                      fillOpacity: 0.1,
                      strokeColor: "#FF6B00",
                      strokeOpacity: 0.4,
                      strokeWeight: 2,
                    }}
                  />
                )}

                {/* Main route polyline */}
                {mapSettings.showRoute && (
                  <Polyline
                    path={webttodaRouteCoordinates}
                    options={{
                      strokeColor: "#FF6B00",
                      strokeOpacity: 0.8,
                      strokeWeight: 3,
                    }}
                  />
                )}

                {/* Driver markers */}
                {drivers.map((driver) => (
                  <Marker
                    key={driver.driver?._id || driver.tripInfo?.tripId}
                    position={{
                      lat: driver.currentLocation.latitude,
                      lng: driver.currentLocation.longitude,
                    }}
                    icon={createTricycleIcon(
                      driver.currentLocation.heading,
                      selectedDriver?.driver?._id === driver.driver?._id
                    )}
                    onClick={() => handleMarkerClick(driver)}
                    title={driver.driver?.name || "Unknown Driver"}
                  >
                    {infoWindowOpen === driver.driver?._id && (
                      <InfoWindow
                        onCloseClick={handleInfoWindowClose}
                        position={{
                          lat: driver.currentLocation.latitude,
                          lng: driver.currentLocation.longitude,
                        }}
                      >
                        <div className="p-2 min-w-[200px]">
                          <div className="flex items-center gap-3 mb-3">
                            {driver.driver?.image ? (
                              <img
                                src={driver.driver.image}
                                alt={driver.driver.name}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                                <span className="text-orange-600 dark:text-orange-400 font-semibold">
                                  {driver.driver?.name?.charAt(0) || "?"}
                                </span>
                              </div>
                            )}
                            <div>
                              <h4 className="font-semibold text-gray-900 dark:text-white">
                                {driver.driver?.name || "Unknown Driver"}
                              </h4>
                              {driver.tricycle && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {driver.tricycle.plateNumber} • Body #{driver.tricycle.bodyNumber}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-500 dark:text-gray-400">Speed:</span>
                              <span className="font-medium text-gray-900 dark:text-white">{formatSpeed(driver.currentLocation?.speed)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500 dark:text-gray-400">Last Update:</span>
                              <span className="font-medium text-gray-900 dark:text-white">{formatTime(driver.currentLocation?.timestamp || driver.activity?.lastActiveAt)}</span>
                            </div>
                            {driver.driver?.rating > 0 && (
                              <div className="flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">Rating:</span>
                                <span className="font-medium text-gray-900 dark:text-white">⭐ {driver.driver.rating.toFixed(1)}</span>
                              </div>
                            )}
                            {driver.driver?.tripCount > 0 && (
                              <div className="flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">Trips:</span>
                                <span className="font-medium text-gray-900 dark:text-white">{driver.driver.tripCount}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </InfoWindow>
                    )}
                  </Marker>
                ))}
              </GoogleMap>
            )}
          </div>

          {/* Driver List Sidebar */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 overflow-hidden">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <LocationIcon />
              Online Drivers ({totalOnline})
            </h3>

            {loading && drivers.length === 0 && (!driversNoLocation || driversNoLocation.length === 0) ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
              </div>
            ) : drivers.length === 0 && (!driversNoLocation || driversNoLocation.length === 0) ? (
              <div className="text-center py-8">
                <TricycleIcon />
                <p className="text-gray-500 dark:text-gray-400 mt-2">No online drivers</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Drivers will appear here when online
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[calc(100vh-400px)] overflow-y-auto">
                {/* Drivers with location (on map) */}
                {drivers.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                      On Map ({count})
                    </p>
                    <div className="space-y-2">
                      {drivers.map((driver) => (
                        <button
                          key={driver.driver?._id || driver.tripInfo?.tripId}
                          onClick={() => {
                            handleMarkerClick(driver);
                            if (map && driver.currentLocation) {
                              map.panTo({
                                lat: driver.currentLocation.latitude,
                                lng: driver.currentLocation.longitude,
                              });
                              map.setZoom(18);
                            }
                          }}
                          className={`w-full text-left p-3 rounded-lg border transition-all ${
                            selectedDriver?.driver?._id === driver.driver?._id
                              ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
                              : "border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-700"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {driver.driver?.image ? (
                              <img
                                src={driver.driver.image}
                                alt={driver.driver.name}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                                <span className="text-orange-600 dark:text-orange-400 text-sm font-semibold">
                                  {driver.driver?.name?.charAt(0) || "?"}
                                </span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                                {driver.driver?.name || "Unknown"}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {formatSpeed(driver.currentLocation?.speed)}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1 animate-pulse"></span>
                                Live
                              </span>
                            </div>
                          </div>
                          {driver.tricycle && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 pl-11">
                              {driver.tricycle.plateNumber}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Drivers online but without location */}
                {driversNoLocation && driversNoLocation.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                      Online - No GPS ({driversNoLocation.length})
                    </p>
                    <div className="space-y-2">
                      {driversNoLocation.map((driver) => (
                        <div
                          key={driver.driver?._id}
                          className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50"
                        >
                          <div className="flex items-center gap-3">
                            {driver.driver?.image ? (
                              <img
                                src={driver.driver.image}
                                alt={driver.driver.name}
                                className="w-8 h-8 rounded-full object-cover opacity-75"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                                <span className="text-gray-500 dark:text-gray-400 text-sm font-semibold">
                                  {driver.driver?.name?.charAt(0) || "?"}
                                </span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-700 dark:text-gray-300 text-sm truncate">
                                {driver.driver?.name || "Unknown"}
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">
                                No location data
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300">
                                Online
                              </span>
                            </div>
                          </div>
                          {driver.tricycle && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 pl-11">
                              {driver.tricycle.plateNumber}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Map Legend</h4>
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-orange-500"></div>
              <span className="text-gray-600 dark:text-gray-400">Active Driver</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500"></div>
              <span className="text-gray-600 dark:text-gray-400">Selected Driver</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-1 bg-orange-500 rounded"></div>
              <span className="text-gray-600 dark:text-gray-400">WEBTODA Route</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-500/20 border border-orange-500/40 rounded"></div>
              <span className="text-gray-600 dark:text-gray-400">Service Coverage Area</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
