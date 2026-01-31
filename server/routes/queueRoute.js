import express from 'express';
import { authUser } from '../middleware/authMiddleware.js';
import { listQueue, joinQueue, cancelQueue, listTerminals, callNext, publicListQueue, publicListTerminals } from '../controllers/queueController.js';

const router = express.Router();

// Public routes (no authentication required - for guests)
router.get('/public', publicListQueue);
router.get('/public/terminals', publicListTerminals);

// Protected routes (authentication required)
router.get('/', authUser, listQueue);
router.get('/terminals', authUser, listTerminals);
router.post('/', authUser, joinQueue);
router.post('/advance', authUser, callNext);
router.delete('/:id', authUser, cancelQueue);

export default router;
