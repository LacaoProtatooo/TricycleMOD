import TrackingRecord from '../models/trackingRecordModel.js';
import UserActivity from '../models/userActivityModel.js';
import User from '../models/userModel.js';
import Tricycle from '../models/tricycleModel.js';
import cloudinary from '../utils/cloudinaryConfig.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Tracking Controller - GPS Trip Recording Operations
 * 
 * Handles trip lifecycle: start → sync coordinates → end → export GPX
 */

// Helper to generate GPX content
const generateGPX = (record) => {
  const formatDate = (date) => new Date(date).toISOString();
  
  const trackpoints = record.coordinates.map(coord => `
      <trkpt lat="${coord.latitude}" lon="${coord.longitude}">
        <ele>${coord.altitude || 0}</ele>
        <time>${formatDate(coord.timestamp)}</time>
        ${coord.speed ? `<speed>${coord.speed}</speed>` : ''}
        ${coord.heading ? `<course>${coord.heading}</course>` : ''}
      </trkpt>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TricycleMOD"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${record.name || `Trip ${record.tripId}`}</name>
    <time>${formatDate(record.startTime)}</time>
  </metadata>
  <trk>
    <name>${record.name || `Trip ${record.tripId}`}</name>
    <trkseg>${trackpoints}
    </trkseg>
  </trk>
</gpx>`;
};

// Helper to generate GeoJSON
const generateGeoJSON = (record) => {
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {
        tripId: record.tripId,
        name: record.name || `Trip ${record.tripId}`,
        startTime: record.startTime,
        endTime: record.endTime,
        duration: record.duration,
        distance: record.totalDistance,
        avgSpeed: record.avgSpeed,
        maxSpeed: record.maxSpeed,
      },
      geometry: {
        type: 'LineString',
        coordinates: record.coordinates.map(c => [
          c.longitude,
          c.latitude,
          c.altitude || 0,
        ]),
      },
    }],
  };
};

/**
 * Start a new trip
 * POST /api/tracking/start
 */
export const startTrip = async (req, res) => {
  try {
    const { deviceId, name, initialCoordinate } = req.body;
    const userId = req.user?._id || null;

    // Validate input
    if (!deviceId && !userId) {
      return res.status(400).json({
        success: false,
        message: 'Either deviceId or authenticated user is required',
      });
    }

    // Check for existing active trip
    const existingTrip = await TrackingRecord.findOne({
      $or: [
        { userId, status: 'active' },
        { deviceId, status: 'active' },
      ].filter(q => q.userId || q.deviceId),
    });

    if (existingTrip) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active trip',
        tripId: existingTrip.tripId,
      });
    }

    // Generate unique trip ID
    const tripId = `trip_${Date.now()}_${uuidv4().slice(0, 8)}`;
    const startTime = new Date();

    // Create initial coordinates array
    const coordinates = [];
    if (initialCoordinate) {
      coordinates.push({
        latitude: initialCoordinate.latitude,
        longitude: initialCoordinate.longitude,
        altitude: initialCoordinate.altitude || 0,
        accuracy: initialCoordinate.accuracy || 0,
        speed: initialCoordinate.speed || 0,
        heading: initialCoordinate.heading || 0,
        timestamp: startTime,
      });
    }

    // Create tracking record
    const trackingRecord = new TrackingRecord({
      tripId,
      userId,
      deviceId: deviceId || null,
      name: name || `Trip ${new Date().toLocaleDateString()}`,
      startTime,
      status: 'active',
      coordinates,
      lastSyncAt: startTime,
      syncCount: initialCoordinate ? 1 : 0,
    });

    // Set initial location if available
    if (initialCoordinate) {
      trackingRecord.startLocation = {
        type: 'Point',
        coordinates: [initialCoordinate.longitude, initialCoordinate.latitude],
      };
    }

    await trackingRecord.save();

    return res.status(201).json({
      success: true,
      message: 'Trip started successfully',
      tripId,
      startTime,
    });

  } catch (error) {
    console.error('Error starting trip:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to start trip',
      error: error.message,
    });
  }
};

