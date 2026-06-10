const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const crypto = require('crypto');
const { sendActivationEmail } = require('../services/emailService');

// Helper to get local date string YYYY-MM-DD
const getLocalDateString = (date) => {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

/**
 * Invite an Employee and set initial leave allocations
 * POST /api/hr/employee
 */
const inviteEmployee = async (req, res) => {
  const { name, email, sickAllocation, casualAllocation, otherAllocation } = req.body;
  if (!name || !email) {
    return res.status(400).json({ success: false, message: 'Please provide employee name and email' });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const activationToken = crypto.randomBytes(32).toString('hex');
    const activationTokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    const employee = new User({
      name,
      email,
      role: 'Employee',
      status: 'Pending',
      activationToken,
      activationTokenExpires,
      leaveAllocations: {
        sick: sickAllocation !== undefined ? Number(sickAllocation) : 12,
        casual: casualAllocation !== undefined ? Number(casualAllocation) : 10,
        other: otherAllocation !== undefined ? Number(otherAllocation) : 8
      }
    });

    await employee.save();

    // Send email asynchronously to avoid blocking the response
    sendActivationEmail(email, name, 'Employee', activationToken).catch(emailError => {
      console.error('Nodemailer Error: Failed to send Employee invitation email in background:', emailError.message);
      // Note: We don't rollback here because the email could be resent later, 
      // and we want the invite to feel instant.
    });

    res.status(201).json({
      success: true,
      message: 'Employee invited successfully. Activation email is being sent in the background.',
      employee
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update employee leave allocations
 * PUT /api/hr/employee/:id/allocation
 */
const updateLeaveAllocation = async (req, res) => {
  const { sick, casual, other } = req.body;
  try {
    const employee = await User.findOne({ _id: req.params.id, role: 'Employee' });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    if (sick !== undefined) employee.leaveAllocations.sick = Number(sick);
    if (casual !== undefined) employee.leaveAllocations.casual = Number(casual);
    if (other !== undefined) employee.leaveAllocations.other = Number(other);

    await employee.save();
    res.status(200).json({ 
      success: true, 
      message: 'Leave allocations updated successfully', 
      employee 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get all employees
 * GET /api/hr/employees
 */
const getAllEmployees = async (req, res) => {
  try {
    const employees = await User.find({ role: 'Employee' }).select('-password');
    res.status(200).json({ success: true, employees });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get live attendance status of all employees for today
 * GET /api/hr/attendance
 */
const getLiveAttendance = async (req, res) => {
  try {
    const todayStr = getLocalDateString(new Date());
    
    // Get all active Employees
    const employees = await User.find({ role: 'Employee', status: 'Active' }).select('name email');
    
    // Get all attendance logs for today
    const attendanceLogs = await Attendance.find({ date: todayStr });

    // Map logs by user id
    const logsMap = {};
    attendanceLogs.forEach(log => {
      logsMap[log.userId.toString()] = log;
    });

    const liveStatus = employees.map(emp => {
      const log = logsMap[emp._id.toString()];
      return {
        userId: emp._id,
        name: emp.name,
        email: emp.email,
        status: log ? log.status : 'Away', // Checked-In, Checked-Out, or Away
        checkInTime: log ? log.checkInTime : null,
        checkOutTime: log ? log.checkOutTime : null,
        totalHours: log ? log.totalHours : 0
      };
    });

    res.status(200).json({ success: true, attendance: liveStatus, date: todayStr });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get all leave requests with populated user details
 * GET /api/hr/leaves
 */
const getAllLeaveRequests = async (req, res) => {
  try {
    const leaves = await Leave.find()
      .populate('userId', 'name email leaveAllocations leaveUsed')
      .sort({ appliedAt: -1 });
    res.status(200).json({ success: true, leaves });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Approve or reject a leave request
 * PUT /api/hr/leave/:id
 */
const handleLeaveRequest = async (req, res) => {
  const { status } = req.body; // 'Approved' or 'Rejected'
  if (!['Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status. Must be Approved or Rejected' });
  }

  try {
    const leave = await Leave.findById(req.params.id).populate('userId');
    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    if (leave.status !== 'Pending') {
      return res.status(400).json({ 
        success: false, 
        message: `Leave request has already been ${leave.status.toLowerCase()}` 
      });
    }

    const employee = leave.userId;
    // Calculate leave days count (inclusive)
    const leaveDays = Math.ceil((new Date(leave.endDate) - new Date(leave.startDate)) / (1000 * 60 * 60 * 24)) + 1;
    const leaveType = leave.leaveType;

    if (status === 'Approved') {
      const available = employee.leaveAllocations[leaveType] - employee.leaveUsed[leaveType];
      if (available < leaveDays) {
        return res.status(400).json({
          success: false,
          message: `Insufficient leave balance. Request requires ${leaveDays} days, but employee only has ${available} days available.`
        });
      }

      // Increment used leaves
      employee.leaveUsed[leaveType] += leaveDays;
      await employee.save();
    }

    leave.status = status;
    await leave.save();

    res.status(200).json({
      success: true,
      message: `Leave request has been successfully ${status.toLowerCase()}`,
      leave
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get a single employee's profile with leave & today's attendance
 * GET /api/hr/employee/:id/profile
 */
const getEmployeeProfile = async (req, res) => {
  try {
    const employee = await User.findOne({ _id: req.params.id, role: 'Employee' }).select('-password');
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const todayStr = getLocalDateString(new Date());
    const todayLog = await Attendance.findOne({ userId: employee._id, date: todayStr });

    // All approved leaves
    const approvedLeaves = await Leave.find({ userId: employee._id, status: 'Approved' });

    res.status(200).json({
      success: true,
      employee,
      todayAttendance: todayLog || null,
      approvedLeaves
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get employee's monthly attendance logs
 * GET /api/hr/employee/:id/attendance?month=6&year=2026
 */
const getEmployeeMonthlyAttendance = async (req, res) => {
  try {
    const { month, year } = req.query;
    const now = new Date();
    const targetMonth = month ? parseInt(month) : now.getMonth() + 1;
    const targetYear = year ? parseInt(year) : now.getFullYear();

    // Build date range strings YYYY-MM-DD for the whole month
    const paddedMonth = String(targetMonth).padStart(2, '0');
    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
    const startDate = `${targetYear}-${paddedMonth}-01`;
    const endDate = `${targetYear}-${paddedMonth}-${String(daysInMonth).padStart(2, '0')}`;

    const logs = await Attendance.find({
      userId: req.params.id,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    res.status(200).json({
      success: true,
      month: targetMonth,
      year: targetYear,
      logs
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  inviteEmployee,
  updateLeaveAllocation,
  getAllEmployees,
  getLiveAttendance,
  getAllLeaveRequests,
  handleLeaveRequest,
  getEmployeeProfile,
  getEmployeeMonthlyAttendance
};
