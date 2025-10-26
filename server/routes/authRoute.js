import express from 'express';
import upload from '../utils/multer.js';
import {
  logout,
  updateProfile,
  getUsers,
  getUserById,
  getCurrentUser,
  storeFCM,
} from '../controllers/authController.js';
import { authUser, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/logout', authUser, logout);
router.put('/update-profile', authUser, upload.single("image"), updateProfile);
router.get('/users', authUser, adminOnly, getUsers);
router.get('/users/:id', getUserById);
router.get('/current-user', authUser, getCurrentUser);
router.post('/store-fcm', storeFCM);

export default router;