/**
 * Sync coordinates during active trip (batch upload)
 * POST /api/tracking/:tripId/sync
 */
export const syncCoordinates = async (req, res) => {
  try {
    const { tripId } = req.params;
    const { coordinates } = req.body;

    if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Coordinates array is required',
      });
    }

    // Find active trip
    const trip = await TrackingRecord.findOne({ tripId, status: 'active' });
    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Active trip not found',
      });
    }

    // Validate and format coordinates
    const validCoordinates = coordinates
      .filter(c => 
        typeof c.latitude === 'number' && 
        typeof c.longitude === 'number' &&
        !isNaN(c.latitude) && 
        !isNaN(c.longitude)
      )
      .map(c => ({
        latitude: c.latitude,
        longitude: c.longitude,
        altitude: c.altitude || 0,
        accuracy: c.accuracy || 0,
        speed: c.speed || 0,
        heading: c.heading || 0,
        timestamp: c.timestamp ? new Date(c.timestamp) : new Date(),
      }));

    if (validCoordinates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid coordinates provided',
      });
    }

    // Append coordinates
    trip.coordinates.push(...validCoordinates);
    trip.lastSyncAt = new Date();
    trip.syncCount += 1;

    await trip.save();

    return res.status(200).json({
      success: true,
      message: `Synced ${validCoordinates.length} coordinates`,
      totalPoints: trip.coordinates.length,
      syncCount: trip.syncCount,
    });

  } catch (error) {
    console.error('Error syncing coordinates:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to sync coordinates',
      error: error.message,
    });
  }
};

/**
 * End trip and calculate statistics
 * POST /api/tracking/:tripId/end
 */
export const endTrip = async (req, res) => {
  try {
    const { tripId } = req.params;
    const { finalCoordinates, name } = req.body;

    // Find active trip
    const trip = await TrackingRecord.findOne({ tripId, status: 'active' });
    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Active trip not found',
      });
    }

    // Add any final coordinates
    if (finalCoordinates && Array.isArray(finalCoordinates)) {
      const validCoords = finalCoordinates
        .filter(c => typeof c.latitude === 'number' && typeof c.longitude === 'number')
        .map(c => ({
          latitude: c.latitude,
          longitude: c.longitude,
          altitude: c.altitude || 0,
          accuracy: c.accuracy || 0,
          speed: c.speed || 0,
          heading: c.heading || 0,
          timestamp: c.timestamp ? new Date(c.timestamp) : new Date(),
        }));
      trip.coordinates.push(...validCoords);
    }

    // Update trip
    trip.status = 'completed';
    trip.endTime = new Date();
    if (name) trip.name = name;

    // Calculate statistics
    trip.calculateStats();

    await trip.save();

    return res.status(200).json({
      success: true,
      message: 'Trip completed successfully',
      trip: {
        tripId: trip.tripId,
        name: trip.name,
        startTime: trip.startTime,
        endTime: trip.endTime,
        duration: trip.duration,
        formattedDuration: trip.formattedDuration,
        totalDistance: trip.totalDistance,
        distanceKm: trip.distanceKm,
        avgSpeed: trip.avgSpeed,
        maxSpeed: trip.maxSpeed,
        pointCount: trip.coordinates.length,
      },
    });

  } catch (error) {
    console.error('Error ending trip:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to end trip',
      error: error.message,
    });
  }
};

/**
 * Cancel/delete an active trip
 * POST /api/tracking/:tripId/cancel
 */
export const cancelTrip = async (req, res) => {
  try {
    const { tripId } = req.params;

    const trip = await TrackingRecord.findOne({ tripId });
    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found',
      });
    }

    if (trip.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a completed trip',
      });
    }

    trip.status = 'cancelled';
    trip.endTime = new Date();
    await trip.save();

    return res.status(200).json({
      success: true,
      message: 'Trip cancelled',
    });

  } catch (error) {
    console.error('Error cancelling trip:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel trip',
      error: error.message,
    });
  }
};

