import express from 'express';
import {
  startTrip,
  syncCoordinates,
  endTrip,
  cancelTrip,
  getTripDetails,
  getTripHistory,
  getActiveTrip,
  getActiveDrivers,
  exportGPX,
  exportGeoJSON,
  deleteTrip,
  exportReliveGPX,
} from '../controllers/trackingController.js';
import { protect, optionalVerified, requireVerified } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Tracking Routes
 * Base path: /api/tracking
 * 
 * Supports both authenticated users (must be verified) and guest tracking via deviceId
 * Logged-in users must have verified accounts to use tracking features
 */

// Admin route for live driver tracking
router.get('/active-drivers', protect, getActiveDrivers);

// Trip lifecycle routes (requires verified user if logged in, allows device-based guests)
router.post('/start', optionalVerified, startTrip);
router.post('/:tripId/sync', optionalVerified, syncCoordinates);
router.post('/:tripId/end', optionalVerified, endTrip);
router.post('/:tripId/cancel', optionalVerified, cancelTrip);

// Query routes
router.get('/active', optionalVerified, getActiveTrip);
router.get('/history', optionalVerified, getTripHistory);
router.get('/:tripId', optionalVerified, getTripDetails);

// Export routes
router.post('/export-relive-gpx', optionalVerified, exportReliveGPX);
router.post('/:tripId/export-gpx', optionalVerified, exportGPX);
router.get('/:tripId/geojson', optionalVerified, exportGeoJSON);

// Delete route (authenticated preferred)
router.delete('/:tripId', optionalVerified, deleteTrip);

export default router;
