import { 
    MaintenanceScheduleGroup, 
    SkipReason, 
    CompletionStatus,
    MaintenanceLog,
    MaintenanceSkip 
} from "../models/maintenanceScheduleModel.js";
import Tricycle from "../models/tricycleModel.js";
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to save base64 image
const saveProofImage = async (base64Data, tricycleId, itemKey) => {
    try {
        if (!base64Data) return null;
        
        // Create uploads directory if it doesn't exist
        const uploadsDir = path.join(__dirname, '..', 'uploads', 'maintenance');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        // Generate unique filename
        const timestamp = Date.now();
        const filename = `${tricycleId}_${itemKey}_${timestamp}.jpg`;
        const filepath = path.join(uploadsDir, filename);
        
        // Save the image
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(filepath, buffer);
        
        // Return the relative URL path
        return `/uploads/maintenance/${filename}`;
    } catch (error) {
        console.error('Error saving proof image:', error);
        return null;
    }
};

// Default maintenance schedule data
const DEFAULT_SCHEDULE = [
    {
        groupId: 'weekly',
        title: 'Weekly (or every 300–500 km)',
        intervalKm: 500,
        baselineDays: 7,
        reminderLabel: 'Weekly',
        sortOrder: 1,
        items: [
            { key: 'tire_pressure', name: 'Tire pressure', notes: 'Recheck and inflate, check for uneven wear' },
            { key: 'chain', name: 'Chain', notes: 'Clean, lubricate, and adjust' },
            { key: 'battery_water', name: 'Battery water', notes: 'Top up with distilled water (non-MF)' },
            { key: 'air_filter_clean', name: 'Air filter (clean)', notes: 'Clean using compressed air' },
            { key: 'brake_check', name: 'Brake system', notes: 'Check pads/shoes for wear' },
            { key: 'cables', name: 'Cables', notes: 'Lubricate clutch/throttle cables' },
        ],
    },
    {
        groupId: '1000',
        title: 'Every 1,000 km (monthly heavy use)',
        intervalKm: 1000,
        baselineDays: 30,
        reminderLabel: 'Monthly',
        sortOrder: 2,
        items: [
            { key: 'engine_oil', name: 'Engine oil', notes: 'Replace (SAE 10W-40 or 20W-50)' },
            { key: 'spark_plug', name: 'Spark plug', notes: 'Inspect/clean or replace; gap 0.7–0.8 mm' },
            { key: 'carburetor', name: 'Carburetor', notes: 'Check idle & mixture' },
            { key: 'chain_sprockets', name: 'Chain & sprockets', notes: 'Inspect for wear' },
        ],
    },
    {
        groupId: '3000-5000',
        title: 'Every 3,000–5,000 km',
        intervalKm: 4000,
        baselineDays: 90,
        reminderLabel: 'Quarterly',
        sortOrder: 3,
        items: [
            { key: 'oil_filter', name: 'Oil filter', notes: 'Replace if equipped' },
            { key: 'air_filter_replace', name: 'Air filter (replace)', notes: 'Replace if dusty/oily' },
            { key: 'valve_clearance', name: 'Valve clearance', notes: 'Adjust per spec' },
            { key: 'battery_test', name: 'Battery', notes: 'Test voltage; replace if weak' },
        ],
    },
    {
        groupId: '10000',
        title: 'Every 10,000–12,000 km (or annually)',
        intervalKm: 11000,
        baselineDays: 365,
        reminderLabel: 'Annual',
        sortOrder: 4,
        items: [
            { key: 'brake_fluid_flush', name: 'Brake fluid (flush)', notes: 'Flush & replace' },
            { key: 'clutch_plates', name: 'Clutch plates', notes: 'Inspect & replace if slipping' },
            { key: 'suspension', name: 'Suspension', notes: 'Inspect fork oil & shocks' },
        ],
    },
    {
        groupId: '20000',
        title: 'Major service — Every 20,000 km',
        intervalKm: 20000,
        baselineDays: 730,
        reminderLabel: 'Bi-Annual',
        sortOrder: 5,
        items: [
            { key: 'engine_overhaul', name: 'Engine overhaul', notes: 'Check rings, valves, gaskets' },
            { key: 'transmission_oil', name: 'Transmission oil', notes: 'Replace if applicable' },
            { key: 'wiring_harness', name: 'Wiring harness', notes: 'Replace brittle wiring' },
        ],
    },
];