/**
 * Get trip details including coordinates
 * GET /api/tracking/:tripId
 */
export const getTripDetails = async (req, res) => {
  try {
    const { tripId } = req.params;
    const { includeCoordinates = 'true' } = req.query;

    const projection = includeCoordinates === 'false' 
      ? { coordinates: 0 }
      : {};

    const trip = await TrackingRecord.findOne({ tripId }, projection)
      .populate('userId', 'name email')
      .populate('driverId', 'name email')
      .populate('tricycleId', 'plateNumber bodyNumber');

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found',
      });
    }

    return res.status(200).json({
      success: true,
      trip,
    });

  } catch (error) {
    console.error('Error getting trip details:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get trip details',
      error: error.message,
    });
  }
};

/**
 * Get trip history for user or device
 * GET /api/tracking/history
 */
export const getTripHistory = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { deviceId, page = 1, limit = 20, status } = req.query;

    if (!userId && !deviceId) {
      return res.status(400).json({
        success: false,
        message: 'User authentication or deviceId required',
      });
    }

    const query = {
      $or: [],
    };

    if (userId) query.$or.push({ userId });
    if (deviceId) query.$or.push({ deviceId });

    if (status) {
      query.status = status;
    } else {
      query.status = { $ne: 'cancelled' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [trips, total] = await Promise.all([
      TrackingRecord.find(query, { coordinates: 0 })
        .sort({ startTime: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      TrackingRecord.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      trips,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });

  } catch (error) {
    console.error('Error getting trip history:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get trip history',
      error: error.message,
    });
  }
};

/**
 * Get active trip for user or device
 * GET /api/tracking/active
 */
export const getActiveTrip = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { deviceId } = req.query;

    if (!userId && !deviceId) {
      return res.status(400).json({
        success: false,
        message: 'User authentication or deviceId required',
      });
    }

    const query = {
      status: 'active',
      $or: [],
    };

    if (userId) query.$or.push({ userId });
    if (deviceId) query.$or.push({ deviceId });

    const trip = await TrackingRecord.findOne(query);

    if (!trip) {
      return res.status(200).json({
        success: true,
        hasActiveTrip: false,
        trip: null,
      });
    }

    return res.status(200).json({
      success: true,
      hasActiveTrip: true,
      trip: {
        tripId: trip.tripId,
        name: trip.name,
        startTime: trip.startTime,
        pointCount: trip.coordinates.length,
        lastSyncAt: trip.lastSyncAt,
      },
    });

  } catch (error) {
    console.error('Error getting active trip:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get active trip',
      error: error.message,
    });
  }
};

/**
 * Export trip as GPX file and upload to Cloudinary
 * POST /api/tracking/:tripId/export-gpx
 */
export const exportGPX = async (req, res) => {
  try {
    const { tripId } = req.params;

    const trip = await TrackingRecord.findOne({ tripId });
    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found',
      });
    }

    if (trip.coordinates.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Trip has insufficient data for export',
      });
    }

    // Generate GPX content
    const gpxContent = generateGPX(trip);

    // Delete old file if exists
    if (trip.gpxPublicId) {
      try {
        await cloudinary.uploader.destroy(trip.gpxPublicId, { resource_type: 'raw' });
      } catch (e) {
        console.warn('Failed to delete old GPX:', e.message);
      }
    }

    // Upload to Cloudinary as raw file
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          public_id: `tracking/gpx/${tripId}`,
          format: 'gpx',
          folder: 'tricyclemod',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(Buffer.from(gpxContent));
    });

    // Update trip with GPX URL
    trip.gpxFileUrl = uploadResult.secure_url;
    trip.gpxPublicId = uploadResult.public_id;
    await trip.save();

    return res.status(200).json({
      success: true,
      message: 'GPX file exported successfully',
      gpxUrl: uploadResult.secure_url,
      fileName: `${tripId}.gpx`,
    });

  } catch (error) {
    console.error('Error exporting GPX:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to export GPX',
      error: error.message,
    });
  }
};

