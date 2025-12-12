import express from 'express';
import { authUser } from '../middleware/authMiddleware.js';
import { listQueue, joinQueue, cancelQueue, listTerminals } from '../controllers/queueController.js';

const router = express.Router();

router.get('/', authUser, listQueue);
router.get('/terminals', authUser, listTerminals);
router.post('/', authUser, joinQueue);
router.delete('/:id', authUser, cancelQueue);

export default router;
