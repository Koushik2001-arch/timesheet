// routes/auth.js - UPDATED VERSION
import express from 'express';
import {
  signup,
  login,
  adminLogin,
  getPendingUsers,
  approveUser,
  rejectUser,
  requestReset,
  getPendingResets,
  approveReset,
  resetPassword,
  deleteReset,
  getAllUsers,      // ADD THIS
  getUserByEmpId,   // ADD THIS
  revokeUser
} from '../controllers/authController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/signup', signup);
router.post('/login', login);
router.post('/admin-login', adminLogin);
router.post('/request-reset', requestReset);
router.post('/reset-password', resetPassword);

// Admin protected routes
router.get('/pending-users', protect, restrictTo('admin'), getPendingUsers);
router.get('/pending-resets', protect, restrictTo('admin'), getPendingResets);
router.post('/approve-user/:id', protect, restrictTo('admin'), approveUser);
router.post('/reject-user/:id', protect, restrictTo('admin'), rejectUser);
router.post('/approve-reset/:id', protect, restrictTo('admin'), approveReset);
router.delete('/delete-reset/:id', protect, restrictTo('admin'), deleteReset);
router.delete('/revoke-user/:empId', protect, restrictTo('admin'), revokeUser); // NEW ROUTE


// NEW ROUTES FOR ADMIN DASHBOARD
router.get('/all-users', protect, restrictTo('admin'), getAllUsers);
router.get('/user/:empId', protect, restrictTo('admin'), getUserByEmpId);


export default router;