/**
 * Export trip as GeoJSON
 * GET /api/tracking/:tripId/geojson
 */
export const exportGeoJSON = async (req, res) => {
  try {
    const { tripId } = req.params;

    const trip = await TrackingRecord.findOne({ tripId });
    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found',
      });
    }

    if (trip.coordinates.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Trip has insufficient data for export',
      });
    }

    const geojson = generateGeoJSON(trip);

    return res.status(200).json({
      success: true,
      geojson,
    });

  } catch (error) {
    console.error('Error exporting GeoJSON:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to export GeoJSON',
      error: error.message,
    });
  }
};

/**
 * Delete a trip
 * DELETE /api/tracking/:tripId
 */
export const deleteTrip = async (req, res) => {
  try {
    const { tripId } = req.params;
    const userId = req.user?._id;

    const trip = await TrackingRecord.findOne({ tripId });
    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found',
      });
    }

    // Check ownership (if authenticated)
    if (userId && trip.userId && trip.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this trip',
      });
    }

    // Delete GPX from Cloudinary if exists
    if (trip.gpxPublicId) {
      try {
        await cloudinary.uploader.destroy(trip.gpxPublicId, { resource_type: 'raw' });
      } catch (e) {
        console.warn('Failed to delete GPX file:', e.message);
      }
    }

    await TrackingRecord.deleteOne({ tripId });

    return res.status(200).json({
      success: true,
      message: 'Trip deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting trip:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete trip',
      error: error.message,
    });
  }
};

/**
 * Get all online drivers with their last known locations (Admin only)
 * GET /api/tracking/active-drivers
 * Returns all online drivers (based on UserActivity) with their current GPS location
 * Location priority: UserActivity.currentLocation (from heartbeat) > TrackingRecord (from trip sync)
 */
