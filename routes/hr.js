const express = require('express');
const router = express.Router();
const {
  inviteEmployee,
  updateLeaveAllocation,
  getAllEmployees,
  getLiveAttendance,
  getAllLeaveRequests,
  handleLeaveRequest,
  getEmployeeProfile,
  getEmployeeMonthlyAttendance
} = require('../controllers/hrController');
const { protect, checkRole } = require('../middleware/auth');

// All HR routes require authentication and HR role
router.use(protect);
router.use(checkRole(['HR']));

router.post('/employee', inviteEmployee);
router.put('/employee/:id/allocation', updateLeaveAllocation);
router.get('/employees', getAllEmployees);
router.get('/employee/:id/profile', getEmployeeProfile);
router.get('/employee/:id/attendance', getEmployeeMonthlyAttendance);
router.get('/attendance', getLiveAttendance);
router.get('/leaves', getAllLeaveRequests);
router.put('/leave/:id', handleLeaveRequest);

module.exports = router;
