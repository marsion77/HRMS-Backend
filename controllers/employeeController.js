const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');

// Helper to get local date string YYYY-MM-DD
const getLocalDateString = (date) => {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

/**
 * Get the current employee's attendance record for today
 * GET /api/employee/attendance/today
 */
const getTodayAttendance = async (req, res) => {
  try {
    const todayStr = getLocalDateString(new Date());
    const attendance = await Attendance.findOne({ userId: req.user.id, date: todayStr });
    
    res.status(200).json({
      success: true,
      attendance
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Toggle attendance (Check-in if not started today, Check-out if checked-in)
 * POST /api/employee/attendance/toggle
 */
const toggleAttendance = async (req, res) => {
  try {
    const todayStr = getLocalDateString(new Date());
    let attendance = await Attendance.findOne({ userId: req.user.id, date: todayStr });

    if (!attendance) {
      // Perform Check-In
      attendance = new Attendance({
        userId: req.user.id,
        date: todayStr,
        checkInTime: new Date(),
        status: 'Checked-In'
      });
      await attendance.save();
      
      return res.status(201).json({
        success: true,
        message: 'Successfully checked in!',
        attendance
      });
    } else if (attendance.status === 'Checked-In') {
      // Perform Check-Out
      attendance.checkOutTime = new Date();
      attendance.status = 'Checked-Out';
      
      // Calculate total duration in hours
      const diffMs = attendance.checkOutTime - attendance.checkInTime;
      const diffHrs = diffMs / (1000 * 60 * 60);
      attendance.totalHours = Math.round(diffHrs * 100) / 100; // round to 2 decimals

      await attendance.save();
      
      return res.status(200).json({
        success: true,
        message: 'Successfully checked out!',
        attendance
      });
    } else {
      // Status is Checked-Out
      return res.status(400).json({
        success: false,
        message: 'You have already checked out for today.'
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Submit a leave application
 * POST /api/employee/leave
 */
const applyForLeave = async (req, res) => {
  const { leaveType, startDate, endDate, reason } = req.body;
  if (!leaveType || !startDate || !endDate || !reason) {
    return res.status(400).json({ success: false, message: 'Please fill in all leave request fields.' });
  }

  if (!['sick', 'casual', 'other'].includes(leaveType)) {
    return res.status(400).json({ success: false, message: 'Invalid leave type selected.' });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end < start) {
    return res.status(400).json({ success: false, message: 'End date cannot be before start date.' });
  }

  try {
    const user = await User.findById(req.user.id);
    const leaveDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const available = user.leaveAllocations[leaveType] - user.leaveUsed[leaveType];

    if (available < leaveDays) {
      return res.status(400).json({
        success: false,
        message: `Insufficient leave balance. You requested ${leaveDays} days, but only have ${available} days available.`
      });
    }

    const leave = new Leave({
      userId: req.user.id,
      leaveType,
      startDate: start,
      endDate: end,
      reason
    });

    await leave.save();
    
    res.status(201).json({
      success: true,
      message: 'Leave application submitted successfully for review.',
      leave
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Fetch list of leave applications for the current employee
 * GET /api/employee/leaves
 */
const getMyLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find({ userId: req.user.id }).sort({ appliedAt: -1 });
    res.status(200).json({
      success: true,
      leaves
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Upload or update employee's profile picture
 * PUT /api/employee/profile-image
 */
const uploadProfileImage = async (req, res) => {
  const { profileImage } = req.body;
  
  if (!profileImage) {
    return res.status(400).json({ success: false, message: 'Please provide a profile image.' });
  }

  if (!profileImage.startsWith('data:image/')) {
    return res.status(400).json({ success: false, message: 'Invalid image format. Must be a base64 data URI.' });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    user.profileImage = profileImage;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile picture updated successfully!',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        profileImage: user.profileImage,
        leaveAllocations: user.leaveAllocations,
        leaveUsed: user.leaveUsed
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getTodayAttendance,
  toggleAttendance,
  applyForLeave,
  getMyLeaves,
  uploadProfileImage
};