// Default skip reasons
const DEFAULT_SKIP_REASONS = [
    { reasonId: 'no_funds', label: 'Insufficient funds', icon: 'wallet-outline', sortOrder: 1 },
    { reasonId: 'no_time', label: 'No time available', icon: 'time-outline', sortOrder: 2 },
    { reasonId: 'parts_unavailable', label: 'Parts not available', icon: 'construct-outline', sortOrder: 3 },
    { reasonId: 'shop_closed', label: 'Repair shop closed', icon: 'business-outline', sortOrder: 4 },
    { reasonId: 'scheduled_later', label: 'Scheduled for later', icon: 'calendar-outline', sortOrder: 5 },
    { reasonId: 'other', label: 'Other reason', icon: 'ellipsis-horizontal-outline', sortOrder: 6 },
];

// Default completion statuses
const DEFAULT_COMPLETION_STATUSES = [
    { statusId: 'completed', label: 'Completed', icon: 'checkmark-circle', sortOrder: 1 },
    { statusId: 'replaced', label: 'Replaced', icon: 'swap-horizontal', sortOrder: 2 },
    { statusId: 'repaired', label: 'Repaired', icon: 'build', sortOrder: 3 },
    { statusId: 'adjusted', label: 'Adjusted', icon: 'options', sortOrder: 4 },
    { statusId: 'inspected', label: 'Inspected', icon: 'eye', sortOrder: 5 },
];

// ==================== SCHEDULE CONFIG ENDPOINTS ====================

// Get all maintenance schedule config (for mobile app)
export const getMaintenanceConfig = async (req, res) => {
    try {
        // Get schedule groups
        let scheduleGroups = await MaintenanceScheduleGroup.find({ isActive: true })
            .sort({ sortOrder: 1 })
            .lean();
        
        // If no groups exist, seed with defaults
        if (scheduleGroups.length === 0) {
            await MaintenanceScheduleGroup.insertMany(DEFAULT_SCHEDULE);
            scheduleGroups = await MaintenanceScheduleGroup.find({ isActive: true })
                .sort({ sortOrder: 1 })
                .lean();
        }

        // Get skip reasons
        let skipReasons = await SkipReason.find({ isActive: true })
            .sort({ sortOrder: 1 })
            .lean();
        
        // If no skip reasons exist, seed with defaults
        if (skipReasons.length === 0) {
            await SkipReason.insertMany(DEFAULT_SKIP_REASONS);
            skipReasons = await SkipReason.find({ isActive: true })
                .sort({ sortOrder: 1 })
                .lean();
        }

        // Get completion statuses
        let completionStatuses = await CompletionStatus.find({ isActive: true })
            .sort({ sortOrder: 1 })
            .lean();
        
        // If no completion statuses exist, seed with defaults
        if (completionStatuses.length === 0) {
            await CompletionStatus.insertMany(DEFAULT_COMPLETION_STATUSES);
            completionStatuses = await CompletionStatus.find({ isActive: true })
                .sort({ sortOrder: 1 })
                .lean();
        }

        // Transform for mobile app compatibility
        const schedule = scheduleGroups.map(g => ({
            id: g.groupId,
            title: g.title,
            intervalKm: g.intervalKm,
            baselineDays: g.baselineDays,
            reminderLabel: g.reminderLabel,
            items: g.items,
        }));

        const skipReasonOptions = skipReasons.map(r => ({
            id: r.reasonId,
            label: r.label,
            icon: r.icon,
        }));

        const completionStatusOptions = completionStatuses.map(s => ({
            id: s.statusId,
            label: s.label,
            icon: s.icon,
        }));

        res.status(200).json({
            success: true,
            data: {
                schedule,
                skipReasonOptions,
                completionStatusOptions,
            }
        });
    } catch (error) {
        console.error('getMaintenanceConfig error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch maintenance configuration',
            error: error.message
        });
    }
};

// ==================== ADMIN SCHEDULE MANAGEMENT ====================

// Get all schedule groups (admin)
export const getScheduleGroups = async (req, res) => {
    try {
        const groups = await MaintenanceScheduleGroup.find()
            .sort({ sortOrder: 1 });
        
        res.status(200).json({
            success: true,
            data: groups
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch schedule groups',
            error: error.message
        });
    }
};

