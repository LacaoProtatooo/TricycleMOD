import express from "express";
import upload from '../utils/multer.js';
import {
    getTricycles,
    getTricycle,
    createTricycle,
    updateTricycle,
    deleteTricycle,
    addMaintenanceLog,
    assignDriver,
    updateSchedule,
    updateOdometer
} from "../controllers/tricycleController.js";
import { authUser, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authUser, getTricycles);
router.get("/:id", authUser, getTricycle);
router.post("/", authUser, upload.array("images", 5), createTricycle);
router.put("/:id", authUser, upload.array("images", 5), updateTricycle);
router.delete("/:id", authUser, deleteTricycle);

// New routes
router.post("/:id/maintenance", authUser, addMaintenanceLog);
router.put("/:id/assign", authUser, assignDriver);
router.put("/:id/schedule", authUser, updateSchedule);
router.put("/:id/odometer", authUser, updateOdometer);

export default router;