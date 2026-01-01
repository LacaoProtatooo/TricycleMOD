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
    updateOdometer,
    scanCRDocument,
    scanORDocument,
    validateCRORDocuments,
    updateTricycleDocuments
} from "../controllers/tricycleController.js";
import { authUser, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// OCR Document scanning routes - MUST be before /:id routes to avoid matching "scan" as an ID
router.post("/scan/cr", authUser, upload.single("image"), scanCRDocument);
router.post("/scan/or", authUser, upload.single("image"), scanORDocument);
router.post("/validate-documents", authUser, validateCRORDocuments);

router.get("/", authUser, getTricycles);
router.get("/:id", authUser, getTricycle);
router.post("/", authUser, upload.array("images", 5), createTricycle);
router.put("/:id", authUser, upload.array("images", 5), updateTricycle);
router.delete("/:id", authUser, deleteTricycle);

// Maintenance and assignment routes
router.post("/:id/maintenance", authUser, addMaintenanceLog);
router.put("/:id/assign", authUser, assignDriver);
router.put("/:id/schedule", authUser, updateSchedule);
router.put("/:id/odometer", authUser, updateOdometer);
router.put("/:id/documents", authUser, upload.fields([
  { name: 'crImage', maxCount: 1 },
  { name: 'orImage', maxCount: 1 }
]), updateTricycleDocuments);

export default router;