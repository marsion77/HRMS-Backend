const express = require('express');
const router = express.Router();
const {
  getTodayAttendance,
  toggleAttendance,
  applyForLeave,
  getMyLeaves,
  uploadProfileImage
} = require('../controllers/employeeController');
const { protect, checkRole } = require('../middleware/auth');

// All employee routes require authentication and Employee role
router.use(protect);
router.use(checkRole(['Employee']));

router.get('/attendance/today', getTodayAttendance);
router.post('/attendance/toggle', toggleAttendance);
router.post('/leave', applyForLeave);
router.get('/leaves', getMyLeaves);
router.put('/profile-image', uploadProfileImage);

module.exports = router;
