import express from 'express';
import upload from '../utils/multer.js';
import { parseLicense, saveLicense, getLicense } from '../controllers/licenseController.js';
import { authUser } from '../middleware/authMiddleware.js';

const router = express.Router();

// Parse license (Upload -> OCR -> Return JSON)
router.post('/parse', authUser, upload.single('licenseImage'), parseLicense);

// Save license (Receive verified data -> Save to DB)
router.post('/save', authUser, saveLicense);

// Get license details
router.get('/:userId', authUser, getLicense);

export default router;
