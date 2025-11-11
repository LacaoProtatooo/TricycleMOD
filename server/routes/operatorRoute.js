import express from 'express';
import {
  getOperatorOverview,
  getOperatorTricycles,
  getAvailableDrivers,
  assignDriverToTricycle,
  unassignDriverFromTricycle,
  getDriverDetails,
} from '../controllers/operatorController.js';
import { authUser } from '../middleware/authMiddleware.js';
import { operatorOnly } from '../middleware/operatorMiddleware.js';

const router = express.Router();

// All routes require authentication and operator role
router.use(authUser);
router.use(operatorOnly);

// Operator overview - get all tricycles and drivers
router.get('/overview', getOperatorOverview);

// Get operator's tricycles
router.get('/tricycles', getOperatorTricycles);

// Get available drivers (not assigned to any tricycle)
router.get('/drivers/available', getAvailableDrivers);

// Get driver details
router.get('/drivers/:driverId', getDriverDetails);

// Assign driver to tricycle
router.post('/assign-driver', assignDriverToTricycle);

// Unassign driver from tricycle
router.post('/unassign-driver', unassignDriverFromTricycle);

export default router;


