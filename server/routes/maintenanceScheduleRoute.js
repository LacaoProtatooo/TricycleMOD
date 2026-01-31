import express from "express";
import {
    // Config endpoints
    getMaintenanceConfig,
    
    // Schedule group management (admin)
    getScheduleGroups,
    createScheduleGroup,
    updateScheduleGroup,
    deleteScheduleGroup,
    addScheduleItem,
    removeScheduleItem,
    
    // Skip reason management (admin)
    getSkipReasons,
    createSkipReason,
    updateSkipReason,
    deleteSkipReason,
    
    // Completion status management (admin)
    getCompletionStatuses,
    createCompletionStatus,
    updateCompletionStatus,
    deleteCompletionStatus,
    
    // Maintenance logs
    recordMaintenance,
    getMaintenanceHistory,
    getMaintenanceStatus,
    
    // Skip records
    recordSkip,
    getPendingSkips,
    
    // Operator approval
    getPendingMaintenanceApprovals,
    approveMaintenanceRecord,
    rejectMaintenanceRecord,
    getMaintenanceApprovalHistory,
    getPendingApprovalCount,
    
    // Admin reset
    resetToDefaults
} from "../controllers/maintenanceScheduleController.js";
import { authUser, protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// ==================== PUBLIC CONFIG ENDPOINT ====================
// Mobile app fetches this to get schedule, skip reasons, and completion statuses
router.get("/config", authUser, getMaintenanceConfig);

// ==================== TRICYCLE-SPECIFIC MAINTENANCE ====================
// Record maintenance completion
router.post("/tricycle/:tricycleId/log", authUser, recordMaintenance);

// Get maintenance history for a tricycle
router.get("/tricycle/:tricycleId/history", authUser, getMaintenanceHistory);

// Get current maintenance status for all items
router.get("/tricycle/:tricycleId/status", authUser, getMaintenanceStatus);

// Record a skip/defer
router.post("/tricycle/:tricycleId/skip", authUser, recordSkip);

// Get pending skips for a tricycle
router.get("/tricycle/:tricycleId/skips", authUser, getPendingSkips);

// ==================== ADMIN: SCHEDULE GROUP MANAGEMENT ====================
router.get("/admin/groups", protect, authorize('admin'), getScheduleGroups);
router.post("/admin/groups", protect, authorize('admin'), createScheduleGroup);
router.put("/admin/groups/:id", protect, authorize('admin'), updateScheduleGroup);
router.delete("/admin/groups/:id", protect, authorize('admin'), deleteScheduleGroup);
router.post("/admin/groups/:groupId/items", protect, authorize('admin'), addScheduleItem);
router.delete("/admin/groups/:groupId/items/:itemKey", protect, authorize('admin'), removeScheduleItem);

// ==================== ADMIN: SKIP REASON MANAGEMENT ====================
router.get("/admin/skip-reasons", protect, authorize('admin'), getSkipReasons);
router.post("/admin/skip-reasons", protect, authorize('admin'), createSkipReason);
router.put("/admin/skip-reasons/:id", protect, authorize('admin'), updateSkipReason);
router.delete("/admin/skip-reasons/:id", protect, authorize('admin'), deleteSkipReason);

// ==================== ADMIN: COMPLETION STATUS MANAGEMENT ====================
router.get("/admin/completion-statuses", protect, authorize('admin'), getCompletionStatuses);
router.post("/admin/completion-statuses", protect, authorize('admin'), createCompletionStatus);
router.put("/admin/completion-statuses/:id", protect, authorize('admin'), updateCompletionStatus);
router.delete("/admin/completion-statuses/:id", protect, authorize('admin'), deleteCompletionStatus);

// ==================== OPERATOR: MAINTENANCE APPROVAL ====================
router.get("/operator/pending-approvals", authUser, getPendingMaintenanceApprovals);
router.get("/operator/pending-count", authUser, getPendingApprovalCount);
router.put("/operator/approve/:logId", authUser, approveMaintenanceRecord);
router.put("/operator/reject/:logId", authUser, rejectMaintenanceRecord);
router.get("/operator/approval-history", authUser, getMaintenanceApprovalHistory);

// ==================== ADMIN: RESET TO DEFAULTS ====================
router.post("/admin/reset", protect, authorize('admin'), resetToDefaults);

export default router;
