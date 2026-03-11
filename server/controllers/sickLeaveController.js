import SickLeave from "../models/sickLeaveModel.js";
import User from "../models/userModel.js";
import Tricycle from "../models/tricycleModel.js";
import cloudinary from "../utils/cloudinaryConfig.js";

// Create a new sick leave request
export const createSickLeave = async (req, res) => {
    try {
        const { startDate, endDate, reason, emergencyContact, medicalCertificateBase64 } = req.body;
        const driverId = req.user.id;

        // Check if driver has an assigned tricycle/operator
        const assignment = await Tricycle.findOne({ driver: driverId });
        if (!assignment) {
            return res.status(403).json({ 
                success: false, 
                message: "You cannot file a sick leave because you are not assigned to any tricycle/operator." 
            });
        }

        if (!startDate || !endDate || !reason) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }

        // Check for overlapping pending/approved sick leaves
        const overlapping = await SickLeave.findOne({
            driver: driverId,
            status: { $in: ['pending', 'approved'] },
            $or: [
                { startDate: { $lte: new Date(endDate) }, endDate: { $gte: new Date(startDate) } }
            ]
        });

        if (overlapping) {
            return res.status(400).json({ 
                success: false, 
                message: "You already have a sick leave request for overlapping dates." 
            });
        }

        // Upload medical certificate if provided
        let medicalCertificate = null;
        if (medicalCertificateBase64) {
            try {
                const uploadResult = await cloudinary.uploader.upload(medicalCertificateBase64, {
                    folder: 'medical_certificates',
                    resource_type: 'image',
                    transformation: [{ quality: 'auto:good' }]
                });
                medicalCertificate = {
                    url: uploadResult.secure_url,
                    publicId: uploadResult.public_id
                };
            } catch (uploadError) {
                console.error('Medical certificate upload failed:', uploadError.message);
            }
        }

        const newSickLeave = new SickLeave({
            driver: driverId,
            startDate,
            endDate,
            reason,
            emergencyContact: emergencyContact || null,
            medicalCertificate
        });

        await newSickLeave.save();

        res.status(201).json({ success: true, message: "Sick leave request submitted", data: newSickLeave });
    } catch (error) {
        console.error("Error creating sick leave:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// Get sick leaves for the current driver
export const getDriverSickLeaves = async (req, res) => {
    try {
        const driverId = req.user.id;
        
        // Check assignment status
        const assignment = await Tricycle.findOne({ driver: driverId });
        const hasAssignment = !!assignment;

        const sickLeaves = await SickLeave.find({ driver: driverId })
            .populate('reviewedBy', 'firstname lastname')
            .sort({ createdAt: -1 });
        
        // Calculate statistics
        const currentYear = new Date().getFullYear();
        const yearStart = new Date(currentYear, 0, 1);
        const yearEnd = new Date(currentYear, 11, 31);
        
        const approvedThisYear = await SickLeave.find({
            driver: driverId,
            status: 'approved',
            startDate: { $gte: yearStart, $lte: yearEnd }
        });
        
        const totalDaysUsed = approvedThisYear.reduce((sum, sl) => {
            const start = new Date(sl.startDate);
            const end = new Date(sl.endDate);
            const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            return sum + days;
        }, 0);

        const pendingCount = await SickLeave.countDocuments({ driver: driverId, status: 'pending' });
        
        res.status(200).json({ 
            success: true, 
            data: sickLeaves,
            hasAssignment,
            statistics: {
                totalDaysUsed,
                pendingRequests: pendingCount,
                approvedCount: approvedThisYear.length,
                year: currentYear
            }
        });
    } catch (error) {
        console.error("Error fetching driver sick leaves:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// Cancel a pending sick leave (driver only)
export const cancelSickLeave = async (req, res) => {
    try {
        const { id } = req.params;
        const driverId = req.user.id;

        const sickLeave = await SickLeave.findById(id);
        if (!sickLeave) {
            return res.status(404).json({ success: false, message: "Sick leave not found" });
        }

        if (sickLeave.driver.toString() !== driverId) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }

        if (sickLeave.status !== 'pending') {
            return res.status(400).json({ success: false, message: "Only pending requests can be cancelled" });
        }

        sickLeave.status = 'cancelled';
        await sickLeave.save();

        res.status(200).json({ success: true, message: "Sick leave cancelled", data: sickLeave });
    } catch (error) {
        console.error("Error cancelling sick leave:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// Get a specific sick leave by ID (operator can only view if driver is assigned to them)
export const getSickLeaveById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        const sickLeave = await SickLeave.findById(id)
            .populate('driver', 'firstname lastname username email phone image')
            .populate('reviewedBy', 'firstname lastname');

        if (!sickLeave) {
            return res.status(404).json({ success: false, message: "Sick leave not found" });
        }

        // If the user is the driver who filed the sick leave, allow access
        if (sickLeave.driver._id.toString() === userId) {
            return res.status(200).json({ success: true, data: sickLeave });
        }

        // If the user is an operator, check if the driver is assigned to them
        if (userRole === 'operator' || userRole === 'driOps') {
            const tricycles = await Tricycle.find({ operator: userId });
            const driverIds = new Set();
            tricycles.forEach(t => {
                if (t.driver) driverIds.add(t.driver.toString());
                if (t.schedules) {
                    t.schedules.forEach(s => {
                        if (s.driver) driverIds.add(s.driver.toString());
                    });
                }
            });

            if (!driverIds.has(sickLeave.driver._id.toString())) {
                return res.status(403).json({ 
                    success: false, 
                    message: "Not authorized to view this sick leave. This driver is not assigned to your tricycles." 
                });
            }

            return res.status(200).json({ success: true, data: sickLeave });
        }

        // If the user is an admin, allow access
        if (userRole === 'admin') {
            return res.status(200).json({ success: true, data: sickLeave });
        }

        // Otherwise, deny access
        return res.status(403).json({ success: false, message: "Not authorized to view this sick leave" });
    } catch (error) {
        console.error("Error fetching sick leave:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// Get sick leaves for the operator (all drivers assigned to operator's tricycles)
export const getOperatorSickLeaves = async (req, res) => {
    try {
        const operatorId = req.user.id;
        const { status, startDate, endDate } = req.query;

        // Find all tricycles owned by this operator
        const tricycles = await Tricycle.find({ operator: operatorId });
        
        // Get all driver IDs from these tricycles (both primary and scheduled)
        const driverIds = new Set();
        tricycles.forEach(t => {
            if (t.driver) driverIds.add(t.driver.toString());
            if (t.schedules) {
                t.schedules.forEach(s => {
                    if (s.driver) driverIds.add(s.driver.toString());
                });
            }
        });

        // Build filter
        const filter = { driver: { $in: Array.from(driverIds) } };
        if (status && status !== 'all') {
            filter.status = status;
        }
        if (startDate) {
            filter.startDate = { $gte: new Date(startDate) };
        }
        if (endDate) {
            filter.endDate = { ...filter.endDate, $lte: new Date(endDate) };
        }

        // Fetch sick leaves for these drivers
        const sickLeaves = await SickLeave.find(filter)
            .populate('driver', 'firstname lastname username email phone image')
            .populate('reviewedBy', 'firstname lastname')
            .sort({ createdAt: -1 });

        // Statistics for operator dashboard
        const allSickLeaves = await SickLeave.find({ driver: { $in: Array.from(driverIds) } });
        const stats = {
            total: allSickLeaves.length,
            pending: allSickLeaves.filter(s => s.status === 'pending').length,
            approved: allSickLeaves.filter(s => s.status === 'approved').length,
            rejected: allSickLeaves.filter(s => s.status === 'rejected').length,
            cancelled: allSickLeaves.filter(s => s.status === 'cancelled').length
        };

        res.status(200).json({ success: true, data: sickLeaves, statistics: stats });
    } catch (error) {
        console.error("Error fetching operator sick leaves:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// Operator approves a sick leave for a driver they manage
export const approveSickLeave = async (req, res) => {
    try {
        const { id } = req.params;
        const operatorId = req.user.id;

        const sickLeave = await SickLeave.findById(id);
        if (!sickLeave) {
            return res.status(404).json({ success: false, message: "Sick leave not found" });
        }

        // Ensure this operator manages the driver (owns a tricycle assigned to them)
        const tricycles = await Tricycle.find({ operator: operatorId });
        const driverIds = new Set();
        tricycles.forEach(t => {
            if (t.driver) driverIds.add(t.driver.toString());
            if (t.schedules) {
                t.schedules.forEach(s => {
                    if (s.driver) driverIds.add(s.driver.toString());
                });
            }
        });

        if (!driverIds.has(sickLeave.driver.toString())) {
            return res.status(403).json({ success: false, message: "Not authorized to approve this sick leave" });
        }

        if (sickLeave.status !== 'pending') {
            return res.status(400).json({ success: false, message: "Only pending requests can be approved" });
        }

        sickLeave.status = 'approved';
        sickLeave.reviewedBy = operatorId;
        sickLeave.reviewedAt = new Date();
        await sickLeave.save();

        // Populate for response
        await sickLeave.populate('driver', 'firstname lastname username email phone image');
        await sickLeave.populate('reviewedBy', 'firstname lastname');

        res.status(200).json({ success: true, message: "Sick leave approved", data: sickLeave });
    } catch (error) {
        console.error("Error approving sick leave:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// Operator rejects a sick leave with reason
export const rejectSickLeave = async (req, res) => {
    try {
        const { id } = req.params;
        const { rejectionReason } = req.body;
        const operatorId = req.user.id;

        if (!rejectionReason || !rejectionReason.trim()) {
            return res.status(400).json({ success: false, message: "Rejection reason is required" });
        }

        const sickLeave = await SickLeave.findById(id);
        if (!sickLeave) {
            return res.status(404).json({ success: false, message: "Sick leave not found" });
        }

        // Ensure this operator manages the driver
        const tricycles = await Tricycle.find({ operator: operatorId });
        const driverIds = new Set();
        tricycles.forEach(t => {
            if (t.driver) driverIds.add(t.driver.toString());
            if (t.schedules) {
                t.schedules.forEach(s => {
                    if (s.driver) driverIds.add(s.driver.toString());
                });
            }
        });

        if (!driverIds.has(sickLeave.driver.toString())) {
            return res.status(403).json({ success: false, message: "Not authorized to reject this sick leave" });
        }

        if (sickLeave.status !== 'pending') {
            return res.status(400).json({ success: false, message: "Only pending requests can be rejected" });
        }

        sickLeave.status = 'rejected';
        sickLeave.rejectionReason = rejectionReason;
        sickLeave.reviewedBy = operatorId;
        sickLeave.reviewedAt = new Date();
        await sickLeave.save();

        // Populate for response
        await sickLeave.populate('driver', 'firstname lastname username email phone image');
        await sickLeave.populate('reviewedBy', 'firstname lastname');

        res.status(200).json({ success: true, message: "Sick leave rejected", data: sickLeave });
    } catch (error) {
        console.error("Error rejecting sick leave:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};
