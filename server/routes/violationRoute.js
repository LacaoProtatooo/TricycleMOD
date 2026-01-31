import express from 'express';
import {
  createViolation,
  getAllViolations,
  getDriverViolations,
  getViolationDetails,
  updateViolationStatus,
  processAppeal,
  getRulesReference,
  getViolationStats,
  getMyViolations,
  submitAppeal,
} from '../controllers/violationController.js';
import { authUser, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Violation Routes
 * 
 * Base path: /api/violations
 */

// Get WEBTTODA rules reference (any authenticated user)
router.get('/rules', authUser, getRulesReference);

// ============ DRIVER ROUTES ============

// Get my violations (for drivers to see their own)
router.get('/my-violations', authUser, getMyViolations);

// Submit an appeal (for drivers)
router.post('/:id/submit-appeal', authUser, submitAppeal);

// ============ ADMIN ROUTES ============

// Get violation statistics for dashboard
router.get('/stats', adminOnly, getViolationStats);

// Get all violations with filters
router.get('/', adminOnly, getAllViolations);

// Get driver's violation history (admin viewing any driver)
router.get('/driver/:driverId', adminOnly, getDriverViolations);

// Get specific violation details
router.get('/:id', adminOnly, getViolationDetails);

// Create a new violation (manual admin report)
router.post('/', adminOnly, createViolation);

// Update violation status
router.put('/:id/status', adminOnly, updateViolationStatus);

// Process appeal decision
router.put('/:id/appeal', adminOnly, processAppeal);

export default router;
