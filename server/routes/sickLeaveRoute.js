import express from "express";
import { createSickLeave, getDriverSickLeaves, getOperatorSickLeaves } from "../controllers/sickLeaveController.js";
import { authUser } from "../middleware/authMiddleware.js";
import { operatorOnly } from "../middleware/operatorMiddleware.js";

const router = express.Router();

// Driver routes
router.post("/", authUser, createSickLeave);
router.get("/driver", authUser, getDriverSickLeaves);

// Operator routes
router.get("/operator", authUser, operatorOnly, getOperatorSickLeaves);

export default router;
