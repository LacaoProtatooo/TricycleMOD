import express from "express";
import { 
    createSickLeave, 
    getDriverSickLeaves, 
    getOperatorSickLeaves, 
    getSickLeaveById,
    approveSickLeave,
    rejectSickLeave,
    cancelSickLeave
} from "../controllers/sickLeaveController.js";
import { authUser } from "../middleware/authMiddleware.js";
import { operatorOnly } from "../middleware/operatorMiddleware.js";

const router = express.Router();

// Driver routes
router.post("/", authUser, createSickLeave);
router.get("/driver", authUser, getDriverSickLeaves);

// Operator routes (must come before /:id to avoid conflict)
router.get("/operator", authUser, operatorOnly, getOperatorSickLeaves);
router.patch("/:id/approve", authUser, operatorOnly, approveSickLeave);
router.patch("/:id/reject", authUser, operatorOnly, rejectSickLeave);

// Get specific sick leave by ID (driver can see own, operator can see only assigned drivers)
router.get("/:id", authUser, getSickLeaveById);

// Cancel must come after specific routes
router.patch("/:id/cancel", authUser, cancelSickLeave);

export default router;
