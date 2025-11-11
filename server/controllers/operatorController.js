import Tricycle from '../models/tricycleModel.js';
import User from '../models/userModel.js';

// ==================== GET OPERATOR OVERVIEW ====================
// Get all tricycles and drivers for the logged-in operator
export const getOperatorOverview = async (req, res) => {
  try {
    const operatorId = req.user.id;

    // User is already verified as operator by middleware

    // Get all tricycles owned by this operator
    const tricycles = await Tricycle.find({ operator: operatorId })
      .populate('driver', 'firstname lastname username email phone image')
      .populate('operator', 'firstname lastname username email')
      .sort({ createdAt: -1 });

    // Get all available drivers (drivers not assigned to any tricycle)
    const assignedDriverIds = tricycles
      .map((t) => t.driver)
      .filter((driver) => driver !== null && driver !== undefined)
      .map((driver) => (driver._id ? driver._id.toString() : driver.toString()));

    const availableDrivers = await User.find({
      role: 'driver',
      _id: { $nin: assignedDriverIds },
    }).select('firstname lastname username email phone image rating numReviews');

    // Get all drivers (for reference)
    const allDrivers = await User.find({ role: 'driver' }).select(
      'firstname lastname username email phone image rating numReviews'
    );

    // Format tricycles with driver info
    const formattedTricycles = tricycles.map((tricycle) => ({
      id: tricycle._id,
      plate: tricycle.plateNumber,
      model: tricycle.model,
      driverId: tricycle.driver?._id || null,
      driverName: tricycle.driver
        ? `${tricycle.driver.firstname} ${tricycle.driver.lastname}`
        : 'Unassigned',
      driver: tricycle.driver || null,
      status: tricycle.status,
      images: tricycle.images || [],
      createdAt: tricycle.createdAt,
      updatedAt: tricycle.updatedAt,
    }));

    res.status(200).json({
      success: true,
      tricycles: formattedTricycles,
      availableDrivers,
      allDrivers,
      drivers: allDrivers, // For backward compatibility
    });
  } catch (error) {
    console.error('Error fetching operator overview:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message,
    });
  }
};

// ==================== GET OPERATOR'S TRICYCLES ====================
export const getOperatorTricycles = async (req, res) => {
  try {
    const operatorId = req.user.id;

    // User is already verified as operator by middleware
    const tricycles = await Tricycle.find({ operator: operatorId })
      .populate('driver', 'firstname lastname username email phone image')
      .populate('operator', 'firstname lastname username email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: tricycles.length,
      data: tricycles,
    });
  } catch (error) {
    console.error('Error fetching operator tricycles:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server Error',
    });
  }
};

// ==================== GET AVAILABLE DRIVERS ====================
export const getAvailableDrivers = async (req, res) => {
  try {
    const operatorId = req.user.id;

    // User is already verified as operator by middleware
    // Get all tricycles to find assigned drivers
    const allTricycles = await Tricycle.find({});
    const assignedDriverIds = allTricycles
      .map((t) => t.driver)
      .filter((driver) => driver !== null && driver !== undefined)
      .map((driver) => (driver._id ? driver._id.toString() : driver.toString()));

    // Get drivers not assigned to any tricycle
    const availableDrivers = await User.find({
      role: 'driver',
      _id: { $nin: assignedDriverIds },
    }).select('firstname lastname username email phone image rating numReviews');

    res.status(200).json({
      success: true,
      count: availableDrivers.length,
      data: availableDrivers,
    });
  } catch (error) {
    console.error('Error fetching available drivers:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server Error',
    });
  }
};

// ==================== ASSIGN DRIVER TO TRICYCLE ====================
export const assignDriverToTricycle = async (req, res) => {
  try {
    const operatorId = req.user.id;
    const { tricycleId, driverId } = req.body;

    // User is already verified as operator by middleware
    if (!tricycleId || !driverId) {
      return res.status(400).json({
        success: false,
        message: 'Tricycle ID and Driver ID are required',
      });
    }

    // Verify tricycle exists and belongs to operator
    const tricycle = await Tricycle.findById(tricycleId);
    if (!tricycle) {
      return res.status(404).json({
        success: false,
        message: 'Tricycle not found',
      });
    }

    if (tricycle.operator.toString() !== operatorId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only assign drivers to your own tricycles',
      });
    }

    // Verify driver exists and is a driver
    const driver = await User.findById(driverId);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found',
      });
    }

    if (driver.role !== 'driver') {
      return res.status(400).json({
        success: false,
        message: 'User is not a driver',
      });
    }

    // Check if driver is already assigned to another tricycle
    const existingAssignment = await Tricycle.findOne({
      driver: driverId,
      _id: { $ne: tricycleId },
    });

    if (existingAssignment) {
      return res.status(400).json({
        success: false,
        message: 'Driver is already assigned to another tricycle',
      });
    }

    // Assign driver to tricycle
    tricycle.driver = driverId;
    await tricycle.save();

    // Populate and return updated tricycle
    const updatedTricycle = await Tricycle.findById(tricycleId)
      .populate('driver', 'firstname lastname username email phone image')
      .populate('operator', 'firstname lastname username email');

    res.status(200).json({
      success: true,
      message: 'Driver assigned successfully',
      data: updatedTricycle,
    });
  } catch (error) {
    console.error('Error assigning driver:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message,
    });
  }
};

// ==================== UNASSIGN DRIVER FROM TRICYCLE ====================
export const unassignDriverFromTricycle = async (req, res) => {
  try {
    const operatorId = req.user.id;
    const { tricycleId } = req.body;

    // User is already verified as operator by middleware
    if (!tricycleId) {
      return res.status(400).json({
        success: false,
        message: 'Tricycle ID is required',
      });
    }

    // Verify tricycle exists and belongs to operator
    const tricycle = await Tricycle.findById(tricycleId);
    if (!tricycle) {
      return res.status(404).json({
        success: false,
        message: 'Tricycle not found',
      });
    }

    if (tricycle.operator.toString() !== operatorId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only unassign drivers from your own tricycles',
      });
    }

    // Unassign driver
    tricycle.driver = null;
    await tricycle.save();

    // Populate and return updated tricycle
    const updatedTricycle = await Tricycle.findById(tricycleId)
      .populate('operator', 'firstname lastname username email');

    res.status(200).json({
      success: true,
      message: 'Driver unassigned successfully',
      data: updatedTricycle,
    });
  } catch (error) {
    console.error('Error unassigning driver:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message,
    });
  }
};

// ==================== GET DRIVER DETAILS ====================
export const getDriverDetails = async (req, res) => {
  try {
    const operatorId = req.user.id;
    const { driverId } = req.params;

    // User is already verified as operator by middleware
    const driver = await User.findById(driverId).select('-password');
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found',
      });
    }

    if (driver.role !== 'driver') {
      return res.status(400).json({
        success: false,
        message: 'User is not a driver',
      });
    }

    // Get tricycle assigned to this driver (if any)
    const tricycle = await Tricycle.findOne({ driver: driverId })
      .populate('operator', 'firstname lastname username email');

    res.status(200).json({
      success: true,
      driver,
      tricycle: tricycle || null,
    });
  } catch (error) {
    console.error('Error fetching driver details:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server Error',
    });
  }
};

