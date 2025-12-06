import express from 'express';
import { authUser } from '../middleware/authMiddleware.js';
import { createForumPost, getForumPosts } from '../controllers/forumController.js';

const router = express.Router();

router.route('/')
  .get(authUser, getForumPosts)
  .post(authUser, createForumPost);

export default router;
