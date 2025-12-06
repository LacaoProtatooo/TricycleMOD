import SickLeave from "../models/sickLeaveModel.js";
import User from "../models/userModel.js";
import Tricycle from "../models/tricycleModel.js";

// Create a new sick leave request
export const createSickLeave = async (req, res) => {
    try {
        const { startDate, endDate, reason } = req.body;
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

        const newSickLeave = new SickLeave({
            driver: driverId,
            startDate,
            endDate,
            reason
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

        const sickLeaves = await SickLeave.find({ driver: driverId }).sort({ createdAt: -1 });
        
        res.status(200).json({ 
            success: true, 
            data: sickLeaves,
            hasAssignment 
        });
    } catch (error) {
        console.error("Error fetching driver sick leaves:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// Get sick leaves for the operator (all drivers assigned to operator's tricycles)
export const getOperatorSickLeaves = async (req, res) => {
    try {
        const operatorId = req.user.id;

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

        // Fetch sick leaves for these drivers
        const sickLeaves = await SickLeave.find({ driver: { $in: Array.from(driverIds) } })
            .populate('driver', 'firstname lastname username email phone image')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, data: sickLeaves });
    } catch (error) {
        console.error("Error fetching operator sick leaves:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};
