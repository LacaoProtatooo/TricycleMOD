import express from 'express';
import { authUser, adminOnly } from '../middleware/authMiddleware.js';
import upload from '../utils/multer.js';
import { createLostFound, listLostFound, claimLostFound, verifyLostFound, deleteLostFound, getLostFoundStats } from '../controllers/lostFoundController.js';

const router = express.Router();

router.get('/', authUser, listLostFound);
router.post('/', authUser, upload.single('photo'), createLostFound);
router.patch('/:id/claim', authUser, claimLostFound);

// Admin routes
router.get('/admin/stats', authUser, adminOnly, getLostFoundStats);
router.patch('/admin/:id/verify', authUser, adminOnly, verifyLostFound);
router.delete('/admin/:id', authUser, adminOnly, deleteLostFound);

export default router;