// Create schedule group (admin)
export const createScheduleGroup = async (req, res) => {
    try {
        const { groupId, title, intervalKm, baselineDays, reminderLabel, items } = req.body;
        
        const existing = await MaintenanceScheduleGroup.findOne({ groupId });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'A schedule group with this ID already exists'
            });
        }

        const maxOrder = await MaintenanceScheduleGroup.findOne().sort({ sortOrder: -1 });
        const sortOrder = maxOrder ? maxOrder.sortOrder + 1 : 1;

        const group = await MaintenanceScheduleGroup.create({
            groupId,
            title,
            intervalKm,
            baselineDays,
            reminderLabel,
            items: items || [],
            sortOrder
        });

        res.status(201).json({
            success: true,
            message: 'Schedule group created successfully',
            data: group
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to create schedule group',
            error: error.message
        });
    }
};

// Update schedule group (admin)
export const updateScheduleGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        const group = await MaintenanceScheduleGroup.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Schedule group not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Schedule group updated successfully',
            data: group
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to update schedule group',
            error: error.message
        });
    }
};

// Delete schedule group (admin)
export const deleteScheduleGroup = async (req, res) => {
    try {
        const { id } = req.params;
        
        const group = await MaintenanceScheduleGroup.findByIdAndDelete(id);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Schedule group not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Schedule group deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to delete schedule group',
            error: error.message
        });
    }
};

// Add item to schedule group (admin)
export const addScheduleItem = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { key, name, notes } = req.body;

        const group = await MaintenanceScheduleGroup.findById(groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Schedule group not found'
            });
        }

        // Check if item key already exists
        const existingItem = group.items.find(i => i.key === key);
        if (existingItem) {
            return res.status(400).json({
                success: false,
                message: 'An item with this key already exists in this group'
            });
        }

        group.items.push({ key, name, notes });
        await group.save();

        res.status(201).json({
            success: true,
            message: 'Item added successfully',
            data: group
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to add item',
            error: error.message
        });
    }
};

// Remove item from schedule group (admin)
export const removeScheduleItem = async (req, res) => {
    try {
        const { groupId, itemKey } = req.params;

        const group = await MaintenanceScheduleGroup.findById(groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Schedule group not found'
            });
        }

        group.items = group.items.filter(i => i.key !== itemKey);
        await group.save();

        res.status(200).json({
            success: true,
            message: 'Item removed successfully',
            data: group
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to remove item',
            error: error.message
        });
    }
};

// ==================== SKIP REASON MANAGEMENT (ADMIN) ====================

