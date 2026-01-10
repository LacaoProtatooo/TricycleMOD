import express from 'express';
import { authUser } from '../middleware/authMiddleware.js';
import { 
  getLeaderboard, 
  getAllTimeLeaderboard, 
  getAvailableMonths 
} from '../controllers/leaderboardController.js';

const router = express.Router();

// Get monthly leaderboard (default: current month)
router.get('/', authUser, getLeaderboard);

// Get all-time leaderboard
router.get('/all-time', authUser, getAllTimeLeaderboard);

// Get available months for dropdown
router.get('/months', authUser, getAvailableMonths);

export default router;