export const getActiveDrivers = async (req, res) => {
  try {
    // First, mark inactive users as offline (users inactive for more than 2 minutes)
    await UserActivity.markInactiveUsersOffline(2 * 60 * 1000);

    // Find all online drivers from UserActivity
    const onlineActivities = await UserActivity.find({ isOnline: true })
      .populate({
        path: 'userId',
        match: { role: 'driver' }, // Only get drivers
        select: 'firstname lastname email phone image role rating tripCount',
      })
      .sort({ lastActiveAt: -1 });

    // Filter out activities where userId didn't match (non-drivers)
    const onlineDriverActivities = onlineActivities.filter(activity => activity.userId !== null);

    // Get user IDs of online drivers
    const onlineDriverIds = onlineDriverActivities.map(a => a.userId._id);

    // Find any tricycles associated with these drivers
    const tricycles = await Tricycle.find({ driver: { $in: onlineDriverIds } })
      .select('driver plateNumber bodyNumber')
      .lean();

    // Create tricycle lookup map
    const tricycleMap = {};
    tricycles.forEach(t => {
      tricycleMap[t.driver.toString()] = t;
    });

    // For each online driver, get their location
    const driversWithLocations = await Promise.all(
      onlineDriverActivities.map(async (activity) => {
        const driver = activity.userId;
        
        let currentLocation = null;
        let tripInfo = null;
        let locationSource = null;

        // PRIORITY 1: Use location from UserActivity heartbeat (most recent real-time location)
        if (activity.hasLocation && 
            activity.currentLocation?.latitude !== null && 
            activity.currentLocation?.longitude !== null) {
          currentLocation = {
            latitude: activity.currentLocation.latitude,
            longitude: activity.currentLocation.longitude,
            altitude: activity.currentLocation.altitude || 0,
            speed: activity.currentLocation.speed || 0,
            heading: activity.currentLocation.heading || 0,
            timestamp: activity.currentLocation.timestamp,
          };
          locationSource = 'heartbeat';
        }

        // PRIORITY 2: Fallback to TrackingRecord if no heartbeat location
        if (!currentLocation) {
          const latestTrack = await TrackingRecord.findOne({
            $or: [
              { userId: driver._id },
              { driverId: driver._id }
            ],
            'coordinates.0': { $exists: true }
          })
            .sort({ lastSyncAt: -1 })
            .select('tripId coordinates startTime lastSyncAt status')
            .lean();

          if (latestTrack && latestTrack.coordinates.length > 0) {
            const lastCoord = latestTrack.coordinates[latestTrack.coordinates.length - 1];
            currentLocation = {
              latitude: lastCoord.latitude,
              longitude: lastCoord.longitude,
              altitude: lastCoord.altitude || 0,
              speed: lastCoord.speed || 0,
              heading: lastCoord.heading || 0,
              timestamp: lastCoord.timestamp,
            };
            locationSource = 'tracking';
            tripInfo = {
              tripId: latestTrack.tripId,
              startTime: latestTrack.startTime,
              lastSyncAt: latestTrack.lastSyncAt,
              status: latestTrack.status,
              pointCount: latestTrack.coordinates.length,
            };
          }
        }

        // Get associated tricycle
        const tricycle = tricycleMap[driver._id.toString()];

        return {
          odriverId: driver._id,
          driver: {
            _id: driver._id,
            name: `${driver.firstname || ''} ${driver.lastname || ''}`.trim() || 'Unknown Driver',
            email: driver.email,
            phone: driver.phone,
            image: driver.image?.url || null,
            role: driver.role,
            rating: driver.rating,
            tripCount: driver.tripCount,
          },
          tricycle: tricycle ? {
            _id: tricycle._id,
            plateNumber: tricycle.plateNumber,
            bodyNumber: tricycle.bodyNumber,
          } : null,
          currentLocation,
          locationSource, // 'heartbeat' or 'tracking' - helps debug where location came from
          tripInfo,
          activity: {
            isOnline: activity.isOnline,
            lastSeen: activity.lastSeen,
            lastActiveAt: activity.lastActiveAt,
            platform: activity.deviceInfo?.platform || 'unknown',
          },
        };
      })
    );

    // Separate drivers with and without locations for better UI handling
    const driversWithLocation = driversWithLocations.filter(d => d.currentLocation !== null);
    const driversWithoutLocation = driversWithLocations.filter(d => d.currentLocation === null);

    return res.status(200).json({
      success: true,
      count: driversWithLocation.length,
      totalOnline: driversWithLocations.length,
      drivers: driversWithLocation,
      driversNoLocation: driversWithoutLocation,
      timestamp: new Date(),
    });

  } catch (error) {
    console.error('Error getting online drivers:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get online drivers',
      error: error.message,
    });
  }
};

/**
 * Export relive/route data as GPX without saving to database
 * POST /api/tracking/export-relive-gpx
 * Used for exporting current route data from driver's relive mode
 */
export const exportReliveGPX = async (req, res) => {
  try {
    const { gpxContent, deviceId, name } = req.body;

    if (!gpxContent) {
      return res.status(400).json({
        success: false,
        message: 'GPX content is required',
      });
    }

    // Generate a unique ID for this export
    const exportId = `relive_${Date.now()}_${uuidv4().slice(0, 8)}`;

    // Upload to Cloudinary as raw file
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          public_id: `tracking/relive/${exportId}`,
          format: 'gpx',
          folder: 'tricyclemod',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(Buffer.from(gpxContent));
    });

    return res.status(200).json({
      success: true,
      message: 'Relive GPX exported successfully',
      gpxUrl: uploadResult.secure_url,
      fileName: `${name || exportId}.gpx`,
    });

  } catch (error) {
    console.error('Error exporting relive GPX:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to export relive GPX',
      error: error.message,
    });
  }
};