export const getSkipReasons = async (req, res) => {
    try {
        const reasons = await SkipReason.find().sort({ sortOrder: 1 });
        res.status(200).json({ success: true, data: reasons });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const createSkipReason = async (req, res) => {
    try {
        const { reasonId, label, icon } = req.body;
        
        const existing = await SkipReason.findOne({ reasonId });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'A skip reason with this ID already exists'
            });
        }

        const maxOrder = await SkipReason.findOne().sort({ sortOrder: -1 });
        const sortOrder = maxOrder ? maxOrder.sortOrder + 1 : 1;

        const reason = await SkipReason.create({ reasonId, label, icon, sortOrder });
        res.status(201).json({ success: true, data: reason });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateSkipReason = async (req, res) => {
    try {
        const { id } = req.params;
        const reason = await SkipReason.findByIdAndUpdate(id, req.body, { new: true });
        if (!reason) {
            return res.status(404).json({ success: false, message: 'Skip reason not found' });
        }
        res.status(200).json({ success: true, data: reason });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteSkipReason = async (req, res) => {
    try {
        const { id } = req.params;
        const reason = await SkipReason.findByIdAndDelete(id);
        if (!reason) {
            return res.status(404).json({ success: false, message: 'Skip reason not found' });
        }
        res.status(200).json({ success: true, message: 'Skip reason deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ==================== COMPLETION STATUS MANAGEMENT (ADMIN) ====================

export const getCompletionStatuses = async (req, res) => {
    try {
        const statuses = await CompletionStatus.find().sort({ sortOrder: 1 });
        res.status(200).json({ success: true, data: statuses });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const createCompletionStatus = async (req, res) => {
    try {
        const { statusId, label, icon } = req.body;
        
        const existing = await CompletionStatus.findOne({ statusId });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'A completion status with this ID already exists'
            });
        }

        const maxOrder = await CompletionStatus.findOne().sort({ sortOrder: -1 });
        const sortOrder = maxOrder ? maxOrder.sortOrder + 1 : 1;

        const status = await CompletionStatus.create({ statusId, label, icon, sortOrder });
        res.status(201).json({ success: true, data: status });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateCompletionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const status = await CompletionStatus.findByIdAndUpdate(id, req.body, { new: true });
        if (!status) {
            return res.status(404).json({ success: false, message: 'Completion status not found' });
        }
        res.status(200).json({ success: true, data: status });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteCompletionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const status = await CompletionStatus.findByIdAndDelete(id);
        if (!status) {
            return res.status(404).json({ success: false, message: 'Completion status not found' });
        }
        res.status(200).json({ success: true, message: 'Completion status deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ==================== MAINTENANCE LOGS ====================

// Record maintenance completion
export const recordMaintenance = async (req, res) => {
    try {
        const { tricycleId } = req.params;
        const { itemKey, lastServiceKm, status, reading, notes, cost, completedAt, proofImage } = req.body;
        const userId = req.user?._id;
        const userRole = req.user?.role;

        // Verify tricycle exists
        const tricycle = await Tricycle.findById(tricycleId);
        if (!tricycle) {
            return res.status(404).json({
                success: false,
                message: 'Tricycle not found'
            });
        }

        // Save proof image if provided
        let proofImageUrl = null;
        if (proofImage && proofImage.base64) {
            proofImageUrl = await saveProofImage(proofImage.base64, tricycleId, itemKey);
        }

        // Determine approval status based on who submits
        // Operators can directly approve, drivers need operator approval
        const isOperator = userRole === 'operator';
        const approvalStatus = isOperator ? 'approved' : 'pending';
        const submittedByRole = isOperator ? 'operator' : 'driver';

        // Create maintenance log with approval status
        const log = await MaintenanceLog.create({
            tricycleId,
            itemKey,
            lastServiceKm,
            status: status || 'completed',
            reading,
            notes,
            cost,
            proofImageUrl,
            completedAt: completedAt || new Date(),
            completedBy: userId,
            approvalStatus,
            submittedByRole,
            // Auto-approve if submitted by operator
            approvedBy: isOperator ? userId : undefined,
            approvedAt: isOperator ? new Date() : undefined
        });

        // Only update tricycle odometer if approved
        if (approvalStatus === 'approved' && lastServiceKm > tricycle.currentOdometer) {
            tricycle.currentOdometer = lastServiceKm;
            await tricycle.save();
        }

        // Only resolve skip records if approved
        if (approvalStatus === 'approved') {
            await MaintenanceSkip.updateMany(
                { tricycleId, itemKey, isResolved: false },
                { isResolved: true, resolvedAt: new Date() }
            );
        }

        res.status(201).json({
            success: true,
            message: approvalStatus === 'approved' 
                ? 'Maintenance recorded and approved' 
                : 'Maintenance recorded and pending operator approval',
            data: log,
            approvalStatus
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to record maintenance',
            error: error.message
        });
    }
};

// Get maintenance history for a tricycle
export const getMaintenanceHistory = async (req, res) => {
    try {
        const { tricycleId } = req.params;
        const { limit = 50, itemKey } = req.query;

        const query = { tricycleId };
        if (itemKey) query.itemKey = itemKey;

        const logs = await MaintenanceLog.find(query)
            .sort({ completedAt: -1 })
            .limit(parseInt(limit))
            .populate('completedBy', 'firstName lastName')
            .lean();

        res.status(200).json({
            success: true,
            data: logs
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch maintenance history',
            error: error.message
        });
    }
};

// Get latest maintenance status for all items (for a tricycle)
export const getMaintenanceStatus = async (req, res) => {
    try {
        const { tricycleId } = req.params;

        // Get the latest APPROVED log for each item
        const latestLogs = await MaintenanceLog.aggregate([
            { 
                $match: { 
                    tricycleId: new mongoose.Types.ObjectId(tricycleId),
                    $or: [
                        { approvalStatus: 'approved' },
                        { approvalStatus: { $exists: false } } // Legacy records without status field
                    ]
                } 
            },
            { $sort: { completedAt: -1 } },
            {
                $group: {
                    _id: '$itemKey',
                    lastServiceKm: { $first: '$lastServiceKm' },
                    lastServiceDate: { $first: '$completedAt' },
                    status: { $first: '$status' },
                    reading: { $first: '$reading' },
                    notes: { $first: '$notes' },
                    cost: { $first: '$cost' }
                }
            }
        ]);

        // Convert to map format
        const statusMap = {};
        latestLogs.forEach(log => {
            statusMap[log._id] = {
                lastServiceKm: log.lastServiceKm,
                lastServiceDate: log.lastServiceDate,
                status: log.status,
                reading: log.reading,
                notes: log.notes,
                cost: log.cost
            };
        });

        res.status(200).json({
            success: true,
            data: statusMap
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch maintenance status',
            error: error.message
        });
    }
};

// ==================== SKIP/DEFER RECORDS ====================

// Record a maintenance skip/defer
export const recordSkip = async (req, res) => {
    try {
        const { tricycleId } = req.params;
        const { itemKey, reasonId, reason, daysOverdue, kmOverdue } = req.body;
        const userId = req.user?._id;

        const skip = await MaintenanceSkip.create({
            tricycleId,
            itemKey,
            reasonId,
            reason,
            daysOverdue,
            kmOverdue,
            skippedBy: userId
        });

        res.status(201).json({
            success: true,
            message: 'Skip recorded successfully',
            data: skip
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to record skip',
            error: error.message
        });
    }
};

// Get pending skips for a tricycle
export const getPendingSkips = async (req, res) => {
    try {
        const { tricycleId } = req.params;

        const skips = await MaintenanceSkip.find({
            tricycleId,
            isResolved: false
        })
            .sort({ skippedAt: -1 })
            .populate('skippedBy', 'firstName lastName')
            .lean();

        // Convert to map format for easy lookup
        const skipMap = {};
        skips.forEach(skip => {
            skipMap[skip.itemKey] = {
                reasonId: skip.reasonId,
                reason: skip.reason,
                date: skip.skippedAt,
                daysOverdue: skip.daysOverdue,
                kmOverdue: skip.kmOverdue
            };
        });

        res.status(200).json({
            success: true,
            data: skipMap
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pending skips',
            error: error.message
        });
    }
};

// ==================== MAINTENANCE APPROVAL (OPERATOR) ====================

// Get pending maintenance records for operator approval
export const getPendingMaintenanceApprovals = async (req, res) => {
    try {
        const operatorId = req.user._id;

        // Get tricycles assigned to this operator (field is 'operator', not 'operatorId')
        const tricycles = await Tricycle.find({ operator: operatorId }).select('_id plateNumber').lean();
        const tricycleIds = tricycles.map(t => t._id);
        
        // Create a map for quick plate number lookup
        const plateMap = {};
        tricycles.forEach(t => { plateMap[t._id.toString()] = t.plateNumber; });

        // Get pending maintenance logs for these tricycles
        const pendingLogs = await MaintenanceLog.find({
            tricycleId: { $in: tricycleIds },
            approvalStatus: 'pending'
        })
            .sort({ createdAt: -1 })
            .populate('completedBy', 'firstName lastName')
            .populate('tricycleId', 'plateNumber')
            .lean();

        // Enrich with item names from schedule
        const scheduleGroups = await MaintenanceScheduleGroup.find({ isActive: true }).lean();
        const itemNameMap = {};
        scheduleGroups.forEach(g => {
            g.items.forEach(i => {
                itemNameMap[i.key] = { name: i.name, group: g.title };
            });
        });

        const enrichedLogs = pendingLogs.map(log => ({
            ...log,
            itemName: itemNameMap[log.itemKey]?.name || log.itemKey.replace(/_/g, ' '),
            groupName: itemNameMap[log.itemKey]?.group || 'Other',
            plateNumber: log.tricycleId?.plateNumber || plateMap[log.tricycleId?.toString()] || 'Unknown'
        }));

        res.status(200).json({
            success: true,
            data: enrichedLogs,
            count: enrichedLogs.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pending approvals',
            error: error.message
        });
    }
};

// Approve a maintenance record
export const approveMaintenanceRecord = async (req, res) => {
    try {
        const { logId } = req.params;
        const operatorId = req.user._id;

        const log = await MaintenanceLog.findById(logId);
        if (!log) {
            return res.status(404).json({
                success: false,
                message: 'Maintenance record not found'
            });
        }

        if (log.approvalStatus !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Record already ${log.approvalStatus}`
            });
        }

        // Verify operator owns this tricycle
        const tricycle = await Tricycle.findById(log.tricycleId);
        if (!tricycle || tricycle.operator?.toString() !== operatorId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to approve this maintenance record'
            });
        }

        // Approve the record
        log.approvalStatus = 'approved';
        log.approvedBy = operatorId;
        log.approvedAt = new Date();
        await log.save();

        // Update tricycle odometer if needed
        if (log.lastServiceKm > tricycle.currentOdometer) {
            tricycle.currentOdometer = log.lastServiceKm;
            await tricycle.save();
        }

        // Resolve any pending skip records
        await MaintenanceSkip.updateMany(
            { tricycleId: log.tricycleId, itemKey: log.itemKey, isResolved: false },
            { isResolved: true, resolvedAt: new Date() }
        );

        res.status(200).json({
            success: true,
            message: 'Maintenance record approved',
            data: log
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to approve maintenance record',
            error: error.message
        });
    }
};

// Reject a maintenance record
export const rejectMaintenanceRecord = async (req, res) => {
    try {
        const { logId } = req.params;
        const { reason } = req.body;
        const operatorId = req.user._id;

        const log = await MaintenanceLog.findById(logId);
        if (!log) {
            return res.status(404).json({
                success: false,
                message: 'Maintenance record not found'
            });
        }

        if (log.approvalStatus !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Record already ${log.approvalStatus}`
            });
        }

        // Verify operator owns this tricycle
        const tricycle = await Tricycle.findById(log.tricycleId);
        if (!tricycle || tricycle.operator?.toString() !== operatorId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to reject this maintenance record'
            });
        }

        // Reject the record
        log.approvalStatus = 'rejected';
        log.approvedBy = operatorId;
        log.approvedAt = new Date();
        log.rejectionReason = reason || 'No reason provided';
        await log.save();

        res.status(200).json({
            success: true,
            message: 'Maintenance record rejected',
            data: log
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to reject maintenance record',
            error: error.message
        });
    }
};

// Get approval history for operator
export const getMaintenanceApprovalHistory = async (req, res) => {
    try {
        const operatorId = req.user._id;
        const { limit = 50 } = req.query;

        // Get tricycles assigned to this operator
        const tricycles = await Tricycle.find({ operator: operatorId }).select('_id').lean();
        const tricycleIds = tricycles.map(t => t._id);

        // Get all approved/rejected logs
        const logs = await MaintenanceLog.find({
            tricycleId: { $in: tricycleIds },
            approvalStatus: { $in: ['approved', 'rejected'] }
        })
            .sort({ approvedAt: -1 })
            .limit(parseInt(limit))
            .populate('completedBy', 'firstName lastName')
            .populate('tricycleId', 'plateNumber')
            .lean();

        res.status(200).json({
            success: true,
            data: logs
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch approval history',
            error: error.message
        });
    }
};

// Get pending approval count for operator (for badge)
export const getPendingApprovalCount = async (req, res) => {
    try {
        const operatorId = req.user._id;

        // Get tricycles assigned to this operator
        const tricycles = await Tricycle.find({ operator: operatorId }).select('_id').lean();
        const tricycleIds = tricycles.map(t => t._id);

        const count = await MaintenanceLog.countDocuments({
            tricycleId: { $in: tricycleIds },
            approvalStatus: 'pending'
        });

        res.status(200).json({
            success: true,
            count
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pending count',
            error: error.message
        });
    }
};

// ==================== SEED/RESET (ADMIN) ====================

// Reset to default configuration
export const resetToDefaults = async (req, res) => {
    try {
        // Clear existing
        await MaintenanceScheduleGroup.deleteMany({});
        await SkipReason.deleteMany({});
        await CompletionStatus.deleteMany({});

        // Insert defaults
        await MaintenanceScheduleGroup.insertMany(DEFAULT_SCHEDULE);
        await SkipReason.insertMany(DEFAULT_SKIP_REASONS);
        await CompletionStatus.insertMany(DEFAULT_COMPLETION_STATUSES);

        res.status(200).json({
            success: true,
            message: 'Configuration reset to defaults'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to reset configuration',
            error: error.message
        });
    }
};

// Import mongoose for ObjectId in aggregation
import mongoose from 'mongoose';
