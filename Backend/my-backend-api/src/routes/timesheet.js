// routes/timesheet.js - Ensure this exists
import express from 'express';
import {
  submitTimesheet,
  getEmployeeTimesheets,
  getEmployeeDetails,
  getAllEmployees,  // Make sure this is imported
  getAllUsers       // If you want this too
} from '../controllers/timesheetController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

// Employee routes
router.post('/submit', protect, submitTimesheet);

// Admin routes
router.get('/employee-timesheets', protect, restrictTo('admin'), getEmployeeTimesheets);
router.get('/employee-details/:empId', protect, restrictTo('admin'), getEmployeeDetails);
router.get('/employees', protect, restrictTo('admin'), getAllEmployees);
router.get('/all-users', protect, restrictTo('admin'), getAllUsers); // Add this if you want

export default router;