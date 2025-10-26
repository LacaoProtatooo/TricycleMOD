import express from "express";
import upload from "../utils/multer";
import {
    getTricycles,
    getTricycle,
    createTricycle,
    updateTricycle,
    deleteTricycle,
} from "../controllers/tricycleController.js";
import { authUser, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authUser, getTricycles);
router.get("/:id", authUser, getTricycle);
router.post("/", authUser, upload.array("images", 5), createTricycle);
router.put("/:id", authUser, upload.array("images", 5), updateTricycle);
router.delete("/:id", authUser, deleteTricycle);