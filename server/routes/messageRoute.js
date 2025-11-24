// messageRoute.js

import express from 'express';
import { authUser } from '../middleware/authMiddleware.js';
import {
  getConversations,
  getMessages,
  sendMessage,
  getUsers
} from '../controllers/messageController.js';

const router = express.Router();

// Get all conversations for current user
router.get('/conversations', authUser, getConversations);
// Get all users
router.get('/users', authUser, getUsers);
// Send a message
router.post('/send', authUser, sendMessage);

// Get messages between current user and another user
router.get('/:userId', authUser, getMessages);

export default router;