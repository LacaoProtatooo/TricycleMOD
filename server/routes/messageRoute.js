import express from 'express';
import { authUser } from '../middleware/authMiddleware.js';
import {
  getConversations,
  getMessages,
  sendMessage,
} from '../controllers/messageController.js';

const router = express.Router();

// All routes require authentication
router.use(authUser);

// Get all conversations for current user
router.get('/conversations', getConversations);

// Send a message
router.post('/send', sendMessage);

// Get messages between current user and another user (MUST BE LAST)
router.get('/:userId', getMessages);

export default router;