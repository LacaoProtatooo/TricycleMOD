import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  getDriverBoundaryInfo,
  settlePayment,
  getOperatorOverview,
  confirmSettlement,
  disputeSettlement,
  getSettlementHistory,
  repayDisputedSettlement
} from '../controllers/boundaryController.js';

const router = express.Router();

// Protected routes - require authentication
router.use(protect);

// Driver routes
router.get('/driver-info', authorize('driver'), getDriverBoundaryInfo);
router.post('/settle', authorize('driver'), settlePayment);
router.post('/repay-dispute/:disputeId', authorize('driver'), repayDisputedSettlement);

// Operator routes
router.get('/operator-overview', authorize('operator'), getOperatorOverview);
router.put('/confirm/:settlementId', authorize('operator'), confirmSettlement);
router.put('/dispute/:settlementId', authorize('operator'), disputeSettlement);

// Shared routes
router.get('/history', authorize('driver', 'operator'), getSettlementHistory);

export default router;
